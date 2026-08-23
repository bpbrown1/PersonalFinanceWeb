export type CategoryApplicability = 'income' | 'expense' | 'both';
export type CategoryStatus = 'active' | 'archived';
export type CategoryStatusFilter = CategoryStatus | 'all';

export interface TransactionCategory {
  id: string;
  ownerId: string;
  name: string;
  applicability: CategoryApplicability;
  status: CategoryStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  applicability: CategoryApplicability;
}

export interface UpdateCategoryRequest {
  name?: string;
  applicability?: CategoryApplicability;
}
