"use client";

import { useState } from "react";
import type { TxStatus } from "@/types";

interface ContributeFormProps {
  txStatus: TxStatus;
  onContribute: (amount: number) => Promise<void>;
}

const STATUS_LABELS: Record<TxStatus, string | null> = {
  idle: null,
  awaiting_approval: "Awaiting Wallet Approval...",
  validating: "Validating Block Ledger...",
  success: null,
  failure: null,
};

export default function ContributeForm({ txStatus, onContribute }: ContributeFormProps) {
  const [amount, setAmount] = useState("");
  const isPending = txStatus === "awaiting_approval" || txStatus === "validating";
  const statusLabel = STATUS_LABELS[txStatus];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(amount, 10);
    if (isNaN(parsed) || parsed <= 0) return;
    await onContribute(parsed);
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Contribute</h3>

      {isPending && statusLabel && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {statusLabel}
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (XLM)"
          disabled={isPending}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending || !amount}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Contributing..." : "Contribute"}
        </button>
      </div>
    </form>
  );
}
