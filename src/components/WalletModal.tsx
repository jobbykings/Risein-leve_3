"use client";

import { useState, useEffect, useCallback } from "react";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import type { ISupportedWallet } from "@creit.tech/stellar-wallets-kit/types";

const MODULES = [new FreighterModule(), new xBullModule(), new AlbedoModule()];

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (address: string) => void;
}

export default function WalletModal({ isOpen, onClose, onConnect }: WalletModalProps) {
  const [wallets, setWallets] = useState<ISupportedWallet[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      StellarWalletsKit.init({ modules: MODULES, network: Networks.TESTNET });
      const supported = await StellarWalletsKit.refreshSupportedWallets();
      if (!cancelled) setWallets(supported);
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleSelect = useCallback(
    async (walletId: string) => {
      setConnecting(walletId);
      setError(null);
      try {
        StellarWalletsKit.setWallet(walletId);
        const { address } = await StellarWalletsKit.fetchAddress();
        onConnect(address);
        onClose();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to connect wallet";
        setError(message);
      } finally {
        setConnecting(null);
      }
    },
    [onConnect, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Connect Wallet</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">Select a Stellar wallet to connect.</p>
        <ul className="space-y-2">
          {wallets.map((wallet) => {
            const isLoading = connecting === wallet.id;
            return (
              <li key={wallet.id}>
                <button
                  onClick={() => handleSelect(wallet.id)}
                  disabled={isLoading}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    !wallet.isAvailable
                      ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50"
                  } ${isLoading ? "animate-pulse" : ""}`}
                >
                  <img src={wallet.icon} alt={wallet.name} className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{wallet.name}</p>
                    {!wallet.isAvailable && <p className="text-xs text-gray-500">Not detected</p>}
                  </div>
                  {isLoading && (
                    <svg className="h-4 w-4 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
