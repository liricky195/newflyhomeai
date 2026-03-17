import { getDb } from './db';
import { ReferralCode, ReferralTransaction, generateReferralCode } from './referral';

export async function createReferralCode(userId: string): Promise<string> {
  const db = getDb();
  const code = generateReferralCode();
  
  db.prepare(
    `INSERT INTO referral_codes (code, referrer_id, expires_at) 
     VALUES (?, ?, datetime('now', '+1 year'))`
  ).run(code, userId);
  
  // Update user's referral code
  db.prepare(
    'UPDATE users SET referral_code = ? WHERE id = ?'
  ).run(code, userId);
  
  return code;
}

export async function getUserReferralCode(userId: string): Promise<string | null> {
  const db = getDb();
  const result = db.prepare(
    'SELECT referral_code FROM users WHERE id = ?'
  ).get(userId);
  
  return (result as any)?.referral_code || null;
}

export async function validateReferralCode(code: string): Promise<ReferralCode | null> {
  const db = getDb();
  const result = db.prepare(
    `SELECT * FROM referral_codes 
     WHERE code = ? AND is_active = TRUE 
     AND (expires_at IS NULL OR expires_at > datetime('now'))
     AND referred_id IS NULL`
  ).get(code);
  
  return (result as ReferralCode) || null;
}

export async function applyReferralCode(referrerId: string, referredId: string, code: string): Promise<void> {
  const db = getDb();
  
  // Start transaction
  const transaction = db.transaction(() => {
    // Update referral code
    db.prepare(
      `UPDATE referral_codes 
       SET referred_id = ?, used_at = datetime('now') 
       WHERE code = ?`
    ).run(referredId, code);
    
    // Update referred user
    db.prepare(
      'UPDATE users SET referred_by = ? WHERE id = ?'
    ).run(referrerId, referredId);
    
    // Get reward amount
    const referralResult = db.prepare(
      'SELECT reward_amount_cents FROM referral_codes WHERE code = ?'
    ).get(code);
    
    const rewardAmount = (referralResult as any)?.reward_amount_cents || 500;
    
    // Add reward to referrer's balance
    db.prepare(
      'UPDATE users SET referral_balance_cents = referral_balance_cents + ? WHERE id = ?'
    ).run(rewardAmount, referrerId);
    
    // Record transaction for referrer
    db.prepare(
      `INSERT INTO referral_transactions (user_id, referral_code_id, amount_cents, type, description)
       SELECT ?, id, ?, 'earned', 'Referral reward for inviting new user'
       FROM referral_codes WHERE code = ?`
    ).run(referrerId, rewardAmount, code);
    
    // Give new user signup bonus
    const signupBonus = 500; // $5.00
    db.prepare(
      'UPDATE users SET referral_balance_cents = referral_balance_cents + ? WHERE id = ?'
    ).run(signupBonus, referredId);
    
    // Record transaction for referred user
    db.prepare(
      `INSERT INTO referral_transactions (user_id, referral_code_id, amount_cents, type, description)
       SELECT ?, id, ?, 'earned', 'Signup bonus from referral'
       FROM referral_codes WHERE code = ?`
    ).run(referredId, signupBonus, code);
  });
  
  transaction();
}

export async function getUserReferralBalance(userId: string): Promise<number> {
  const db = getDb();
  const result = db.prepare(
    'SELECT referral_balance_cents FROM users WHERE id = ?'
  ).get(userId);
  
  return (result as any)?.referral_balance_cents || 0;
}

export async function getReferralStats(userId: string): Promise<{
  code: string | null;
  balance_cents: number;
  referrals_count: number;
  total_earned_cents: number;
}> {
  const db = getDb();
  
  // Get user's referral code and balance
  const userResult = db.prepare(
    'SELECT referral_code, referral_balance_cents FROM users WHERE id = ?'
  ).get(userId);
  
  // Get referral stats
  const statsResult = db.prepare(
    `SELECT 
       COUNT(*) as referrals_count,
       COALESCE(SUM(rt.amount_cents), 0) as total_earned_cents
     FROM referral_codes rc
     LEFT JOIN referral_transactions rt ON rc.id = rt.referral_code_id AND rt.type = 'earned'
     WHERE rc.referrer_id = ?`
  ).get(userId);
  
  return {
    code: (userResult as any)?.referral_code || null,
    balance_cents: (userResult as any)?.referral_balance_cents || 0,
    referrals_count: (statsResult as any)?.referrals_count || 0,
    total_earned_cents: (statsResult as any)?.total_earned_cents || 0
  };
}

export async function redeemReferralBalance(userId: string, amountCents: number): Promise<void> {
  const db = getDb();
  
  const transaction = db.transaction(() => {
    // Check balance
    const balanceResult = db.prepare(
      'SELECT referral_balance_cents FROM users WHERE id = ?'
    ).get(userId);
    
    const currentBalance = (balanceResult as any)?.referral_balance_cents || 0;
    
    if (currentBalance < amountCents) {
      throw new Error('Insufficient referral balance');
    }
    
    // Deduct from balance
    db.prepare(
      'UPDATE users SET referral_balance_cents = referral_balance_cents - ? WHERE id = ?'
    ).run(amountCents, userId);
    
    // Record transaction
    db.prepare(
      `INSERT INTO referral_transactions (user_id, amount_cents, type, description)
       VALUES (?, ?, 'redeemed', 'Used referral balance for purchase')`
    ).run(userId, amountCents);
  });
  
  transaction();
}
