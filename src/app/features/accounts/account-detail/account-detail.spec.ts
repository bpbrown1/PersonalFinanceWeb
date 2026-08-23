import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountsApiService } from '../../../api/accounts/accounts-api.service';
import { FinancialAccount } from '../../../api/accounts/account.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { NotificationService } from '../../../core/notification.service';
import { AccountDetail } from './account-detail';

describe('AccountDetail', () => {
  const account = accountFixture();
  let api: Record<string, ReturnType<typeof vi.fn>>; let notifications: { show: ReturnType<typeof vi.fn> }; let presenter: { present: ReturnType<typeof vi.fn> }; let router: Router;
  beforeEach(async () => {
    api = { get:vi.fn().mockReturnValue(of(account)), update:vi.fn().mockReturnValue(of({ ...account, name:'Primary Checking' })), archive:vi.fn().mockReturnValue(of({ ...account, status:'archived' })), restore:vi.fn().mockReturnValue(of(account)) };
    notifications={show:vi.fn()}; presenter={present:vi.fn((error)=>error)};
    await TestBed.configureTestingModule({ imports:[AccountDetail], providers:[provideRouter([]),
      {provide:ActivatedRoute,useValue:{snapshot:{paramMap:{get:()=>account.id}}}}, {provide:AccountsApiService,useValue:api},
      {provide:NotificationService,useValue:notifications}, {provide:ApiErrorPresenter,useValue:presenter}] }).compileComponents();
    router=TestBed.inject(Router); vi.spyOn(router,'navigate').mockResolvedValue(true);
  });

  it('loads account detail and populates a pristine form', () => {
    const fixture=TestBed.createComponent(AccountDetail); fixture.detectChanges();
    expect(api['get']).toHaveBeenCalledWith(account.id);
    expect(fixture.nativeElement.textContent).toContain('Everyday Checking');
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
    expect(fixture.nativeElement.querySelector('a[href="/accounts/account-1/history"]')).not.toBeNull();
  });

  it('patches only changed fields and resets dirty state after success', () => {
    const fixture=TestBed.createComponent(AccountDetail); fixture.detectChanges();
    const form=(fixture.componentInstance as any).form; form.controls.name.setValue('  Primary Checking  '); form.controls.name.markAsDirty();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(api['update']).toHaveBeenCalledWith(account.id,{name:'Primary Checking'});
    expect(notifications.show).toHaveBeenCalledWith('Primary Checking was updated.','success');
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
  });

  it('retains server field errors and protects the current route', () => {
    const error=new AppHttpError('validation','Validation failed',400,{name:'Name is invalid'}); api['update'].mockReturnValue(throwError(()=>error));
    const fixture=TestBed.createComponent(AccountDetail); fixture.detectChanges(); const form=(fixture.componentInstance as any).form;
    form.controls.name.setValue('Changed'); form.controls.name.markAsDirty(); fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit')); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Name is invalid'); expect(fixture.componentInstance.hasPendingChanges()).toBe(true);
  });

  it('confirms archive and returns to the accounts list', () => {
    vi.spyOn(globalThis,'confirm').mockReturnValue(true);
    const fixture=TestBed.createComponent(AccountDetail); fixture.detectChanges(); fixture.nativeElement.querySelector('.danger-button').click();
    expect(api['archive']).toHaveBeenCalledWith(account.id); expect(router.navigate).toHaveBeenCalledWith(['/accounts']);
  });
});

function accountFixture(): FinancialAccount {
  return { id:'account-1',ownerId:'owner-1',name:'Everyday Checking',type:'checking',currency:'USD',openingDate:'2026-08-22',openingBalance:1250.75,currentBalance:1250.75,status:'active',archivedAt:null,createdAt:'2026-08-22T18:30:00Z',updatedAt:'2026-08-22T18:30:00Z' };
}
