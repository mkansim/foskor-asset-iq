import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseAuthService } from '../services/firebase-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private auth: FirebaseAuthService, private router: Router) {}

  async login(): Promise<void> {
    this.error = '';
    this.loading = true;

    try {
      await this.auth.signIn(this.email, this.password);
      await this.router.navigate(['/reports']);
    } catch (err: unknown) {
      this.error = this.getErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  resetPassword(): void {
    alert('Password reset link has been sent.');
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}
