import { Injectable } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { service, factories } from 'powerbi-client';

export interface PowerBiEmbedConfig {
  type: 'report';
  embedUrl: string;
  accessToken: string;
  tokenType: 'Aad';
  id: string;
  settings?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class PowerBiEmbedService {
  private readonly reportId = 'b3a13b24-bf65-4ea2-8238-b9e1b6354178'; // Replace with your report ID
  private readonly groupId = 'your-workspace-id'; // Replace with your workspace ID
  private readonly embedUrl = `https://app.powerbi.com/groups/${this.groupId}/reports/${this.reportId}`;

  private powerbi = new service.Service(
    factories.hpmFactory,
    factories.wpmpFactory,
    factories.routerFactory
  );

  constructor(private msalService: MsalService) {}

  async getEmbedConfig(): Promise<PowerBiEmbedConfig> {
    const account = this.msalService.instance.getActiveAccount();
    if (!account) {
      throw new Error('User not authenticated');
    }

    const tokenRequest = {
      scopes: ['https://analysis.windows.net/powerbi/api/.default'],
      account: account
    };

    const tokenResponse = await this.msalService.instance.acquireTokenSilent(tokenRequest);

    return {
      type: 'report',
      embedUrl: this.embedUrl,
      accessToken: tokenResponse.accessToken,
      tokenType: 'Aad',
      id: this.reportId,
      settings: {
        filterPaneEnabled: false,
        navContentPaneEnabled: false
      }
    };
  }

  embedReport(container: HTMLElement, config: PowerBiEmbedConfig): unknown {
    return this.powerbi.embed(container, config as any);
  }
}
