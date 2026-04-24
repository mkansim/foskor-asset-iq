import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { auth } from '../firebase.config';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private currentUserSubject = new BehaviorSubject<User | null | undefined>(undefined);
  currentUser$: Observable<User | null | undefined> = this.currentUserSubject.asObservable();

  constructor(private router: Router) {
    onAuthStateChanged(auth, user => {
      this.currentUserSubject.next(user);
    });
  }

  async signIn(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  }

  async signOut(): Promise<void> {
    await signOut(auth);
    this.router.navigate(['/login']);
  }

  get isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }
}
