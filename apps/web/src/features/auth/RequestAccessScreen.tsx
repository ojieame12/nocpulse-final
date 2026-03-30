"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import { AuthNoticeScreen } from "./AuthNoticeScreen";

type RequestAccessScreenProps = {
  email?: string | null;
  nextPath?: string;
};

type RequestAccessFormState = {
  name: string;
  email: string;
  farmName: string;
  acreage: string;
  message: string;
};

function buildSignInHref(nextPath: string) {
  return `/auth/sign-in?next=${encodeURIComponent(nextPath)}`;
}

export function RequestAccessScreen({
  email,
  nextPath = "/preview",
}: RequestAccessScreenProps) {
  const [formState, setFormState] = useState<RequestAccessFormState>(() => ({
    name: "",
    email: email ?? "",
    farmName: "",
    acreage: "",
    message: "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signInHref = buildSignInHref(nextPath);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/request-access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(formState),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "We could not submit your request.",
        );
      }

      setSubmitted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We could not submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AuthNoticeScreen
        eyebrow="Request Access"
        title="Request received"
        description="Your access request is in queue. NocPulse will review the details and follow up with the next step."
        detail={
          <span>
            We&apos;ll contact{" "}
            <span style={styles.monoValue}>{formState.email}</span> about{" "}
            <span style={styles.monoValue}>{formState.farmName}</span>.
          </span>
        }
        actions={[
          {
            href: signInHref,
            label: "Sign in with an existing account",
            variant: "secondary",
          },
        ]}
        footer="We typically respond within one business day."
      />
    );
  }

  return (
    <AuthNoticeScreen
      eyebrow="Request Access"
      title="Request access to NocPulse"
      description="Tell us about your farm or operation and NocPulse will review the request before provisioning access."
      detail="Use the email address that should receive NocPulse access. Approved requests can move into the normal sign-in flow without changing email."
      footer="We typically respond within one business day."
    >
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.label}>Name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            value={formState.name}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({
                ...current,
                name: value,
              }));
            }}
            placeholder="Jane Doe"
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formState.email}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({
                ...current,
                email: value,
              }));
            }}
            placeholder="jane@example.com"
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Farm / Operation</span>
          <input
            name="farmName"
            type="text"
            required
            value={formState.farmName}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({
                ...current,
                farmName: value,
              }));
            }}
            placeholder="Doe Family Farms"
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Approximate Acreage</span>
          <input
            name="acreage"
            type="text"
            inputMode="decimal"
            value={formState.acreage}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({
                ...current,
                acreage: value,
              }));
            }}
            placeholder="e.g. 450 ha"
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>
            Message <span style={styles.optional}>(optional)</span>
          </span>
          <textarea
            name="message"
            rows={4}
            value={formState.message}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({
                ...current,
                message: value,
              }));
            }}
            placeholder="Tell us about your operation or what you want from NocPulse."
            style={{ ...styles.input, ...styles.textarea }}
          />
        </label>

        {error ? (
          <p role="alert" style={styles.error}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={{
            ...styles.primaryButton,
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Submitting..." : "Request Access"}
        </button>
      </form>

      <p style={styles.secondaryCopy}>
        Already have an account?{" "}
        <Link href={signInHref} style={styles.secondaryLink}>
          Sign in
        </Link>
      </p>
    </AuthNoticeScreen>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-lg)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-xs)",
  },
  label: {
    fontFamily: "var(--font-body)",
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },
  optional: {
    fontWeight: 400,
    textTransform: "none",
    letterSpacing: "normal",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "var(--btn-radius)",
    border: "1px solid var(--border-light)",
    background: "var(--surface-white)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    lineHeight: "var(--leading-normal)",
  },
  textarea: {
    minHeight: 112,
    resize: "vertical",
  },
  error: {
    margin: 0,
    padding: "12px 14px",
    borderRadius: "var(--section-radius)",
    background: "var(--status-danger-bg)",
    color: "var(--status-danger-fg)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    lineHeight: "var(--leading-normal)",
  },
  primaryButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--btn-padding-v) var(--btn-padding-h)",
    borderRadius: "var(--btn-radius)",
    border: "1px solid transparent",
    background: "var(--btn-fill-primary)",
    boxShadow: "var(--shadow-btn)",
    color: "var(--btn-text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--btn-font-size)",
    fontWeight: 700,
    lineHeight: "var(--leading-normal)",
  },
  secondaryCopy: {
    margin: 0,
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    lineHeight: "var(--leading-normal)",
    color: "var(--text-muted)",
  },
  secondaryLink: {
    color: "var(--btn-fill-primary)",
    fontWeight: 700,
    textDecoration: "none",
  },
  monoValue: {
    fontFamily: "var(--font-mono)",
    color: "var(--text-primary)",
  },
};
