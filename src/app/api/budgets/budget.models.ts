export type BudgetStatus = 'active' | 'archived';
export type BudgetStatusFilter = BudgetStatus | 'all';
export type BudgetPeriodType = 'monthly';

export interface BudgetLine {
  id: string;
  position: number;
  categoryId: string;
  plannedAmount: number;
  status: BudgetStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  ownerId: string;
  name: string;
  currency: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  totalPlanned: number;
  lines: BudgetLine[];
  status: BudgetStatus;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBudgetLineRequest {
  categoryId: string;
  plannedAmount: number;
}

export interface CreateBudgetRequest {
  name: string;
  currency: string;
  startDate: string;
  endDate: string;
  lines: SaveBudgetLineRequest[];
}

export interface UpdateBudgetRequest {
  name: string;
  currency: string;
  startDate: string;
  endDate: string;
}

export interface ReorderBudgetLinesRequest {
  lineIds: string[];
}
