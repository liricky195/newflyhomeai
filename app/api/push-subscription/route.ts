import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { subscription } = await request.json();
    
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription data required' }, { status: 400 });
    }

    const db = getDb();
    
    // Store the subscription in database (you might want to create a separate table for this)
    // For now, we'll just mark the user as having push enabled
    db.prepare(
      'UPDATE users SET push_enabled = 1 WHERE id = ?'
    ).run(session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json({ error: 'Failed to save push subscription' }, { status: 500 });
  }
}
