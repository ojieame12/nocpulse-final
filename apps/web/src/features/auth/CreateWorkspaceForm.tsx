"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type CreateWorkspaceFormProps = {
  nextPath?: string;
};

export function CreateWorkspaceForm({
  nextPath = "/",
}: CreateWorkspaceFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Workspace name is required.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          next: nextPath,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
        result?: { next?: string };
      };

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Workspace provisioning failed.",
        );
      }

      router.push(payload.result?.next ?? nextPath);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Workspace provisioning failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
        }}
      >
        <label
          htmlFor="workspace-name"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Workspace Name
        </label>
        <input
          id="workspace-name"
          name="workspace-name"
          type="text"
          autoComplete="organization"
          placeholder="Hope Creek Farms"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          disabled={pending}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
            background: "var(--surface-white)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-base)",
            lineHeight: "var(--leading-normal)",
            outline: "none",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--btn-padding-v) var(--btn-padding-h)",
          borderRadius: "var(--btn-radius)",
          border: "1px solid transparent",
          background: "var(--btn-fill-primary)",
          color: "var(--btn-text-primary)",
          boxShadow: "var(--shadow-btn)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--btn-font-size)",
          fontWeight: 700,
          lineHeight: "var(--leading-normal)",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Creating workspace..." : "Create workspace"}
      </button>

      {error ? (
        <p
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(239,68,68,0.2)",
            background: "rgba(239,68,68,0.08)",
            color: "var(--status-danger)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
