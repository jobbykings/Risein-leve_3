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
import { Client, networks } from "@/contracts/crowdfund-client";
import type { CampaignState, TxState } from "@/types";
import { UserRejected, InsufficientFunds } from "@/utils/errors";

const MODULES = [new FreighterModule(), new xBullModule(), new AlbedoModule()];
const RPC_URL = "https://soroban-testnet.stellar.org";
const CACHE_KEY = "crowdfund_campaign";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedCampaign {
  data: CampaignState;
  cachedAt: number;
}

export interface CrowdfundContextValue {
  address: string | null;
  isConnecting: boolean;
  handleConnected: (addr: string) => void;
  disconnectWallet: () => void;
  campaign: CampaignState | null;
  campaignLoading: boolean;
  txState: TxState;
  explorerUrl: string | null;
  contribute: (amount: number) => Promise<void>;
  refreshCampaign: () => Promise<void>;
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [campaign, setCampaign] = useState<CampaignState | null>(loadCached);
  const [campaignLoading, setCampaignLoading] = useState(!campaign);
  const [txState, setTxState] = useState<TxState>({
    status: "idle",
    hash: null,
    error: null,
  });
  const clientRef = useRef<Client | null>(null);
  const kitInitRef = useRef(false);

  useEffect(() => {
    if (kitInitRef.current) return;
    kitInitRef.current = true;
    StellarWalletsKit.init({
      modules: MODULES,
      network: Networks.TESTNET,
    });
  }, []);

  useEffect(() => {
    if (!address) {
      clientRef.current = null;
      return;
    }

    const client = new Client({
      contractId: networks.testnet.contractId,
      networkPassphrase: networks.testnet.networkPassphrase,
      rpcUrl: RPC_URL,
      publicKey: address,
      signTransaction: (xdr, opts) =>
        StellarWalletsKit.signTransaction(xdr, {
          networkPassphrase: opts?.networkPassphrase,
          address: opts?.address,
        }),
    });

    clientRef.current = client;
    refreshCampaign();
  }, [address]);

  const refreshCampaign = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    setCampaignLoading(true);
    try {
      const { result } = await client.get_status();
      const data: CampaignState = {
        totalRaised: Number(result[0]),
        target: Number(result[1]),
        deadlineTimestamp: Number(result[2]),
        isClaimed: Number(result[4]) === 1,
      };
      setCampaign(data);
      saveCache(data);
    } catch {
    } finally {
      setCampaignLoading(false);
    }
  }, []);

  const handleConnected = useCallback((addr: string) => {
    setAddress(addr);
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch {
    }
    setAddress(null);
    setCampaign(null);
    setTxState({ status: "idle", hash: null, error: null });
  }, []);

  const resetTx = useCallback(() => {
    setTxState({ status: "idle", hash: null, error: null });
  }, []);

  const contribute = useCallback(
    async (amount: number) => {
      const client = clientRef.current;
      if (!client || !address) return;

      setTxState({ status: "awaiting_approval", hash: null, error: null });

      try {
        const tx = await client.fund({ donor: address, amount });
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
            mapped = new InsufficientFunds("~0.01 XLM", "0 XLM");
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
        isConnecting,
        handleConnected,
        disconnectWallet,
        campaign,
        campaignLoading,
        txState,
        explorerUrl,
        contribute,
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
