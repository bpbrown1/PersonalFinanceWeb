export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'loan';
export type AccountClassification = 'asset' | 'liability';
export type InterestRateType = 'apy' | 'apr';

export interface FinancialAccount {
  id: string;
  ownerId: string;
  name: string;
  type: AccountType;
  classification: AccountClassification;
  currency: string;
  openingDate: string;
  openingBalance: number;
  currentBalance: number;
  interestRate: number | null;
  interestRateType: InterestRateType | null;
  status: AccountStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AccountStatus = 'active' | 'archived';
export type AccountStatusFilter = AccountStatus | 'all';

export interface CreateFinancialAccountRequest {
  name: string;
  type: AccountType;
  currency: string;
  openingDate: string;
  openingBalance?: number;
  interestRate?: number;
  interestRateType?: InterestRateType;
}

export interface UpdateFinancialAccountRequest {
  name?: string;
  type?: AccountType;
  currency?: string;
  openingDate?: string;
  openingBalance?: number;
  interestRate?: number | null;
  interestRateType?: InterestRateType | null;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  fieldErrors: Record<string, string>;
  existingBudgetId?: string;
}
