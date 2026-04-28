import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FirebaseAuthService } from './services/firebase-auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'foskor asset intelligence';
  menuOpen = false;
  isAuthenticated = false;
  loggedInEmail: string | null = null;
  hideNavigation = false;
  sidebarCollapsed = false;

  private subscription = new Subscription();

  constructor(private auth: FirebaseAuthService, private router: Router) {}

  ngOnInit(): void {
    this.subscription.add(
      this.auth.currentUser$.subscribe(user => {
        this.isAuthenticated = !!user;
        this.loggedInEmail = user?.email ?? null;
      })
    );

    this.hideNavigation = this.router.url === '/login';

    this.subscription.add(
      this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
        this.hideNavigation = this.router.url === '/login';
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

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
}
}
