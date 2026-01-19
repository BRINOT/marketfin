import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AmazonTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sellerId?: string;
}

@Injectable()
export class AmazonService {
  private readonly logger = new Logger(AmazonService.name);
  private readonly authUrl = 'https://sellercentral.amazon.com.br';
  private readonly apiUrl = 'https://sellingpartnerapi-na.amazon.com';

  constructor(private configService: ConfigService) {}

  /**
   * Get OAuth authorization URL for Amazon SP-API
   */
  getAuthUrl(state: string): string {
    const clientId = this.configService.get<string>('AMAZON_CLIENT_ID');
    const redirectUri = this.configService.get<string>('AMAZON_REDIRECT_URI');

    const params = new URLSearchParams({
      application_id: clientId!,
      redirect_uri: redirectUri!,
      state,
      version: 'beta',
    });

    return `${this.authUrl}/apps/authorize/consent?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens using LWA (Login with Amazon)
   */
  async exchangeCode(code: string): Promise<AmazonTokens> {
    const clientId = this.configService.get<string>('AMAZON_CLIENT_ID');
    const clientSecret = this.configService.get<string>('AMAZON_CLIENT_SECRET');

    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to exchange Amazon code:', error);
      throw new Error('Failed to exchange authorization code');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AmazonTokens> {
    const clientId = this.configService.get<string>('AMAZON_CLIENT_ID');
    const clientSecret = this.configService.get<string>('AMAZON_CLIENT_SECRET');

    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId!,
        client_secret: clientSecret!,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to refresh Amazon token:', error);
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Fetch orders from Amazon SP-API
   * Note: Requires AWS Signature Version 4 signing
   */
  async fetchOrders(
    accessToken: string,
    startDate: Date,
    endDate: Date,
    nextToken?: string,
  ): Promise<{ orders: any[]; nextToken?: string }> {
    // In production, this would use AWS SDK for proper request signing
    // This is a simplified example
    
    const params = new URLSearchParams({
      MarketplaceIds: 'MLB', // Brazil marketplace
      CreatedAfter: startDate.toISOString(),
      CreatedBefore: endDate.toISOString(),
    });

    if (nextToken) {
      params.set('NextToken', nextToken);
    }

    const response = await fetch(
      `${this.apiUrl}/orders/v0/orders?${params.toString()}`,
      {
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to fetch Amazon orders:', error);
      throw new Error('Failed to fetch orders from Amazon');
    }

    const data = await response.json();

    return {
      orders: data.payload?.Orders || [],
      nextToken: data.payload?.NextToken,
    };
  }

  /**
   * Map Amazon order status to internal status
   */
  mapOrderStatus(amazonStatus: string): string {
    const statusMap: Record<string, string> = {
      Pending: 'PENDING',
      Unshipped: 'PAID',
      PartiallyShipped: 'SHIPPED',
      Shipped: 'SHIPPED',
      Delivered: 'DELIVERED',
      Canceled: 'CANCELLED',
      Unfulfillable: 'CANCELLED',
    };

    return statusMap[amazonStatus] || 'PENDING';
  }
}
