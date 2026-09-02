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
  committed: number;
  scheduledTarget: number;
  outstandingScheduledTarget: number;
  totalBudgeted: number;
  remainingAfterCommitments: number;
  underfunded: boolean;
  scheduledCommitments: BudgetScheduledCommitment[];
  flexibleActual: number;
  billActual: number;
  actual: number;
  remaining: number;
  percentageUsed: number | null;
  percentSpent: number | null;
  projectedUsage: number;
  projectedRemaining: number;
  projectedPercentage: number | null;
  drillDown: BudgetProgressDrillDown;
}

export type BudgetProgressComponentSource = 'flexible' | 'recurring';
export type BudgetProgressComponentStatus = 'outstanding' | 'satisfied';

export interface BudgetProgressComponent {
  componentKey: string;
  source: BudgetProgressComponentSource;
  lineId: string | null;
  occurrenceKey: string | null;
  recurringExpenseId: string | null;
  categoryId: string;
  position: number | null;
  name: string | null;
  dueDate: string | null;
  target: number;
  actual: number;
  remaining: number;
  percentageUsed: number | null;
  projectedUsage: number;
  projectedRemaining: number;
  projectedPercentage: number | null;
  status: BudgetProgressComponentStatus;
  variance: number | null;
  linkedTransactionId: string | null;
  drillDown: BudgetProgressDrillDown;
}

export interface UnbudgetedProgress {
  categoryId: string | null;
  actual: number;
  drillDown: BudgetProgressDrillDown;
}

export interface BudgetScheduledCommitment {
  occurrenceKey: string;
  recurringExpenseId: string;
  name: string;
  dueDate: string;
  amount: number;
  currency: string;
  categoryId: string;
  accountId: string | null;
  satisfied: boolean;
  actualAmount: number | null;
  variance: number | null;
  linkedTransactionId: string | null;
}

export interface UnbudgetedCommitment {
  categoryId: string;
  committed: number;
  scheduledTarget: number;
  outstandingScheduledTarget: number;
  totalBudgeted: number;
  billActual: number;
  actual: number;
  remaining: number;
  percentSpent: number | null;
  projectedUsage: number;
  projectedRemaining: number;
  projectedPercentage: number | null;
  scheduledCommitments: BudgetScheduledCommitment[];
}

export type BudgetAllocationState = 'allocated' | 'covered_by_ancestor' | 'unbudgeted';

export interface BudgetCategoryPathSegment {
  categoryId: string;
  name: string;
}

export interface BudgetCategoryProgress {
  categoryId: string;
  categoryName: string;
  path: BudgetCategoryPathSegment[];
  categoryStatus: BudgetStatus;
  allocationState: BudgetAllocationState;
  lineId: string | null;
  directPlanned: number;
  directScheduledTarget: number;
  directTarget: number;
  rollupTarget: number;
  directFlexibleActual: number;
  directBillActual: number;
  directActual: number;
  rollupActual: number;
  remaining: number;
  percentageUsed: number | null;
  descendantAllocationCount: number;
  children: BudgetCategoryProgress[];
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
  committed: number;
  scheduledTarget: number;
  outstandingScheduledTarget: number;
  totalBudgeted: number;
  remainingAfterCommitments: number;
  underfunded: boolean;
  flexibleActual: number;
  billActual: number;
  budgetedActual: number;
  unbudgetedActual: number;
  totalActual: number;
  remaining: number;
  percentageUsed: number | null;
  percentSpent: number | null;
  projectedUsage: number;
  projectedRemaining: number;
  projectedPercentage: number | null;
  lines: BudgetLineProgress[];
  components: BudgetProgressComponent[];
  unbudgeted: UnbudgetedProgress[];
  unbudgetedCommitments: UnbudgetedCommitment[];
  hierarchy: BudgetCategoryProgress[];
  drillDown: BudgetProgressDrillDown;
}

export interface BudgetProgressFilters {
  accountId?: string;
  categoryId?: string;
}
