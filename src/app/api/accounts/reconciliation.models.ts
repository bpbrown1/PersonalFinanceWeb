import { CashFlowTransactionType } from '../transactions/transaction.models';

export interface ReconciliationPreviewRequest {
  statementDate: string;
  statementBalance: number;
}

export interface ReconciliationPreview extends ReconciliationPreviewRequest {
  accountId: string;
  currency: string;
  calculatedBalance: number;
  difference: number;
  adjustmentType: CashFlowTransactionType | null;
  transactionCount: number;
  ledgerToken: string;
}

export interface ConfirmReconciliationRequest extends ReconciliationPreviewRequest {
  ledgerToken: string;
  categoryId: string | null;
  explanation: string | null;
}

export interface AccountReconciliation {
  id: string;
  accountId: string;
  statementDate: string;
  statementBalance: number;
  calculatedBalance: number;
  difference: number;
  ledgerToken: string;
  explanation: string;
  transactionId: string | null;
  createdAt: string;
}

export interface ReconciliationPage {
  items: AccountReconciliation[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
