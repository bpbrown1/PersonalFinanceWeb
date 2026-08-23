import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CategoriesApiService } from '../../../api/categories/categories-api.service';
import { CategoryStatusFilter, TransactionCategory } from '../../../api/categories/category.models';
import { ApiErrorPresenter } from '../../../api/errors/api-error-presenter.service';
import { AppHttpError } from '../../../api/errors/app-http-error';
import { NotificationService } from '../../../core/notification.service';
import { CategoriesPage } from './categories-page';

describe('CategoriesPage', () => {
  let api: Record<'list'|'create'|'update'|'archive'|'restore',ReturnType<typeof vi.fn>>;
  let notifications: { show: ReturnType<typeof vi.fn> }; let presenter: { present: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api={
      list:vi.fn((status:CategoryStatusFilter)=>of(status==='archived'?[categoryFixture({status:'archived',archivedAt:'2026-08-23T12:00:00Z'})]:[categoryFixture()])),
      create:vi.fn().mockReturnValue(of(categoryFixture())), update:vi.fn().mockReturnValue(of(categoryFixture({name:'Food'}))),
      archive:vi.fn().mockReturnValue(of(categoryFixture({status:'archived'}))), restore:vi.fn().mockReturnValue(of(categoryFixture())),
    };
    notifications={show:vi.fn()}; presenter={present:vi.fn((error)=>error)};
    await TestBed.configureTestingModule({imports:[CategoriesPage],providers:[
      {provide:CategoriesApiService,useValue:api},{provide:NotificationService,useValue:notifications},{provide:ApiErrorPresenter,useValue:presenter},
    ]}).compileComponents();
  });

  afterEach(()=>vi.restoreAllMocks());

  it('loads active categories and explains applicability without relying on icons', () => {
    const fixture=TestBed.createComponent(CategoriesPage); fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('active'); expect(fixture.nativeElement.textContent).toContain('Groceries');
    expect(fixture.nativeElement.textContent).toContain('Expense'); expect(fixture.nativeElement.textContent).toContain('Available for new transaction activity.');
  });

  it('loads archived categories and explains that history is retained', () => {
    const fixture=TestBed.createComponent(CategoriesPage); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('.filters button')[1].click(); fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith('archived'); expect(fixture.nativeElement.textContent).toContain('Retained for existing transaction history.');
  });

  it('creates a valid category and refreshes the list', () => {
    const fixture=TestBed.createComponent(CategoriesPage); fixture.detectChanges(); const component=fixture.componentInstance as any;
    component.createForm.setValue({name:'  Groceries  ',applicability:'expense'}); component.create(); fixture.detectChanges();
    expect(api.create).toHaveBeenCalledWith({name:'Groceries',applicability:'expense'}); expect(api.list).toHaveBeenCalledTimes(2);
    expect(notifications.show).toHaveBeenCalledWith('Groceries was added.','success');
  });

  it('updates only changed category fields from the inline editor', () => {
    const fixture=TestBed.createComponent(CategoriesPage); fixture.detectChanges(); const component=fixture.componentInstance as any;
    component.startEdit(categoryFixture()); component.editForm.controls.name.setValue('Food'); component.saveEdit(categoryFixture()); fixture.detectChanges();
    expect(api.update).toHaveBeenCalledWith('category-1',{name:'Food'}); expect(component.editingId()).toBeNull();
  });

  it('confirms archive with retained-history language', () => {
    vi.spyOn(globalThis,'confirm').mockReturnValue(true); const fixture=TestBed.createComponent(CategoriesPage); fixture.detectChanges();
    (fixture.componentInstance as any).archive(categoryFixture());
    expect(globalThis.confirm).toHaveBeenCalledWith('Archive Groceries? Existing transaction history will keep this category.');
    expect(api.archive).toHaveBeenCalledWith('category-1');
  });

  it('shows duplicate-name conflicts inline for create and restore', () => {
    const conflict=new AppHttpError('client','An active transaction category already uses the name: Groceries',409);
    api.create.mockReturnValue(throwError(()=>conflict)); api.restore.mockReturnValue(throwError(()=>conflict));
    const fixture=TestBed.createComponent(CategoriesPage); fixture.detectChanges(); const component=fixture.componentInstance as any;
    component.createForm.setValue({name:'Groceries',applicability:'expense'}); component.create();
    component.restore(categoryFixture({status:'archived'})); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(conflict.userMessage); expect(presenter.present).toHaveBeenCalledWith(conflict);
  });

  it('shows server field validation beside the category name', () => {
    const validation=new AppHttpError('validation','Validation failed',400,{name:'must not be blank'});
    api.create.mockReturnValue(throwError(()=>validation));
    const fixture=TestBed.createComponent(CategoriesPage); fixture.detectChanges(); const component=fixture.componentInstance as any;
    component.createForm.setValue({name:'valid before normalization',applicability:'expense'}); component.create(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#new-category-name-error').textContent).toContain('must not be blank');
  });
});

function categoryFixture(overrides:Partial<TransactionCategory>={}):TransactionCategory {
  return {id:'category-1',ownerId:'owner-1',name:'Groceries',applicability:'expense',status:'active',archivedAt:null,
    createdAt:'2026-08-23T12:00:00Z',updatedAt:'2026-08-23T12:00:00Z',...overrides};
}
