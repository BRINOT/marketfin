// Vercel Cron Job - Cleanup Old Exports
// Runs daily at 3 AM: 0 3 * * *

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
    // Call backend to cleanup old exports
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cron/cleanup-exports`, {
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
      message: 'Export cleanup completed',
      result,
    });
  } catch (error) {
    console.error('Cron cleanup-exports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cleanup exports' },
      { status: 500 }
    );
  }
}
