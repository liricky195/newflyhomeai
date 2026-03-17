import { getDb } from './db';

export interface AirportChangeInfo {
  can_change: boolean;
  next_change_at?: string;
  hours_remaining?: number;
  change_count: number;
}

export async function canUserChangeAirport(userId: string): Promise<AirportChangeInfo> {
  const db = getDb();
  
  const result = db.prepare(
    `SELECT last_airport_change, airport_change_count 
     FROM users WHERE id = ?`
  ).get(userId);
  
  const user = result as any;
  
  if (!user?.last_airport_change) {
    return { can_change: true, change_count: 0 };
  }
  
  const lastChange = new Date(user.last_airport_change);
  const now = new Date();
  const hoursSinceChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceChange >= 24) {
    return { can_change: true, change_count: user.airport_change_count || 0 };
  }
  
  const hoursRemaining = 24 - hoursSinceChange;
  const nextChangeAt = new Date(lastChange.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    can_change: false,
    next_change_at: nextChangeAt.toISOString(),
    hours_remaining: Math.ceil(hoursRemaining),
    change_count: user.airport_change_count || 0
  };
}

export async function recordAirportChange(userId: string): Promise<void> {
  const db = getDb();
  
  db.prepare(
    `UPDATE users 
     SET last_airport_change = datetime('now'), 
         airport_change_count = airport_change_count + 1 
     WHERE id = ?`
  ).run(userId);
}

export async function getAirportChangeHistory(userId: string): Promise<{
  last_change?: string;
  change_count: number;
  total_changes_this_month: number;
}> {
  const db = getDb();
  
  const result = db.prepare(
    `SELECT last_airport_change, airport_change_count 
     FROM users WHERE id = ?`
  ).get(userId);
  
  const user = result as any;
  
  // Count changes in current month
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  
  return {
    last_change: user?.last_airport_change,
    change_count: user?.airport_change_count || 0,
    total_changes_this_month: user?.airport_change_count || 0 // This could be enhanced with proper monthly tracking
  };
}
