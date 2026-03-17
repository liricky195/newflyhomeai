"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Set to true to re-enable email magic-link sign-in on the auth page.
const SHOW_EMAIL_SIGN_IN = false;

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start the sign-in flow. Please try again.",
  OAuthCallback: "Sign-in was interrupted. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  EmailSignin: "The e-mail could not be sent.",
  EmailCreateAccount: "Could not create your account via email.",
  Callback: "Something went wrong during sign-in. Please try again.",
  Default: "An unexpected error occurred. Please try again.",
};

export default function AuthPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "authenticated") return null;

  const errorMessage = error
    ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default
    : null;

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || emailLoading) return;

    setEmailLoading(true);
    try {
      const res = await signIn("email", {
        email,
        callbackUrl: "/dashboard",
        redirect: false,
      });
      if (res?.error) {
        router.push(`/auth?error=EmailSignin`);
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      router.push(`/auth?error=Default`);
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-navy-700 p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to monitor flights and book instantly.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-lg bg-critical/10 px-4 py-3 text-sm text-critical">
              {errorMessage}
            </div>
          )}

          {!emailSent ? (
            <div className="space-y-6">
              {SHOW_EMAIL_SIGN_IN && (
                <>
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full rounded-lg border border-border bg-navy-800 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-accent/50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-navy transition-colors hover:bg-accent-dark disabled:opacity-50"
                    >
                      {emailLoading ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                          Sending...
                        </>
                      ) : (
                        "Sign in with Email"
                      )}
                    </button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-navy-700 px-2 text-slate-500">Or continue with</span>
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
                </svg>
                Google
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-lg font-bold text-white">Check your email</h2>
              <p className="mt-2 text-sm text-slate-400">
                We sent a sign-in link to <span className="font-medium text-white">{email}</span>.
              </p>
              <button
                onClick={() => setEmailSent(false)}
                className="mt-6 text-xs font-medium text-accent hover:underline"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          <div className="mt-8 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
            <strong>Onboarding:</strong> New accounts will be prompted to select their stranded airport. This choice is permanent.
          </div>

          <p className="mt-6 text-center text-[10px] text-slate-500">
            By signing in, you agree to our Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
