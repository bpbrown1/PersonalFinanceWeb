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

export interface CopyBudgetRequest {
  targetMonth: string;
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

export interface BudgetProgressDrillDown {
  from: string;
  to: string;
  accountId: string | null;
  categoryIds: string[];
  type: 'expense';
  status: 'active';
  transactionIds: string[];
  transactionsPath: string;
}

export interface BudgetProgressTransactionPageCriteria {
  page: number;
  size: number;
  sort: 'date' | 'amount';
  direction: 'asc' | 'desc';
}

export interface BudgetLineProgress {
  lineId: string;
  categoryId: string;
  position: number;
  planned: number;
  actual: number;
  remaining: number;
  percentageUsed: number | null;
  drillDown: BudgetProgressDrillDown;
}

export interface UnbudgetedProgress {
  categoryId: string | null;
  actual: number;
  drillDown: BudgetProgressDrillDown;
}

export interface BudgetProgress {
  budgetId: string;
  ownerId: string;
  currency: string;
  startDate: string;
  endDate: string;
  accountId: string | null;
  categoryId: string | null;
  planned: number;
  budgetedActual: number;
  unbudgetedActual: number;
  totalActual: number;
  remaining: number;
  percentageUsed: number | null;
  lines: BudgetLineProgress[];
  unbudgeted: UnbudgetedProgress[];
  drillDown: BudgetProgressDrillDown;
}

export interface BudgetProgressFilters {
  accountId?: string;
  categoryId?: string;
}
