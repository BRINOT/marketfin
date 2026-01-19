import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const sqs = new SQSClient({});

interface MercadoLivreWebhook {
  resource: string;
  user_id: number;
  topic: string;
  application_id: number;
  attempts: number;
  sent: string;
  received: string;
}

function validateSignature(payload: string, signature: string, secret: string): boolean {
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
    const signature = event.headers['X-Signature'] || event.headers['x-signature'];
    const secret = process.env.ML_WEBHOOK_SECRET;

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing body' }) };
    }

    // Validate webhook signature
    if (secret && signature) {
      if (!validateSignature(event.body, signature, secret)) {
        console.error('Invalid webhook signature');
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
      }
    }

    const payload: MercadoLivreWebhook = JSON.parse(event.body);
    console.log('Received ML webhook:', payload.topic, payload.resource);

    // Send to SQS for processing
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        marketplace: 'MERCADO_LIVRE',
        topic: payload.topic,
        resource: payload.resource,
        userId: payload.user_id,
        receivedAt: new Date().toISOString(),
      }),
      MessageAttributes: {
        marketplace: { DataType: 'String', StringValue: 'MERCADO_LIVRE' },
        topic: { DataType: 'String', StringValue: payload.topic },
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error processing ML webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
