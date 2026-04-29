import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { CommonModule } from '@angular/common';
import { FirebaseAuthService } from './services/firebase-auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'foskor asset intelligence';

  menuOpen = false;
  sidebarCollapsed = false;

  dataManagementOpen = false;
  reportsOpen = false;

  isAuthenticated = false;
  loggedInEmail: string | null = null;
  hideNavigation = false;

  private subscription = new Subscription();

  constructor(
    private auth: FirebaseAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.auth.currentUser$.subscribe(user => {
        this.isAuthenticated = !!user;
        this.loggedInEmail = user?.email ?? null;
      })
    );

    this.hideNavigation = this.router.url === '/login';

    this.setOpenMenusFromRoute(this.router.url);

    this.subscription.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(event => {
          const navigationEnd = event as NavigationEnd;

          this.hideNavigation = navigationEnd.urlAfterRedirects === '/login';
          this.menuOpen = false;

          this.setOpenMenusFromRoute(navigationEnd.urlAfterRedirects);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  login(): void {
    this.router.navigate(['/login']);
  }

  logout(): void {
    this.auth.signOut();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMobileMenu(): void {
    this.menuOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;

    if (this.sidebarCollapsed) {
      this.dataManagementOpen = false;
      this.reportsOpen = false;
    }
  }

  toggleDataManagement(): void {
    if (this.sidebarCollapsed) {
      this.sidebarCollapsed = false;
      this.dataManagementOpen = true;
      this.reportsOpen = false;
      return;
    }

    this.dataManagementOpen = !this.dataManagementOpen;

    if (this.dataManagementOpen) {
      this.reportsOpen = false;
    }
  }

  toggleReports(): void {
    if (this.sidebarCollapsed) {
      this.sidebarCollapsed = false;
      this.reportsOpen = true;
      this.dataManagementOpen = false;
      return;
    }

    this.reportsOpen = !this.reportsOpen;

    if (this.reportsOpen) {
      this.dataManagementOpen = false;
    }
  }

  private setOpenMenusFromRoute(url: string): void {
    this.dataManagementOpen = url.startsWith('/data-management');

    this.reportsOpen =
      url.startsWith('/issue-list') ||
      url.startsWith('/downtime-report') ||
      url.startsWith('/reports');
  }
}