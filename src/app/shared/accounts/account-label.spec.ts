import { FinancialAccount } from '../../api/accounts/account.models';
import { accountIdentifierLabel, accountLabel } from './account-label';

describe('account label', () => {
  it('uses safe metadata in a consistent order and masks the suffix', () => {
    const account = accountFixture();

    expect(accountLabel(account)).toBe(
      'Everyday Checking · Example Bank · Checking · USD · •••• 1234',
    );
    expect(accountIdentifierLabel(account)).toBe('Example Bank · Checking · USD · •••• 1234');
  });

  it('omits unavailable optional metadata without leaving empty separators', () => {
    expect(
      accountLabel(
        accountFixture({
          name: 'Wallet',
          institutionName: null,
          accountNumberLastFour: null,
          type: 'cash',
        }),
      ),
    ).toBe('Wallet · Cash · USD');
  });
});

function accountFixture(overrides: Partial<FinancialAccount> = {}): FinancialAccount {
  return {
    id: 'account-1',
    ownerId: 'owner-1',
    name: 'Everyday Checking',
    type: 'checking',
    classification: 'asset',
    currency: 'USD',
    openingDate: '2026-09-01',
    openingBalance: 100,
    currentBalance: 100,
    interestRate: null,
    interestRateType: null,
    institutionName: 'Example Bank',
    accountNumberLastFour: '1234',
    status: 'active',
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}
