export type BalanceSnapshotSource = 'opening' | 'manual';

export interface BalanceSnapshot {
  id: string;
  accountId: string;
  balance: number;
  effectiveAt: string;
  source: BalanceSnapshotSource;
  createdAt: string;
}

export interface AccountBalanceAsOf {
  accountId: string;
  balance: number;
  effectiveAt: string;
  source: BalanceSnapshotSource;
}
