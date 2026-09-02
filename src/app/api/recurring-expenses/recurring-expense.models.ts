export type RecurringExpenseStatus = 'active' | 'archived';
export type RecurringExpenseStatusFilter = RecurringExpenseStatus | 'all';

export interface RecurringExpense {
  id: string;
  ownerId: string;
  name: string;
  amount: number;
  currency: string;
  categoryId: string;
  accountId: string | null;
  anchorDate: string;
  endDate: string | null;
  intervalMonths: number;
  status: RecurringExpenseStatus;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveRecurringExpenseRequest {
  name: string;
  amount: number;
  currency: string;
  categoryId: string;
  accountId: string | null;
  anchorDate: string;
  endDate: string | null;
  intervalMonths: number;
}

export interface RecurringExpenseOccurrence {
  occurrenceKey: string;
  recurringExpenseId: string;
  name: string;
  dueDate: string;
  amount: number;
  targetAmount: number;
  actualAmount: number | null;
  variance: number | null;
  status: 'outstanding' | 'satisfied';
  linkedTransaction: RecurringExpenseLinkedTransaction | null;
  currency: string;
  categoryId: string;
  accountId: string | null;
}

export interface RecurringExpenseLinkedTransaction {
  id: string;
  accountId: string;
  categoryId: string;
  transactionDate: string;
  amount: number;
  description: string;
  active: boolean;
}

export interface RecurringExpenseOccurrenceSelection {
  recurringExpenseId: string;
  dueDate: string;
}
