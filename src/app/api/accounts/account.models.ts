export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'loan';

export interface FinancialAccount {
  id: string;
  ownerId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingDate: string;
  openingBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialAccountRequest {
  name: string;
  type: AccountType;
  currency: string;
  openingDate: string;
  openingBalance?: number;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  fieldErrors: Record<string, string>;
}
