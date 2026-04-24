import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { filter, map, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private auth: FirebaseAuthService, private router: Router) {}

  canActivate() {
    return this.auth.currentUser$.pipe(
      filter(value => value !== undefined),
      take(1),
      map(user => {
        if (user) {
          return true;
        }

        this.router.navigate(['/login']);
        return false;
      })
    );
  }
}
