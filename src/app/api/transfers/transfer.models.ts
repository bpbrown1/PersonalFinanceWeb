import { TransactionStatus, TransactionStatusFilter } from '../transactions/transaction.models';

export type { TransactionStatus, TransactionStatusFilter };

export interface FinancialTransfer {
  id: string;
  ownerId: string;
  sourceTransactionId: string;
  destinationTransactionId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: number;
  destinationAmount: number;
  transactionDate: string;
  description: string;
  notes: string | null;
  externalReference: string | null;
  status: TransactionStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: number;
  destinationAmount: number;
  transactionDate: string;
  description: string;
  notes: string | null;
  externalReference: string | null;
}
