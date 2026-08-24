export type CashFlowTransactionType = 'income' | 'expense';
export type TransactionType = CashFlowTransactionType | 'transfer_out' | 'transfer_in';
export type TransactionStatus = 'active' | 'deleted';
export type TransactionStatusFilter = TransactionStatus | 'all';
export type TransactionSortField = 'date' | 'amount';
export type SortDirection = 'asc' | 'desc';

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

export interface TransactionSearchCriteria {
  status?: TransactionStatusFilter;
  accountId?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  type?: TransactionType;
  minAmount?: number;
  maxAmount?: number;
  text?: string;
  page?: number;
  size?: number;
  sort?: TransactionSortField;
  direction?: SortDirection;
}

export interface TransactionSummaryCriteria {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
}

export interface TransactionPage {
  items: FinancialTransaction[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  sortBy: TransactionSortField;
  sortDirection: SortDirection;
}
