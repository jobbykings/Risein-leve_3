export interface CampaignState {
  totalRaised: number;
  target: number;
  deadlineTimestamp: number;
  /** Ledger-time truth from the contract (not the client clock). */
  deadlinePassed: boolean;
  isClaimed: boolean;
}

export type TxStatus = "idle" | "awaiting_approval" | "validating" | "success" | "failure";

export interface TxState {
  status: TxStatus;
  hash: string | null;
  error: string | null;
}
