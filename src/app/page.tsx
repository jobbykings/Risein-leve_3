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
    claimFunds,
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

          {(() => {
            const now = Math.floor(Date.now() / 1000);
            const deadlinePassed = now > campaign.deadlineTimestamp;
            const targetMet = campaign.totalRaised >= campaign.target;
            const canClaim = deadlinePassed && targetMet && !campaign.isClaimed;
            const isClaimPending =
              txState.status === "awaiting_approval" ||
              txState.status === "validating";

            if (campaign.isClaimed) {
              return (
                <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
                  <svg className="mx-auto mb-2 h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg font-semibold text-green-800">Campaign Completed</p>
                  <p className="mt-1 text-sm text-green-600">
                    Funds have been claimed.
                  </p>
                </div>
              );
            }

            if (canClaim) {
              return (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
                  <h3 className="mb-2 text-lg font-semibold text-yellow-800">
                    Campaign Target Reached!
                  </h3>
                  <p className="mb-4 text-sm text-yellow-700">
                    The deadline has passed and the target has been met. Claim the
                    raised funds.
                  </p>
                  <button
                    onClick={claimFunds}
                    disabled={isClaimPending}
                    className="rounded-lg bg-yellow-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isClaimPending ? "Claiming..." : "Claim Funds"}
                  </button>
                </div>
              );
            }

            if (deadlinePassed && !targetMet) {
              return (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
                  <svg className="mx-auto mb-2 h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-lg font-semibold text-red-800">Campaign Failed</p>
                  <p className="mt-1 text-sm text-red-600">
                    The deadline passed without reaching the target.
                  </p>
                </div>
              );
            }

            return null;
          })()}

          {!(() => {
            const now = Math.floor(Date.now() / 1000);
            return now > campaign.deadlineTimestamp;
          })() && (
            <ContributeForm
              txStatus={txState.status}
              onContribute={contribute}
            />
          )}

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
