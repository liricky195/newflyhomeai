import { v4 as uuidv4 } from 'uuid';

export interface ReferralCode {
  id: string;
  code: string;
  referrer_id: string;
  referred_id?: string | null;
  created_at: Date;
  used_at?: Date | null;
  reward_amount_cents: number;
  is_active: boolean;
  expires_at?: Date | null;
}

export interface ReferralTransaction {
  id: string;
  user_id: string;
  referral_code_id: string;
  amount_cents: number;
  type: 'earned' | 'redeemed';
  created_at: Date;
  description?: string;
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatReferralReward(cents: number): string {
  return (cents / 100).toFixed(2);
}
