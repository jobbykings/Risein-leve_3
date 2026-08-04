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
    live,
    liveEventCount,
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

  const openWalletModal = useCallback(() => setModalOpen(true), []);

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Crowdfund Campaign
        </h1>

        {address ? (
          <div className="flex flex-wrap items-center gap-3">
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live{liveEventCount > 0 && ` · ${liveEventCount} new`}
              </span>
            )}
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
              onClick={() => refreshCampaign()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live{liveEventCount > 0 && ` · ${liveEventCount} new`}
              </span>
            )}
            <button
              onClick={openWalletModal}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      {campaignLoading ? (
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
            const deadlinePassed = campaign.deadlinePassed;
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
                    onClick={address ? claimFunds : openWalletModal}
                    disabled={address ? isClaimPending : false}
                    className="rounded-lg bg-yellow-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {address
                      ? isClaimPending
                        ? "Claiming..."
                        : "Claim Funds"
                      : "Connect to Claim"}
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

          {!campaign.deadlinePassed && (
            <ContributeForm
              txStatus={txState.status}
              isConnected={!!address}
              onConnect={openWalletModal}
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
