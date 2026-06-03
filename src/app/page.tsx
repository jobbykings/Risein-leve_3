"use client";

import { useState, useCallback } from "react";
import { useCrowdfund } from "@/context/CrowdfundContext";
import WalletModal from "@/components/WalletModal";
import ProgressBar from "@/components/ProgressBar";
import CountdownTimer from "@/components/CountdownTimer";
import ContributeForm from "@/components/ContributeForm";
import TransactionAlert from "@/components/TransactionAlert";

export default function Home() {
  const {
    address,
    handleConnected,
    disconnectWallet,
    campaign,
    campaignLoading,
    txState,
    explorerUrl,
    contribute,
    refreshCampaign,
    resetTx,
  } = useCrowdfund();

  const [modalOpen, setModalOpen] = useState(false);

  const handleConnect = useCallback(
    (addr: string) => {
      handleConnected(addr);
    },
    [handleConnected],
  );

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Crowdfund Campaign
        </h1>

        {address ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-indigo-100 px-4 py-1.5 font-mono text-sm text-indigo-700">
              {formatAddress(address)}
            </span>
            <button
              onClick={disconnectWallet}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
            >
              Disconnect
            </button>
            <button
              onClick={refreshCampaign}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {!address ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-20 text-center">
          <svg className="mb-4 h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
          </svg>
          <p className="text-lg font-medium text-gray-900">Connect your Stellar wallet</p>
          <p className="mt-1 text-sm text-gray-500">
            Use Freighter, xBull, or Albedo to contribute.
          </p>
        </div>
      ) : campaignLoading ? (
        <div className="flex flex-col items-center py-20">
          <svg className="mb-4 h-8 w-8 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading campaign data...</p>
        </div>
      ) : campaign ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <ProgressBar current={campaign.totalRaised} target={campaign.target} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <CountdownTimer deadlineTimestamp={campaign.deadlineTimestamp} />
          </div>

          <ContributeForm
            txStatus={txState.status}
            onContribute={contribute}
          />

          <TransactionAlert
            status={txState.status === "success" ? "success" : txState.status === "failure" ? "failure" : null}
            hash={txState.hash}
            error={txState.error}
            explorerUrl={explorerUrl}
            onDismiss={resetTx}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Failed to load campaign data. Please refresh.
        </div>
      )}

      <WalletModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={handleConnect}
      />
    </main>
  );
}
