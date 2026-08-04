"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { Client, networks, rpc } from "@/contracts/crowdfund-client";
import type { CampaignState, TxState } from "@/types";
import { UserRejected, InsufficientFunds } from "@/utils/errors";

const MODULES = [new FreighterModule(), new xBullModule(), new AlbedoModule()];
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || networks.testnet.contractId;
const CACHE_KEY = "crowdfund_campaign";
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 1 XLM = 10_000_000 stroops (the contract transacts in stroops). */
const STROOPS_PER_XLM = 10_000_000;

/**
 * Event streaming: poll Soroban RPC `getEvents` for this contract so the
 * campaign refreshes live whenever anyone contributes or claims.
 */
const EVENT_POLL_INTERVAL_MS = 10_000;
/** How far back (in ledgers) the first poll looks — ~40 min of testnet ledgers. */
const EVENT_CATCHUP_LEDGERS = 500;

/** Friendly messages for the contract's typed errors. */
const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  NotInitialized: "The campaign has not been initialized yet.",
  AlreadyInitialized: "The campaign is already initialized.",
  DeadlinePassed: "The campaign deadline has already passed.",
  DeadlineNotPassed: "The deadline has not passed yet.",
  TargetNotMet: "The campaign target was not reached.",
  AlreadyClaimed: "The funds have already been claimed.",
  InvalidAmount: "That contribution amount is invalid.",
  Overflow: "The campaign total would overflow.",
  NoFunds: "The campaign has no funds to pay out.",
};

/** Map a contract error name (e.g. "DeadlinePassed") to a friendly message. */
function contractErrorMessage(name: string): string {
  return CONTRACT_ERROR_MESSAGES[name] ?? `The campaign rejected the request (${name}).`;
}

interface CachedCampaign {
  data: CampaignState;
  cachedAt: number;
}

export interface CrowdfundContextValue {
  address: string | null;
  handleConnected: (addr: string) => void;
  disconnectWallet: () => void;
  campaign: CampaignState | null;
  campaignLoading: boolean;
  txState: TxState;
  explorerUrl: string | null;
  /** True once the getEvents stream is successfully polling. */
  live: boolean;
  /** Number of new on-chain events observed since the page loaded. */
  liveEventCount: number;
  contribute: (amount: number) => Promise<void>;
  claimFunds: () => Promise<void>;
  refreshCampaign: (silent?: boolean) => Promise<boolean>;
  resetTx: () => void;
}

const CrowdfundContext = createContext<CrowdfundContextValue | null>(null);

