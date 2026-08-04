import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrowdfundProvider, useCrowdfund } from "./CrowdfundContext";

const STROOPS_PER_XLM = 10_000_000;
const CACHE_KEY = "crowdfund_campaign";

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  fund: vi.fn(),
  claim: vi.fn(),
  getLatestLedger: vi.fn(),
  getEvents: vi.fn(),
  signAndSend: vi.fn(),
  /** Records the options passed to each `new Client(...)` construction. */
  clientOptions: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/contracts/crowdfund-client", () => ({
  networks: {
    testnet: {
      contractId: "C_TEST_CONTRACT_ID",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  rpc: {
    Server: vi.fn(function () {
      return {
        getLatestLedger: mocks.getLatestLedger,
        getEvents: mocks.getEvents,
      };
    }),
  },
  Client: vi.fn(function (options: unknown) {
    mocks.clientOptions(options);
    return {
      get_status: mocks.getStatus,
      fund: mocks.fund,
      claim: mocks.claim,
    };
  }),
}));

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: {
    init: vi.fn(),
    signTransaction: vi.fn(),
    disconnect: vi.fn(() => mocks.disconnect()),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/types", () => ({
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: vi.fn(),
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/xbull", () => ({
  xBullModule: vi.fn(),
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/albedo", () => ({
  AlbedoModule: vi.fn(),
}));

/** Rust-style Result<Ok> returned by successful simulations. */
function okResult() {
  return { isOk: () => true, isErr: () => false };
}

/** Rust-style Result<Err> with a typed contract error name. */
function errResult(message: string) {
  return {
    isOk: () => false,
    isErr: () => true,
    unwrap: () => {
      throw new Error("called unwrap on an Err");
    },
    unwrapErr: () => ({ message }),
  };
}

function Harness() {
  const ctx = useCrowdfund();
  return (
    <div>
      <div data-testid="tx-status">{ctx.txState.status}</div>
      <div data-testid="tx-error">{ctx.txState.error ?? ""}</div>
      <div data-testid="campaign-total">
        {ctx.campaign ? String(ctx.campaign.totalRaised) : "null"}
      </div>
      <div data-testid="live">{ctx.live ? "live" : "offline"}</div>
      <button onClick={() => ctx.handleConnected("G_DONOR_ADDRESS")}>connect</button>
      <button onClick={() => void ctx.disconnectWallet()}>disconnect</button>
      <button onClick={() => void ctx.contribute(5)}>contribute</button>
      <button onClick={() => void ctx.claimFunds()}>claim</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <CrowdfundProvider>
      <Harness />
    </CrowdfundProvider>,
  );
}

