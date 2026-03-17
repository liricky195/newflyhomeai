"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NotificationToggle from "@/components/account/NotificationToggle";

type Tab = "desktop" | "iphone" | "android";

interface AccountData {
  pushEnabled: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FlightsReminderModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("desktop");
  const [accountData, setAccountData] = useState<AccountData | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/account")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setAccountData({
        pushEnabled: data.pushEnabled ?? false,
      }))
      .catch(() => {});
  }, [open]);

  function refetchAccount() {
    fetch("/api/account")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setAccountData({
        pushEnabled: data.pushEnabled ?? false,
      }))
      .catch(() => {});
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "desktop", label: "💻 Computer" },
    { id: "iphone", label: "🍎 iPhone" },
    { id: "android", label: "🤖 Android" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="reminder-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        >
          <motion.div
            key="reminder-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl border border-border bg-navy-800 shadow-2xl overflow-y-auto h-[80vh] [&::-webkit-scrollbar]:[width:6px] [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:[border-radius:3px]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  🔔 Keep your alerts on
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  flyhome.ai checks for flights around the clock. To make sure
                  you get notified the moment a seat opens up, follow the steps
                  for your device below.
                </p>
                <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                  ⚠️ Keep this browser tab open at all times — closing it will
                  stop notifications from reaching you.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="mt-0.5 shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-navy-700 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>

            {/* Notification toggle — same as /account */}
            <div className="border-b border-border px-6 py-4">
              {accountData ? (
                <NotificationToggle
                  pushEnabled={accountData.pushEnabled}
                  onMutate={refetchAccount}
                />
              ) : (
                <div className="h-24 rounded-lg bg-navy-700/50 animate-pulse" />
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border px-6 pt-3">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t.id
                      ? "border border-b-transparent border-border bg-navy-700 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="max-h-[55vh] [&::-webkit-scrollbar]:[width:6px] [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:[border-radius:3px] overflow-y-auto px-6 py-5 text-sm text-slate-300">

              {/* ── DESKTOP ─────────────────────────────────────────────── */}
              {tab === "desktop" && (
                <div className="space-y-6">
                  <Section title="Step 1 — Allow notifications in your browser">
                    <p className="mb-3 text-slate-400">
                      Your browser needs permission to show you pop-up alerts
                      from flyhome.ai.
                    </p>
                    <Steps steps={[
                      <>Look at the top of your browser window, in the address bar
                        (where the web address is shown). There is a small{" "}
                        <Chip>🔒 lock</Chip> icon on the left side. Click it.</>,
                      <>A small menu will appear. Find the line that says{" "}
                        <Chip>Notifications</Chip> and click the dropdown next to
                        it. Change it to <Chip>Allow</Chip>.</>,
                      <>Refresh the page. If a pop-up appears at the top of the
                        screen asking about notifications, click{" "}
                        <Chip>Allow</Chip>.</>,
                    ]} />
                  </Section>

                  <Section title="Step 2 — Stop your Mac from going to sleep">
                    <p className="mb-3 text-slate-400">
                      If your Mac screen turns off or goes to sleep, notifications
                      will stop coming through. Here are two ways to prevent that:
                    </p>

                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Option A — System Settings (easier)</p>
                    <Steps steps={[
                      <>Click the <Chip>🍎 Apple menu</Chip> in the top-left
                        corner of your screen and select{" "}
                        <Chip>System Settings</Chip>.</>,
                      <>Click <Chip>Battery</Chip> in the left sidebar, then
                        click <Chip>Options</Chip>.</>,
                      <>Turn on <Chip>Prevent automatic sleeping when the
                        display is off</Chip>. If you don&apos;t see this, look for{" "}
                        <Chip>Energy Saver</Chip> instead and enable the same
                        option there.</>,
                    ]} />

                    <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Option B — Terminal command (keeps Mac awake only while command runs)</p>
                    <Steps steps={[
                      <>Open the <Chip>Terminal</Chip> app. You can find it by
                        pressing <Kbd>⌘ Space</Kbd> and typing{" "}
                        <strong className="text-white">Terminal</strong>.</>,
                      <>Type or paste the command below and press{" "}
                        <Kbd>Return ↵</Kbd>:<Code>caffeinate -d</Code>
                        Your Mac will stay awake for as long as this Terminal
                        window is running.</>,
                      <>When you no longer need it, click the Terminal window
                        and press <Kbd>Control + C</Kbd> to stop it.</>,
                    ]} />
                  </Section>
                </div>
              )}

              {/* ── IPHONE ──────────────────────────────────────────────── */}
              {tab === "iphone" && (
                <div className="space-y-6">
                  <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-300">
                    💡 On iPhone, web notifications only work when the website
                    has been added to your Home Screen. Pick your browser below.
                  </p>

                  <Section title="Safari (Apple's built-in browser)">
                    <Steps steps={[
                      <>Open <strong className="text-white">flyhome.ai</strong> in{" "}
                        <strong className="text-white">Safari</strong> — the blue
                        compass icon that came pre-installed on your iPhone.</>,
                      <>At the bottom of the screen, tap the{" "}
                        <Chip>Share button</Chip> — it looks like a box with an
                        arrow pointing upward <Kbd>⎙</Kbd>.</>,
                      <>Scroll down the list that appears and tap{" "}
                        <Chip>Add to Home Screen</Chip>.</>,
                      <>A preview will appear. Tap <Chip>Add</Chip> in the
                        top-right corner.</>,
                      <>Go back to your iPhone home screen and open the new{" "}
                        <strong className="text-white">flyhome.ai</strong> icon
                        that was just added.</>,
                      <>A prompt will appear asking if flyhome.ai can send you
                        notifications. Tap <Chip>Allow</Chip>.</>,
                    ]} />
                    <Note>
                      If you accidentally tapped &ldquo;Don&apos;t Allow&rdquo;, go to your
                      iPhone <strong className="text-white">Settings → Notifications</strong>,
                      scroll down to find <strong className="text-white">flyhome.ai</strong>,
                      and turn on <strong className="text-white">Allow Notifications</strong>.
                    </Note>
                  </Section>

                  <Section title="Chrome (Google's browser)">
                    <p className="mb-3 text-slate-400">
                      Chrome on iPhone uses the same notification system as
                      Safari — you need to add the site to your Home Screen first.
                    </p>
                    <Steps steps={[
                      <>Open <strong className="text-white">flyhome.ai</strong> in{" "}
                        <strong className="text-white">Chrome</strong>.</>,
                      <>Tap the <Chip>Share button</Chip> at the bottom of the
                        screen (box with an upward arrow).</>,
                      <>Scroll down and tap <Chip>Add to Home Screen</Chip>.</>,
                      <>Tap <Chip>Add</Chip> to confirm.</>,
                      <>Open the new <strong className="text-white">flyhome.ai</strong>{" "}
                        icon from your Home Screen and tap <Chip>Allow</Chip> when
                        asked about notifications.</>,
                    ]} />
                    <Note>
                      Once added to the Home Screen, flyhome.ai will open in
                      Safari (Apple requires this on iPhone) — that&apos;s normal and
                      is needed for notifications to work.
                    </Note>
                  </Section>
                </div>
              )}

              {/* ── ANDROID ─────────────────────────────────────────────── */}
              {tab === "android" && (
                <div className="space-y-6">
                  <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-300">
                    💡 Adding flyhome.ai to your Home Screen makes it behave like
                    a regular app and ensures notifications arrive reliably.
                  </p>

                  <Section title="Chrome (most common Android browser)">
                    <Steps steps={[
                      <>Open <strong className="text-white">flyhome.ai</strong> in{" "}
                        <strong className="text-white">Chrome</strong> (the red,
                        yellow, green, and blue circle icon).</>,
                      <>Tap the <Chip>⋮ three-dot menu</Chip> in the top-right
                        corner of the screen.</>,
                      <>Tap <Chip>Add to Home screen</Chip> from the menu.</>,
                      <>Tap <Chip>Add</Chip> on the confirmation box that
                        appears.</>,
                      <>A pop-up may now ask if you want to allow notifications
                        from flyhome.ai — tap <Chip>Allow</Chip>.</>,
                    ]} />
                    <Note>
                      If no pop-up appeared, open flyhome.ai in Chrome, tap{" "}
                      <strong className="text-white">⋮ → Settings → Site settings → Notifications</strong>,
                      find flyhome.ai in the list, and set it to{" "}
                      <strong className="text-white">Allow</strong>.
                    </Note>
                  </Section>

                  <Section title="Samsung Internet (built-in on Samsung phones)">
                    <Steps steps={[
                      <>Open <strong className="text-white">flyhome.ai</strong> in{" "}
                        <strong className="text-white">Samsung Internet</strong>{" "}
                        (the blue globe icon that came with your Samsung phone).</>,
                      <>Tap the <Chip>☰ menu button</Chip> at the bottom-right
                        of the screen.</>,
                      <>Tap <Chip>Add page to</Chip>, then tap{" "}
                        <Chip>Home screen</Chip>.</>,
                      <>Tap <Chip>Add</Chip> to confirm.</>,
                      <>Open the flyhome.ai icon from your Home Screen and tap{" "}
                        <Chip>Allow</Chip> when asked about notifications.</>,
                    ]} />
                    <Note>
                      If notifications were denied, go to your phone&apos;s{" "}
                      <strong className="text-white">Settings → Apps → Samsung Internet → Notifications</strong>{" "}
                      and turn on <strong className="text-white">Allow notifications</strong>.
                    </Note>
                  </Section>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-border px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-navy transition-colors hover:bg-accent/90"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-semibold text-white">{title}</p>
      {children}
    </div>
  );
}

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5 pl-1">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            {i + 1}
          </span>
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** Pill-style inline label for UI element names */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-navy-700 px-1.5 py-0.5 font-medium text-white">
      {children}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-navy-700 px-1.5 py-0.5 font-mono text-xs text-slate-300">
      {children}
    </kbd>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="mt-1.5 mb-1 block rounded-md border border-border bg-navy-900 px-3 py-2 font-mono text-xs text-accent">
      {children}
    </code>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-border bg-navy-900/60 px-3 py-2 text-xs text-slate-400 leading-relaxed">
      ℹ️ {children}
    </p>
  );
}
