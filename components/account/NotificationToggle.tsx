"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  pushEnabled: boolean;
  onMutate: () => void;
}

// Convert a base64url-encoded string to a Uint8Array (required for VAPID key)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

// Encode an ArrayBuffer as a base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function NotificationToggle({
  pushEnabled,
  onMutate,
}: Props) {
  const [pushOn, setPushOn] = useState(pushEnabled);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const vapidKeyRef = useRef<string | null>(null);
  const pushSubRef = useRef<PushSubscription | null>(null);

  useEffect(() => { setPushOn(pushEnabled); }, [pushEnabled]);

  async function getVapidKey(): Promise<string> {
    if (vapidKeyRef.current) return vapidKeyRef.current;
    const res = await fetch("/api/push/public-key");
    if (!res.ok) throw new Error("Could not fetch VAPID key");
    const { publicKey } = await res.json();
    vapidKeyRef.current = publicKey as string;
    return publicKey as string;
  }

  async function handlePushToggle() {
    setPushLoading(true);
    setPushError(null);

    try {
      if (!pushOn) {
        // Enable push
        if (!("Notification" in window)) throw new Error("Notifications not supported");
        const perm = await Notification.requestPermission();
        if (perm !== "granted") throw new Error("Permission denied");

        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        const vapidKey = await getVapidKey();

        const keyBytes = urlBase64ToUint8Array(vapidKey);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer as ArrayBuffer,
        });
        pushSubRef.current = sub;

        const json = sub.toJSON();
        const endpoint = json.endpoint!;
        const p256dh = arrayBufferToBase64(sub.getKey("p256dh")!);
        const auth = arrayBufferToBase64(sub.getKey("auth")!);

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint, p256dh, auth }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Subscribe failed");

        setPushOn(true);
        onMutate();
      } else {
        // Disable push
        let endpoint: string | null = null;

        if (pushSubRef.current) {
          endpoint = pushSubRef.current.endpoint;
        } else if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) { endpoint = sub.endpoint; await sub.unsubscribe(); }
        }

        if (endpoint) {
          const res = await fetch("/api/push/unsubscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? "Unsubscribe failed");
          }
        }

        pushSubRef.current = null;
        setPushOn(false);
        onMutate();
      }
    } catch (e) {
      setPushError((e as Error).message);
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Notifications
      </h2>

      <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Push notifications</p>
              <p className="text-xs text-slate-400">
                Receive instant alerts in your browser
              </p>
            </div>
            <button
              role="switch"
              aria-checked={pushOn}
              onClick={handlePushToggle}
              disabled={pushLoading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                pushOn ? "bg-accent" : "bg-navy-600"
              }`}
            >
              {pushLoading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Spinner />
                </span>
              ) : (
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    pushOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              )}
            </button>
      </div>
      {pushError && <p className="mt-2 text-xs text-critical">{pushError}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="inline-block h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4A12 12 0 014 12z"
      />
    </svg>
  );
}
