import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  createReferralCode, 
  getUserReferralCode, 
  validateReferralCode, 
  applyReferralCode,
  getReferralStats,
  getUserReferralBalance,
  redeemReferralBalance
} from '@/lib/referral-db';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'stats':
        const stats = await getReferralStats(session.user.id);
        return NextResponse.json(stats);

      case 'balance':
        const balance = await getUserReferralBalance(session.user.id);
        return NextResponse.json({ balance_cents: balance });

      case 'validate':
        const code = searchParams.get('code');
        if (!code) {
          return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
        }
        const validation = await validateReferralCode(code);
        return NextResponse.json({ valid: !!validation });

      default:
        // Get user's referral code
        let referralCode = await getUserReferralCode(session.user.id);
        if (!referralCode) {
          referralCode = await createReferralCode(session.user.id);
        }
        return NextResponse.json({ referral_code: referralCode });
    }
  } catch (error) {
    console.error('Referral GET error:', error);
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
    const { action, code, amount_cents } = body;

    switch (action) {
      case 'apply':
        if (!code) {
          return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
        }

        const validation = await validateReferralCode(code);
        if (!validation) {
          return NextResponse.json({ error: 'Invalid or expired referral code' }, { status: 400 });
        }

        await applyReferralCode(validation.referrer_id, session.user.id, code);
        return NextResponse.json({ success: true, message: 'Referral code applied successfully' });

      case 'redeem':
        if (!amount_cents || amount_cents <= 0) {
          return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
        }

        await redeemReferralBalance(session.user.id, amount_cents);
        return NextResponse.json({ success: true, message: 'Referral balance redeemed successfully' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Referral POST error:', error);
    if (error instanceof Error && error.message === 'Insufficient referral balance') {
      return NextResponse.json({ error: 'Insufficient referral balance' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
