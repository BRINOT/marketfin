import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const sqs = new SQSClient({});

interface ShopeeWebhook {
  code: number;
  shop_id: number;
  timestamp: number;
  data: {
    ordersn?: string;
    status?: string;
    [key: string]: any;
  };
}

function validateShopeeSignature(
  payload: string,
  signature: string,
  partnerId: string,
  partnerKey: string
): boolean {
  const baseString = `${partnerId}${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', partnerKey)
    .update(baseString)
    .digest('hex');
  return signature === expectedSignature;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const signature = event.headers['Authorization'] || '';
    const partnerId = process.env.SHOPEE_PARTNER_ID || '';
    const partnerKey = process.env.SHOPEE_PARTNER_KEY || '';

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing body' }) };
    }

    // Validate webhook signature
    if (partnerKey && signature) {
      if (!validateShopeeSignature(event.body, signature, partnerId, partnerKey)) {
        console.error('Invalid Shopee webhook signature');
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
      }
    }

    const payload: ShopeeWebhook = JSON.parse(event.body);
    console.log('Received Shopee webhook:', payload.code, payload.shop_id);

    // Map Shopee push codes to event types
    const eventTypeMap: Record<number, string> = {
      0: 'SHOP_AUTHORIZATION',
      1: 'SHOP_DEAUTHORIZATION',
      3: 'ORDER_STATUS_UPDATE',
      4: 'TRACKING_NUMBER_UPDATE',
      5: 'SHOPEE_UPDATES',
      6: 'PROMOTION_UPDATE',
      7: 'RESERVED_STOCK_CHANGE',
      8: 'WEBCHAT_MESSAGE',
      9: 'PRODUCT_UPDATE',
    };

    const eventType = eventTypeMap[payload.code] || `UNKNOWN_${payload.code}`;

    // Send to SQS for processing
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        marketplace: 'SHOPEE',
        eventType,
        code: payload.code,
        shopId: payload.shop_id,
        data: payload.data,
        timestamp: payload.timestamp,
        receivedAt: new Date().toISOString(),
      }),
      MessageAttributes: {
        marketplace: { DataType: 'String', StringValue: 'SHOPEE' },
        eventType: { DataType: 'String', StringValue: eventType },
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error processing Shopee webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
