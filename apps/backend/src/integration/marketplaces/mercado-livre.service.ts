import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MercadoLivreTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sellerId: string;
}

interface MercadoLivreOrder {
  id: string;
  status: string;
  date_created: string;
  total_amount: number;
  paid_amount: number;
  shipping: {
    id: string;
    cost: number;
  };
  order_items: Array<{
    item: {
      id: string;
      title: string;
      seller_sku: string;
    };
    quantity: number;
    unit_price: number;
  }>;
  buyer: {
    id: string;
    nickname: string;
    email: string;
  };
  shipping_cost: number;
  fee_details: Array<{
    type: string;
    amount: number;
  }>;
}

@Injectable()
export class MercadoLivreService {
  private readonly logger = new Logger(MercadoLivreService.name);
  private readonly baseUrl = 'https://api.mercadolibre.com';
  private readonly authUrl = 'https://auth.mercadolivre.com.br';

  constructor(private configService: ConfigService) {}

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(state: string): string {
    const clientId = this.configService.get<string>('MERCADO_LIVRE_CLIENT_ID');
    const redirectUri = this.configService.get<string>('MERCADO_LIVRE_REDIRECT_URI');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      redirect_uri: redirectUri!,
      state,
    });

    return `${this.authUrl}/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<MercadoLivreTokens> {
    const clientId = this.configService.get<string>('MERCADO_LIVRE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MERCADO_LIVRE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('MERCADO_LIVRE_REDIRECT_URI');

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to exchange code:', error);
      throw new Error('Failed to exchange authorization code');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      sellerId: data.user_id.toString(),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<MercadoLivreTokens> {
    const clientId = this.configService.get<string>('MERCADO_LIVRE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MERCADO_LIVRE_CLIENT_SECRET');

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      sellerId: data.user_id.toString(),
    };
  }

  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    // Mercado Livre doesn't have a token revocation endpoint
    // Tokens expire automatically
    this.logger.log('Token revocation not supported by Mercado Livre API');
  }

  /**
   * Fetch orders from Mercado Livre
   */
  async fetchOrders(
    accessToken: string,
    sellerId: string,
    startDate: Date,
    endDate: Date,
    offset = 0,
    limit = 50,
  ): Promise<{ orders: MercadoLivreOrder[]; total: number }> {
    const params = new URLSearchParams({
      seller: sellerId,
      'order.date_created.from': startDate.toISOString(),
      'order.date_created.to': endDate.toISOString(),
      offset: offset.toString(),
      limit: limit.toString(),
      sort: 'date_desc',
    });

    const response = await fetch(`${this.baseUrl}/orders/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to fetch orders:', error);
      throw new Error('Failed to fetch orders from Mercado Livre');
    }

    const data = await response.json();

    return {
      orders: data.results,
      total: data.paging.total,
    };
  }

  /**
   * Get order details
   */
  async getOrderDetails(accessToken: string, orderId: string): Promise<MercadoLivreOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to fetch order details:', error);
      throw new Error('Failed to fetch order details');
    }

    return response.json();
  }

  /**
   * Get shipping details
   */
  async getShippingDetails(
    accessToken: string,
    shipmentId: string,
  ): Promise<{ cost: number; status: string; tracking_number?: string }> {
    const response = await fetch(`${this.baseUrl}/shipments/${shipmentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to fetch shipping details:', error);
      throw new Error('Failed to fetch shipping details');
    }

    return response.json();
  }

  /**
   * Calculate marketplace fees
   */
  calculateFees(order: MercadoLivreOrder): number {
    if (!order.fee_details || order.fee_details.length === 0) {
      // Default fee calculation (approximately 16% for most categories)
      return order.total_amount * 0.16;
    }

    return order.fee_details.reduce((sum, fee) => sum + fee.amount, 0);
  }

  /**
   * Map Mercado Livre order status to internal status
   */
  mapOrderStatus(mlStatus: string): string {
    const statusMap: Record<string, string> = {
      confirmed: 'PENDING',
      payment_required: 'PENDING',
      payment_in_process: 'PENDING',
      paid: 'PAID',
      partially_paid: 'PAID',
      shipped: 'SHIPPED',
      delivered: 'DELIVERED',
      cancelled: 'CANCELLED',
    };

    return statusMap[mlStatus] || 'PENDING';
  }
}
