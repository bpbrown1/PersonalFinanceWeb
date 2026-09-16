import { AccountType, FinancialAccount } from '../../api/accounts/account.models';

type AccountLabelSource = Pick<
  FinancialAccount,
  'name' | 'institutionName' | 'type' | 'currency' | 'accountNumberLastFour'
>;

export function accountTypeLabel(type: AccountType): string {
  return {
    checking: 'Checking',
    savings: 'Savings',
    cash: 'Cash',
    credit_card: 'Credit card',
    loan: 'Loan',
  }[type];
}

export function accountIdentifierLabel(account: AccountLabelSource): string {
  return [
    account.institutionName,
    accountTypeLabel(account.type),
    account.currency,
    account.accountNumberLastFour ? `•••• ${account.accountNumberLastFour}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

export function accountLabel(account: AccountLabelSource): string {
  return `${account.name} · ${accountIdentifierLabel(account)}`;
}
