import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageState } from '../../../shared/page-state/page-state';

@Component({
  selector: 'app-accounts-page',
  imports: [RouterLink, PageState],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage {}
