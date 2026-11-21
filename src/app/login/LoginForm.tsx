"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

interface LoginFormProps {
  authError?: "confirmation" | "oauth";
}

export default function LoginForm({ authError }: LoginFormProps) {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(() => {
    if (authError === "confirmation") {
      return "That confirmation link is invalid or expired. Please sign in or sign up again.";
    }
    if (authError === "oauth") {
      return "Google or GitHub sign-in could not be completed. Please try again.";
    }
    return "";
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaScriptReady, setCaptchaScriptReady] = useState(false);
  const [oauthWaiting, setOauthWaiting] = useState<"google" | "github" | null>(null);
  const captchaContainer = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const needsCaptcha = isSignUp || oauthWaiting !== null;

  useEffect(() => {
    if (!needsCaptcha || !captchaScriptReady || !siteKey || !captchaContainer.current || !window.turnstile) {
      return;
    }
    if (captchaWidgetId.current) {
      window.turnstile.remove(captchaWidgetId.current);
    }
    captchaWidgetId.current = window.turnstile.render(captchaContainer.current, {
      sitekey: siteKey,
      callback: (token) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": () => setCaptchaToken(""),
    });
    return () => {
      if (captchaWidgetId.current && window.turnstile) {
        window.turnstile.remove(captchaWidgetId.current);
        captchaWidgetId.current = null;
      }
    };
  }, [captchaScriptReady, needsCaptcha, siteKey]);

  async function verifyCaptcha(token: string) {
    const response = await fetch("/api/auth/captcha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result: { success: boolean; message: string } = await response.json();
    setCaptchaToken("");
    if (captchaWidgetId.current && window.turnstile) {
      window.turnstile.reset(captchaWidgetId.current);
    }
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Security check failed. Please try again.");
    }
  }

  async function continueOAuth(provider: "google" | "github", token: string) {
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      await verifyCaptcha(token);
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed. Please try again.");
      setIsSubmitting(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    if (!siteKey) {
      setError("Signup verification is not configured. Add the Turnstile site key to continue.");
      return;
    }
    setError("");
    if (captchaToken) {
      setOauthWaiting(null);
      void continueOAuth(provider, captchaToken);
    } else {
      setMessage("Complete the security check, then choose your sign-in provider again.");
      setOauthWaiting(provider);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      if (isSignUp) {
        if (!siteKey) {
          throw new Error("Signup verification is not configured. Add the Turnstile site key to continue.");
        }
        if (!captchaToken) {
          throw new Error("Complete the security check before creating your account.");
        }
        await verifyCaptcha(captchaToken);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-10">
        <Link className="text-sm font-semibold tracking-tight" href="/">
          ping<span className="text-zinc-400">it</span>
        </Link>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {isSignUp
            ? "Sign up with your email to start building your support assistant."
            : "Sign in to manage your support assistant."}
        </p>

        <div className="mt-8 grid gap-3">
          <Button
            className="h-10 w-full"
            disabled={isSubmitting}
            onClick={() => void handleOAuth("google")}
            type="button"
            variant="outline"
          >
            Continue with Google
          </Button>
          <Button
            className="h-10 w-full"
            disabled={isSubmitting}
            onClick={() => void handleOAuth("github")}
            type="button"
            variant="outline"
          >
            Continue with GitHub
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
          <span className="h-px flex-1 bg-zinc-200" />
          or continue with email
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {isSignUp && (
            <label className="block space-y-2 text-sm font-medium">
              Name
              <Input
                autoComplete="name"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          )}
          <label className="block space-y-2 text-sm font-medium">
            Email
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          {needsCaptcha && (
            <div className="space-y-2">
              {siteKey ? (
                <>
                  <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                    strategy="afterInteractive"
                    onReady={() => setCaptchaScriptReady(true)}
                  />
                  <div ref={captchaContainer} aria-label="Signup security challenge" />
                </>
              ) : (
                <p className="text-sm text-amber-700" role="status">
                  Signup security verification has not been configured.
                </p>
              )}
            </div>
          )}
          <label className="block space-y-2 text-sm font-medium">
            Password
            <Input
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {message && (
            <p className="text-sm text-emerald-700" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <Button className="h-10 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? "Please wait…"
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          {isSignUp ? "Already have an account?" : "New to Pingit?"}{" "}
          <button
            className="font-medium text-zinc-950 underline underline-offset-4"
            onClick={() => {
              setIsSignUp((current) => !current);
              setOauthWaiting(null);
              setCaptchaToken("");
              setMessage("");
              setError("");
            }}
            type="button"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
