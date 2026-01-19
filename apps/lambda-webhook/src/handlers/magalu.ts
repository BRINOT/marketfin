import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const sqs = new SQSClient({});

interface MagaluWebhook {
  event: string;
  timestamp: string;
  data: {
    order_id?: string;
    seller_id?: string;
    status?: string;
    [key: string]: any;
  };
}

function validateMagaluSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const signature = event.headers['X-Magalu-Signature'] || event.headers['x-magalu-signature'] || '';
    const secret = process.env.MAGALU_WEBHOOK_SECRET || '';

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing body' }) };
    }

    // Validate webhook signature
    if (secret && signature) {
      if (!validateMagaluSignature(event.body, signature, secret)) {
        console.error('Invalid Magalu webhook signature');
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
      }
    }

    const payload: MagaluWebhook = JSON.parse(event.body);
    console.log('Received Magalu webhook:', payload.event);

    // Send to SQS for processing
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        marketplace: 'MAGALU',
        eventType: payload.event,
        data: payload.data,
        timestamp: payload.timestamp,
        receivedAt: new Date().toISOString(),
      }),
      MessageAttributes: {
        marketplace: { DataType: 'String', StringValue: 'MAGALU' },
        eventType: { DataType: 'String', StringValue: payload.event },
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error processing Magalu webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
