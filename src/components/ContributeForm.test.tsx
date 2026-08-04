import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContributeForm from "./ContributeForm";

function setup(overrides?: Partial<Parameters<typeof ContributeForm>[0]>) {
  const onContribute = vi.fn().mockResolvedValue(undefined);
  const onConnect = vi.fn();

  const utils = render(
    <ContributeForm
      txStatus="idle"
      isConnected={false}
      onContribute={onContribute}
      onConnect={onConnect}
      {...overrides}
    />,
  );

  return { onContribute, onConnect, ...utils };
}

describe("ContributeForm", () => {
  it("prompts to connect instead of contributing when not connected", async () => {
    const user = userEvent.setup();
    const { onContribute, onConnect } = setup();

    await user.type(screen.getByPlaceholderText("Amount (XLM)"), "10");
    await user.click(screen.getByRole("button", { name: "Connect to Contribute" }));

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onContribute).not.toHaveBeenCalled();
  });

  it("submits the parsed amount and clears the input when connected", async () => {
    const user = userEvent.setup();
    const { onContribute } = setup({ isConnected: true });

    await user.type(screen.getByPlaceholderText("Amount (XLM)"), "42");
    await user.click(screen.getByRole("button", { name: "Contribute" }));

    expect(onContribute).toHaveBeenCalledTimes(1);
    expect(onContribute).toHaveBeenCalledWith(42);
    // jsdom reports an empty number input as null.
    expect(screen.getByPlaceholderText("Amount (XLM)")).toHaveValue(null);
  });

  it("does not submit invalid or zero amounts", async () => {
    const user = userEvent.setup();
    const { onContribute } = setup({ isConnected: true });

    await user.type(screen.getByPlaceholderText("Amount (XLM)"), "0");
    await user.click(screen.getByRole("button", { name: "Contribute" }));

    expect(onContribute).not.toHaveBeenCalled();
  });

  it("disables the submit button while a transaction is pending", async () => {
    const user = userEvent.setup();
    const { onContribute } = setup({ isConnected: true, txStatus: "awaiting_approval" });

    await user.type(screen.getByPlaceholderText("Amount (XLM)"), "5");

    const button = screen.getByRole("button", { name: "Contributing..." });
    expect(button).toBeDisabled();
    expect(screen.getByPlaceholderText("Amount (XLM)")).toBeDisabled();
    expect(screen.getByText("Awaiting Wallet Approval...")).toBeInTheDocument();
    expect(onContribute).not.toHaveBeenCalled();
  });
});
