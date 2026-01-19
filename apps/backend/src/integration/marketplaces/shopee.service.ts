import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface ShopeeTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sellerId: string;
}

@Injectable()
export class ShopeeService {
  private readonly logger = new Logger(ShopeeService.name);
  private readonly baseUrl = 'https://partner.shopeemobile.com';

  constructor(private configService: ConfigService) {}

  /**
   * Generate Shopee API signature
   */
  private generateSignature(path: string, timestamp: number): string {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const partnerKey = this.configService.get<string>('SHOPEE_PARTNER_KEY');

    const baseString = `${partnerId}${path}${timestamp}`;
    return crypto
      .createHmac('sha256', partnerKey!)
      .update(baseString)
      .digest('hex');
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(state: string): string {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const redirectUri = this.configService.get<string>('SHOPEE_REDIRECT_URI');
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/shop/auth_partner';

    const sign = this.generateSignature(path, timestamp);

    const params = new URLSearchParams({
      partner_id: partnerId!,
      timestamp: timestamp.toString(),
      sign,
      redirect: redirectUri!,
    });

    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<ShopeeTokens> {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/token/get';

    const sign = this.generateSignature(path, timestamp);

    const response = await fetch(
      `${this.baseUrl}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          partner_id: parseInt(partnerId!, 10),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to exchange Shopee code:', error);
      throw new Error('Failed to exchange authorization code');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || 'Shopee API error');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expire_in,
      sellerId: data.shop_id.toString(),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<ShopeeTokens> {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/access_token/get';

    const sign = this.generateSignature(path, timestamp);

    const response = await fetch(
      `${this.baseUrl}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
          partner_id: parseInt(partnerId!, 10),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to refresh Shopee token:', error);
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || 'Shopee API error');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expire_in,
      sellerId: data.shop_id.toString(),
    };
  }

  /**
   * Fetch orders from Shopee
   */
  async fetchOrders(
    accessToken: string,
    shopId: string,
    startDate: Date,
    endDate: Date,
    cursor?: string,
  ): Promise<{ orders: any[]; nextCursor?: string; hasMore: boolean }> {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/order/get_order_list';

    const sign = this.generateSignature(path, timestamp);

    const params = new URLSearchParams({
      partner_id: partnerId!,
      timestamp: timestamp.toString(),
      sign,
      access_token: accessToken,
      shop_id: shopId,
      time_range_field: 'create_time',
      time_from: Math.floor(startDate.getTime() / 1000).toString(),
      time_to: Math.floor(endDate.getTime() / 1000).toString(),
      page_size: '100',
    });

    if (cursor) {
      params.set('cursor', cursor);
    }

    const response = await fetch(`${this.baseUrl}${path}?${params.toString()}`);

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to fetch Shopee orders:', error);
      throw new Error('Failed to fetch orders from Shopee');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || 'Shopee API error');
    }

    return {
      orders: data.response?.order_list || [],
      nextCursor: data.response?.next_cursor,
      hasMore: data.response?.more || false,
    };
  }

  /**
   * Map Shopee order status to internal status
   */
  mapOrderStatus(shopeeStatus: string): string {
    const statusMap: Record<string, string> = {
      UNPAID: 'PENDING',
      READY_TO_SHIP: 'PAID',
      PROCESSED: 'PAID',
      SHIPPED: 'SHIPPED',
      COMPLETED: 'DELIVERED',
      IN_CANCEL: 'CANCELLED',
      CANCELLED: 'CANCELLED',
    };

    return statusMap[shopeeStatus] || 'PENDING';
  }
}
