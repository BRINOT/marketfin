// Vercel Cron Job - Sync Orders from Marketplaces
// Runs every 6 hours: 0 */6 * * *

import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Call backend to trigger order sync for all active integrations
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cron/sync-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Order sync triggered',
      result,
    });
  } catch (error) {
    console.error('Cron sync-orders error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger order sync' },
      { status: 500 }
    );
  }
}