describe("CrowdfundContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // get_status resolves a 5-element Vec<u64>: total, target, deadline,
    // deadline_passed, is_claimed.
    mocks.getStatus.mockResolvedValue({ result: [1234, 100_000, 1_800_000_000, 0, 0] });
    mocks.getLatestLedger.mockResolvedValue({ sequence: 1_100 });
    mocks.getEvents.mockResolvedValue({ cursor: "c1", events: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("uses a wallet-free reader client and connects the event stream on mount", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("campaign-total")).toHaveTextContent("1234"));
    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("live"));

    // The reader client is constructed with no publicKey (view calls only) —
    // no wallet is required to see the campaign or stream events.
    expect(mocks.clientOptions).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: "C_TEST_CONTRACT_ID" }),
    );
    expect(mocks.clientOptions.mock.calls[0][0]).not.toHaveProperty("publicKey");

    expect(mocks.getLatestLedger).toHaveBeenCalled();
    expect(mocks.getEvents).toHaveBeenCalled();
  });

  it("restores a cached campaign synchronously before the fresh fetch", async () => {
    const cached = {
      data: { totalRaised: 9999, target: 100_000, deadlineTimestamp: 1_800_000_000, deadlinePassed: false, isClaimed: false },
      cachedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));

    renderProvider();

    // Cache renders immediately (synchronous)…
    expect(screen.getByTestId("campaign-total")).toHaveTextContent("9999");
    // …then the poll replaces it with fresh on-chain data.
    await waitFor(() => expect(screen.getByTestId("campaign-total")).toHaveTextContent("1234"));
  });

  it("converts XLM to stroops and reports success after signing", async () => {
    mocks.fund.mockResolvedValue({ result: okResult(), signAndSend: mocks.signAndSend });
    mocks.signAndSend.mockResolvedValue({ sendTransactionResponse: { hash: "deadbeef" } });

    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("live"));

    await user.click(screen.getByRole("button", { name: "connect" }));
    await user.click(screen.getByRole("button", { name: "contribute" }));

    // 5 XLM → 50_000_000 stroops (i128/bigint), donor from the connected wallet.
    expect(mocks.fund).toHaveBeenCalledWith({
      donor: "G_DONOR_ADDRESS",
      amount: BigInt(5 * STROOPS_PER_XLM),
    });
    expect(mocks.signAndSend).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("tx-status")).toHaveTextContent("success"));
  });

  it("surfaces a typed contract error before signing", async () => {
    mocks.fund.mockResolvedValue({
      result: errResult("DeadlinePassed"),
      signAndSend: mocks.signAndSend,
    });

    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("live"));

    await user.click(screen.getByRole("button", { name: "connect" }));
    await user.click(screen.getByRole("button", { name: "contribute" }));

    await waitFor(() => expect(screen.getByTestId("tx-status")).toHaveTextContent("failure"));
    expect(screen.getByTestId("tx-error")).toHaveTextContent(
      "The campaign deadline has already passed.",
    );
    // The wallet prompt is never shown: simulation failed before signing.
    expect(mocks.signAndSend).not.toHaveBeenCalled();
  });

  it("maps wallet rejections to a friendly UserRejected message", async () => {
    mocks.fund.mockResolvedValue({ result: okResult(), signAndSend: mocks.signAndSend });
    mocks.signAndSend.mockRejectedValue(new Error("User declined the signature request"));

    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("live"));

    await user.click(screen.getByRole("button", { name: "connect" }));
    await user.click(screen.getByRole("button", { name: "contribute" }));

    await waitFor(() => expect(screen.getByTestId("tx-status")).toHaveTextContent("failure"));
    expect(screen.getByTestId("tx-error")).toHaveTextContent(
      "User rejected the transaction signature request",
    );
  });

  it("reports success on a successful claim", async () => {
    mocks.claim.mockResolvedValue({ result: okResult(), signAndSend: mocks.signAndSend });
    mocks.signAndSend.mockResolvedValue({ sendTransactionResponse: { hash: "cafebabe" } });

    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("live"));

    await user.click(screen.getByRole("button", { name: "connect" }));
    await user.click(screen.getByRole("button", { name: "claim" }));

    expect(mocks.claim).toHaveBeenCalledWith({ caller: "G_DONOR_ADDRESS" });
    expect(mocks.signAndSend).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("tx-status")).toHaveTextContent("success"));
  });

  it("surfaces claim errors via the typed error path", async () => {
    mocks.claim.mockResolvedValue({
      result: errResult("TargetNotMet"),
      signAndSend: mocks.signAndSend,
    });

    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("live"));

    await user.click(screen.getByRole("button", { name: "connect" }));
    await user.click(screen.getByRole("button", { name: "claim" }));

    await waitFor(() => expect(screen.getByTestId("tx-status")).toHaveTextContent("failure"));
    expect(screen.getByTestId("tx-error")).toHaveTextContent(
      "The campaign target was not reached.",
    );
    expect(mocks.signAndSend).not.toHaveBeenCalled();
  });

  it("disconnects the wallet and resets the transaction state", async () => {
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("live"));

    await user.click(screen.getByRole("button", { name: "connect" }));
    await user.click(screen.getByRole("button", { name: "disconnect" }));

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tx-status")).toHaveTextContent("idle");
  });
});
