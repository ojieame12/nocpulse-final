"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type EmailSignInFormProps = {
  nextPath?: string;
};

export function EmailSignInForm({ nextPath = "/" }: EmailSignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          next: nextPath,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Email sign-in failed.");
      }

      const target = new URL("/auth/check-email", window.location.origin);
      target.searchParams.set("email", email);
      target.searchParams.set("next", nextPath);
      router.push(`${target.pathname}${target.search}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Email sign-in failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        disabled={pending}
        required
      />
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <button type="submit" disabled={pending}>
          {pending ? "Sending link..." : "Send magic link"}
        </button>
      </div>
      {error ? <p>{error}</p> : null}
    </form>
  );
}
