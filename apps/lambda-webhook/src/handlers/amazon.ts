import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const sqs = new SQSClient({});

interface AmazonSPAPINotification {
  notificationType: string;
  payloadVersion: string;
  eventTime: string;
  payload: {
    orderId?: string;
    merchantId?: string;
    marketplaceId?: string;
    [key: string]: any;
  };
  notificationMetadata: {
    applicationId: string;
    subscriptionId: string;
    publishTime: string;
    notificationId: string;
  };
}

function validateAmazonSignature(
  payload: string,
  signature: string,
  certificateUrl: string
): boolean {
  // In production, you would:
  // 1. Download the certificate from certificateUrl
  // 2. Verify the certificate is from Amazon
  // 3. Use the public key to verify the signature
  // For now, we'll do basic validation
  return signature && signature.length > 0;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const signature = event.headers['x-amz-sns-signature'] || '';
    const certificateUrl = event.headers['x-amz-sns-cert-url'] || '';

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing body' }) };
    }

    // Handle SNS subscription confirmation
    const snsMessage = JSON.parse(event.body);
    if (snsMessage.Type === 'SubscriptionConfirmation') {
      console.log('SNS Subscription confirmation:', snsMessage.SubscribeURL);
      // In production, automatically confirm by calling SubscribeURL
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Subscription confirmation received' }),
      };
    }

    // Validate signature
    if (!validateAmazonSignature(event.body, signature, certificateUrl)) {
      console.error('Invalid Amazon webhook signature');
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    }

    const notification: AmazonSPAPINotification = 
      snsMessage.Type === 'Notification' 
        ? JSON.parse(snsMessage.Message) 
        : JSON.parse(event.body);

    console.log('Received Amazon webhook:', notification.notificationType);

    // Send to SQS for processing
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        marketplace: 'AMAZON',
        notificationType: notification.notificationType,
        payload: notification.payload,
        eventTime: notification.eventTime,
        receivedAt: new Date().toISOString(),
      }),
      MessageAttributes: {
        marketplace: { DataType: 'String', StringValue: 'AMAZON' },
        notificationType: { DataType: 'String', StringValue: notification.notificationType },
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error processing Amazon webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
