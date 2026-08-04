import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionAlert from "./TransactionAlert";

describe("TransactionAlert", () => {
  it("renders nothing when there is no terminal status", () => {
    const { container } = render(
      <TransactionAlert status={null} hash={null} error={null} explorerUrl={null} onDismiss={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the tx hash as a link on success", () => {
    render(
      <TransactionAlert
        status="success"
        hash="abc123"
        error={null}
        explorerUrl="https://stellar.expert/explorer/testnet/tx/abc123"
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Contribution recorded on-chain!")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "abc123" });
    expect(link).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows the error message on failure", () => {
    render(
      <TransactionAlert
        status="failure"
        hash={null}
        error="Insufficient XLM balance."
        explorerUrl={null}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Transaction Failed")).toBeInTheDocument();
    expect(screen.getByText("Insufficient XLM balance.")).toBeInTheDocument();
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <TransactionAlert
        status="failure"
        hash={null}
        error="boom"
        explorerUrl={null}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
