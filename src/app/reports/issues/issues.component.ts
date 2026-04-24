import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService } from '@azure/msal-angular';
import { PowerBiEmbedService } from '../../services/powerbi-embed.service';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './issues.component.html',
  styleUrls: ['./issues.component.scss']
})
export class IssuesComponent implements OnInit {
  @ViewChild('embedContainer', { static: true }) embedContainer!: ElementRef<HTMLDivElement>;
  loading = true;
  error = '';

  constructor(private embedService: PowerBiEmbedService, private msalService: MsalService) {}

  ngOnInit(): void {
    this.checkAuthenticationAndLoad();
  }

  private checkAuthenticationAndLoad(): void {
    const accounts = this.msalService.instance.getAllAccounts();

    if (!accounts || accounts.length === 0) {
      this.msalService.loginRedirect({
        scopes: ['https://analysis.windows.net/powerbi/api/.default']
      });
      return;
    }

    if (!this.msalService.instance.getActiveAccount()) {
      this.msalService.instance.setActiveAccount(accounts[0]);
    }

    this.loadPowerBiReport();
  }

  loadPowerBiReport(): void {
    this.embedService.getEmbedConfig().then(config => {
      try {
        this.embedService.embedReport(this.embedContainer.nativeElement, config);
      } catch (embedError) {
        console.error('Power BI embed render failed', embedError);
        this.error = `Unable to render Power BI report: ${this.getErrorMessage(embedError)}`;
      }
      this.loading = false;
    }).catch(err => {
      console.error('Power BI embed config load failed', err);
      this.error = `Unable to load Power BI report configuration: ${this.getErrorMessage(err)}`;
      this.loading = false;
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return JSON.stringify(error);
  }
}