function loadCached(): CampaignState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedCampaign = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function saveCache(data: CampaignState) {
  try {
    const entry: CachedCampaign = { data, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
  }
}

export function CrowdfundProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignState | null>(loadCached);
  const [campaignLoading, setCampaignLoading] = useState(!campaign);
  const [txState, setTxState] = useState<TxState>({
    status: "idle",
    hash: null,
    error: null,
  });
  const [live, setLive] = useState(false);
  const [liveEventCount, setLiveEventCount] = useState(0);

  // Reader client: wallet-free, used for view calls (get_status).
  const readerClientRef = useRef<Client | null>(null);
  // Wallet client: used only for state-changing calls (fund / claim).
  const walletClientRef = useRef<Client | null>(null);
  const kitInitRef = useRef(false);

  useEffect(() => {
    if (kitInitRef.current) return;
    kitInitRef.current = true;
    StellarWalletsKit.init({
      modules: MODULES,
      network: Networks.TESTNET,
    });
  }, []);

  const refreshCampaign = useCallback(async (silent = false) => {
    const client = readerClientRef.current;
    if (!client) return false;

    if (!silent) setCampaignLoading(true);
    try {
      const { result } = await client.get_status();
      const data: CampaignState = {
        totalRaised: Number(result[0]),
        target: Number(result[1]),
        deadlineTimestamp: Number(result[2]),
        deadlinePassed: Number(result[3]) === 1,
        isClaimed: Number(result[4]) === 1,
      };
      setCampaign(data);
      saveCache(data);
      return true;
    } catch (err) {
      console.error("Soroban Fetch Error:", err);
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {
      }
      return false;
    } finally {
      // Silent refreshes never set loading true, so clearing it is a no-op
      // there and only matters for manual/initial loads.
      setCampaignLoading(false);
    }
  }, []);

  // Wallet client for state-changing calls (fund / claim).
  useEffect(() => {
    if (!address) {
      walletClientRef.current = null;
      return;
    }

    const client = new Client({
      contractId: CONTRACT_ID,
      networkPassphrase: networks.testnet.networkPassphrase,
      rpcUrl: RPC_URL,
      publicKey: address,
      signTransaction: (xdr, opts) =>
        StellarWalletsKit.signTransaction(xdr, {
          networkPassphrase: opts?.networkPassphrase,
          address: opts?.address,
        }),
    });

    walletClientRef.current = client;
  }, [address]);

  // Reader client: load the campaign for everyone (no wallet needed) and
  // stream contract events so the UI updates live when anyone contributes.
  useEffect(() => {
    const reader = new Client({
      contractId: CONTRACT_ID,
      networkPassphrase: networks.testnet.networkPassphrase,
      rpcUrl: RPC_URL,
    });
    readerClientRef.current = reader;

    const server = new rpc.Server(RPC_URL);
    const eventsFilter: rpc.Api.EventFilter[] = [
      { type: "contract", contractIds: [CONTRACT_ID] },
    ];
    let cancelled = false;
    let cursor: string | null = null;
    // Set once get_status succeeds; while false, every tick re-attempts the
    // view call so a transient first-load failure doesn't strand the campaign.
    let loaded = false;

    const poll = async (first: boolean) => {
      if (cancelled) return;
      try {
        // First tick (and every tick until it succeeds): populate the
        // campaign. campaignLoading already starts true, so the silent
        // refresh just fills in the data.
        if (first || !loaded) {
          loaded = (await refreshCampaign(true)) || loaded;
        }

        let res: rpc.Api.GetEventsResponse;
        if (cursor) {
          // Cursor mode: only fetch events newer than the last batch.
          res = await server.getEvents({ filters: eventsFilter, cursor, limit: 10 });
        } else {
          // First poll: look back a few hundred ledgers to catch recent activity.
          const latest = await server.getLatestLedger();
          res = await server.getEvents({
            filters: eventsFilter,
            startLedger: Math.max(1, latest.sequence - EVENT_CATCHUP_LEDGERS),
            limit: 10,
          });
        }

        cursor = res.cursor;
        if (cancelled) return;

        // Any event (FundEvent / ClaimEvent) means on-chain state changed —
        // silently refresh so the progress bar and banners stay in sync.
        // Backlog caught up on the first poll isn't "new since page load",
        // so only live ticks increment the counter.
        if (res.events.length > 0) {
          if (!first) setLiveEventCount((count) => count + res.events.length);
          if (!first) await refreshCampaign(true);
        }
        if (!cancelled) setLive(true);
      } catch {
        // Best-effort streaming: transient RPC errors are ignored and the
        // next poll tick retries.
      }
    };

    poll(true);
    const id = window.setInterval(() => poll(false), EVENT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshCampaign]);

  const handleConnected = useCallback((addr: string) => {
    setAddress(addr);
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch {
    }
    setAddress(null);
    setTxState({ status: "idle", hash: null, error: null });
  }, []);

  const resetTx = useCallback(() => {
    setTxState({ status: "idle", hash: null, error: null });
  }, []);

  const contribute = useCallback(
    async (amount: number) => {
      const client = walletClientRef.current;
      if (!client || !address) return;

      setTxState({ status: "awaiting_approval", hash: null, error: null });

      try {
        // The UI works in XLM; the contract transacts in stroops (i128/bigint).
        const stroops = BigInt(Math.round(amount * STROOPS_PER_XLM));
        const tx = await client.fund({ donor: address, amount: stroops });

        // Surface typed contract errors (e.g. deadline passed) before signing.
        if (tx.result.isErr()) {
          throw new Error(contractErrorMessage(tx.result.unwrapErr().message));
        }

        setTxState({ status: "validating", hash: null, error: null });

        const sent = await tx.signAndSend();
        const hash = sent.sendTransactionResponse?.hash;

        if (!hash) throw new Error("No transaction hash returned");

        setTxState({ status: "success", hash, error: null });
        await refreshCampaign();
      } catch (err: unknown) {
        let mapped: Error;

        if (err instanceof Error) {
          const msg = err.message.toLowerCase();

          if (
            msg.includes("user declined") ||
            msg.includes("cancel") ||
            msg.includes("reject") ||
            msg.includes("UserRejected")
          ) {
            mapped = new UserRejected();
          } else if (
            msg.includes("insufficient") ||
            msg.includes("budget") ||
            msg.includes("fee") ||
            msg.includes("could not be funded")
          ) {
            mapped = new InsufficientFunds(`${amount} XLM`, "check your wallet balance");
          } else {
            mapped = err;
          }
        } else {
          mapped = new Error("An unknown error occurred");
        }

        setTxState({ status: "failure", hash: null, error: mapped.message });
      }
    },
    [address, refreshCampaign]
  );

  const claimFunds = useCallback(
    async () => {
      const client = walletClientRef.current;
      if (!client || !address) return;

      setTxState({ status: "awaiting_approval", hash: null, error: null });

      try {
        const tx = await client.claim({ caller: address });

        // Surface typed contract errors (e.g. target not met) before signing.
        if (tx.result.isErr()) {
          throw new Error(contractErrorMessage(tx.result.unwrapErr().message));
        }

        setTxState({ status: "validating", hash: null, error: null });

        const sent = await tx.signAndSend();
        const hash = sent.sendTransactionResponse?.hash;

        if (!hash) throw new Error("No transaction hash returned");

        setTxState({ status: "success", hash, error: null });
        await refreshCampaign();
      } catch (err: unknown) {
        let mapped: Error;

        if (err instanceof Error) {
          const msg = err.message.toLowerCase();

          if (
            msg.includes("user declined") ||
            msg.includes("cancel") ||
            msg.includes("reject") ||
            msg.includes("UserRejected")
          ) {
            mapped = new UserRejected();
          } else {
            mapped = err;
          }
        } else {
          mapped = new Error("An unknown error occurred");
        }

        setTxState({ status: "failure", hash: null, error: mapped.message });
      }
    },
    [address, refreshCampaign]
  );

  const explorerUrl = txState.hash
    ? `https://stellar.expert/explorer/testnet/tx/${txState.hash}`
    : null;

  return (
    <CrowdfundContext.Provider
      value={{
        address,
        handleConnected,
        disconnectWallet,
        campaign,
        campaignLoading,
        txState,
        explorerUrl,
        live,
        liveEventCount,
        contribute,
        claimFunds,
        refreshCampaign,
        resetTx,
      }}
    >
      {children}
    </CrowdfundContext.Provider>
  );
}

export function useCrowdfund(): CrowdfundContextValue {
  const ctx = useContext(CrowdfundContext);
  if (!ctx) {
    throw new Error("useCrowdfund must be used within a CrowdfundProvider");
  }
  return ctx;
}
