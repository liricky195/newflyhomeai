import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canUserChangeAirport, recordAirportChange } from '@/lib/airport-cooldown';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const changeInfo = await canUserChangeAirport(session.user.id);
    return NextResponse.json(changeInfo);
  } catch (error) {
    console.error('Airport change check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { new_airport_iata } = body;

    if (!new_airport_iata || typeof new_airport_iata !== 'string') {
      return NextResponse.json({ error: 'Valid airport IATA code is required' }, { status: 400 });
    }

    // Check if user can change airport
    const changeInfo = await canUserChangeAirport(session.user.id);
    if (!changeInfo.can_change) {
      return NextResponse.json({ 
        error: 'Airport change not allowed yet',
        next_change_at: changeInfo.next_change_at,
        hours_remaining: changeInfo.hours_remaining
      }, { status: 429 });
    }

    // Record the airport change
    await recordAirportChange(session.user.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Airport change recorded successfully',
      new_airport: new_airport_iata
    });
  } catch (error) {
    console.error('Airport change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
