export type CashFlowTransactionType = 'income' | 'expense';
export type TransactionType = CashFlowTransactionType | 'transfer_out' | 'transfer_in';
export type TransactionStatus = 'active' | 'deleted';
export type TransactionStatusFilter = TransactionStatus | 'all';

export interface FinancialTransaction {
  id: string;
  ownerId: string;
  accountId: string;
  categoryId: string | null;
  transferId: string | null;
  amount: number;
  balanceImpact: number;
  type: TransactionType;
  transactionDate: string;
  description: string;
  merchantPayee: string | null;
  notes: string | null;
  externalReference: string | null;
  status: TransactionStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTransactionRequest {
  accountId: string;
  amount: number;
  transactionDate: string;
  description: string;
  type: CashFlowTransactionType;
  categoryId: string | null;
  merchantPayee: string | null;
  notes: string | null;
  externalReference: string | null;
}

export interface TransactionSummary {
  currency: string;
  income: number;
  spending: number;
  netImpact: number;
  transactionCount: number;
}
