import webpush from "web-push";
import {
  getPushSubscriptionsByUserId,
  deletePushSubscription,
} from "./db";

let vapidInitialised = false;

export function initVapid(): void {
  if (vapidInitialised) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Missing VAPID configuration. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in .env"
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialised = true;
}

// Initialise at module load so missing keys are caught early
try {
  initVapid();
} catch {
  // Deferred — will throw at runtime when sendPushNotification is called
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  initVapid();

  const subs = getPushSubscriptionsByUserId(userId);
  if (subs.length === 0) return;

  const jsonPayload = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          jsonPayload
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410) {
          deletePushSubscription(sub.endpoint);
          return;
        }
        throw err;
      }
    })
  );

  // Re-throw the first non-410 error
  for (const r of results) {
    if (r.status === "rejected") {
      throw r.reason;
    }
  }
}
