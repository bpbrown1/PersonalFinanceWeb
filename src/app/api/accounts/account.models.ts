export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'loan';

export interface FinancialAccount {
  id: string;
  ownerId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingDate: string;
  openingBalance: number;
  currentBalance: number;
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
}

export interface UpdateFinancialAccountRequest {
  name?: string;
  type?: AccountType;
  currency?: string;
  openingDate?: string;
  openingBalance?: number;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  fieldErrors: Record<string, string>;
}
