"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SignOutButtonProps = {
  redirectTo?: string;
};

export function SignOutButton({ redirectTo = "/auth/sign-in" }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Sign out failed.");
      }

      router.push(redirectTo);
      router.refresh();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Sign out failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSignOut} disabled={pending}>
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error ? <p>{error}</p> : null}
    </div>
  );
}
