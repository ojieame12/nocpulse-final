"use client";

import React, { useEffect, useState, type FormEvent } from "react";
import { Save, ShieldPlus, UserMinus, Users } from "lucide-react";
import {
  describeWorkspaceInviteRole,
  formatWorkspaceRoleLabel,
  type WorkspaceAccessState,
  type WorkspaceInviteRole,
} from "../../features/settings/workspaceAccess";
import { Card, Lbl, Mono, Sub } from "./fieldDetailCardPrimitives";

type WorkspaceAccessCardProps = {
  workspaceId?: string | null;
};

type WorkspaceAccessResponse = {
  result?: WorkspaceAccessState;
  error?: { message?: string };
};

type WorkspaceInviteResponse = {
  result?: {
    message?: string;
    role?: WorkspaceInviteRole;
    email?: string;
    authUserCreated?: boolean;
    deliveryStatus?: "sent" | "manual-signin";
  };
  error?: { message?: string };
};

type WorkspaceMemberActionResponse = {
  result?: {
    message?: string;
    role?: WorkspaceInviteRole;
    userId?: string;
  };
  error?: { message?: string };
};

function buildWorkspaceAccessQuery(workspaceId?: string | null) {
  if (!workspaceId) {
    return "/api/settings/access";
  }

  return `/api/settings/access?workspaceId=${encodeURIComponent(workspaceId)}`;
}

function formatMemberTimestamp(value: string) {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return "Joined recently";
  }

  return `Added ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed))}`;
}

function RoleBadge({ role }: { role: WorkspaceAccessState["actorRole"] }) {
  const styles =
    role === "owner"
      ? {
          background: "rgba(22,163,74,0.12)",
          color: "var(--status-positive)",
        }
      : role === "manager"
        ? {
            background: "rgba(245,158,11,0.14)",
            color: "var(--status-warning)",
          }
        : role === "viewer"
          ? {
              background: "rgba(59,130,246,0.14)",
              color: "var(--status-info)",
            }
          : {
              background: "var(--section-bg)",
              color: "var(--text-secondary)",
            };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 72,
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        ...styles,
      }}
    >
      {formatWorkspaceRoleLabel(role)}
    </span>
  );
}

export function WorkspaceAccessCard({
  workspaceId = null,
}: WorkspaceAccessCardProps) {
  const [accessState, setAccessState] = useState<WorkspaceAccessState | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceInviteRole>("member");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [memberDraftRoles, setMemberDraftRoles] = useState<
    Record<string, WorkspaceInviteRole>
  >({});
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"positive" | "warning">(
    "positive",
  );

  async function refreshAccessState(
    nextWorkspaceId?: string | null,
    options?: { preserveNotice?: boolean; preserveError?: boolean },
  ) {
    const response = await fetch(buildWorkspaceAccessQuery(nextWorkspaceId), {
      cache: "no-store",
    });
    const payload = (await response.json()) as WorkspaceAccessResponse;

    if (!response.ok || !payload.result) {
      throw new Error(
        payload.error?.message ?? "Workspace access could not be loaded.",
      );
    }

    setAccessState(payload.result);
    setInviteRole(payload.result.allowedInviteRoles[0] ?? "member");
    setMemberDraftRoles(
      Object.fromEntries(
        payload.result.members
          .filter((member) => member.role !== "owner")
          .map((member) => [member.userId, member.role]),
      ) as Record<string, WorkspaceInviteRole>,
    );

    if (!options?.preserveNotice) {
      setNotice(null);
    }

    if (!options?.preserveError) {
      setError(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAccessState() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(buildWorkspaceAccessQuery(workspaceId), {
          cache: "no-store",
        });
        const payload = (await response.json()) as WorkspaceAccessResponse;

        if (!response.ok || !payload.result) {
          throw new Error(
            payload.error?.message ?? "Workspace access could not be loaded.",
          );
        }

        if (cancelled) {
          return;
        }

        setAccessState(payload.result);
        setInviteRole(payload.result.allowedInviteRoles[0] ?? "member");
        setMemberDraftRoles(
          Object.fromEntries(
            payload.result.members
              .filter((member) => member.role !== "owner")
              .map((member) => [member.userId, member.role]),
          ) as Record<string, WorkspaceInviteRole>,
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Workspace access could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccessState();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessState?.canManageAccess) {
      return;
    }

    if (!inviteEmail.trim()) {
      setError("An email address is required.");
      return;
    }

    setInviting(true);
    setError(null);
    setNotice(null);
    setNoticeTone("positive");

    try {
      const response = await fetch("/api/settings/access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: accessState.workspaceId,
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const payload = (await response.json()) as WorkspaceInviteResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Workspace access could not be provisioned.",
        );
      }

      setNotice(
        payload.result?.message ??
          "Workspace access was provisioned successfully.",
      );
      setNoticeTone(
        payload.result?.deliveryStatus === "manual-signin"
          ? "warning"
          : "positive",
      );
      setInviteEmail("");

      await refreshAccessState(accessState.workspaceId, {
        preserveNotice: true,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Workspace access could not be provisioned.",
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleMemberRoleUpdate(member: WorkspaceAccessState["members"][number]) {
    if (!accessState || !member.canChangeRole) {
      return;
    }

    const nextRole = memberDraftRoles[member.userId];

    if (!nextRole || nextRole === member.role) {
      return;
    }

    setUpdatingMemberId(member.userId);
    setError(null);
    setNotice(null);
    setNoticeTone("positive");

    try {
      const response = await fetch("/api/settings/access", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: accessState.workspaceId,
          userId: member.userId,
          role: nextRole,
        }),
      });
      const payload = (await response.json()) as WorkspaceMemberActionResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Workspace member role could not be updated.",
        );
      }

      setNotice(payload.result?.message ?? "Workspace member role updated.");
      await refreshAccessState(accessState.workspaceId, {
        preserveNotice: true,
      });
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Workspace member role could not be updated.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function handleMemberRemoval(member: WorkspaceAccessState["members"][number]) {
    if (!accessState || !member.canRemove) {
      return;
    }

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Remove ${member.email ?? member.userId} from ${accessState.workspaceName ?? "this workspace"}?`,
          );

    if (!confirmed) {
      return;
    }

    setRemovingMemberId(member.userId);
    setError(null);
    setNotice(null);
    setNoticeTone("warning");

    try {
      const response = await fetch("/api/settings/access", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: accessState.workspaceId,
          userId: member.userId,
        }),
      });
      const payload = (await response.json()) as WorkspaceMemberActionResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Workspace member could not be removed.",
        );
      }

      setNotice(payload.result?.message ?? "Workspace member removed.");
      await refreshAccessState(accessState.workspaceId, {
        preserveNotice: true,
      });
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Workspace member could not be removed.",
      );
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <Card span={-1} style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Users size={14} style={{ color: "var(--text-muted)" }} />
        <Lbl>WORKSPACE ACCESS</Lbl>
      </div>

      {loading ? (
        <Sub>Loading workspace members…</Sub>
      ) : accessState ? (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--section-bg)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="fdp-big fdp-big--14">
                {accessState.workspaceName ?? "Current workspace"}
              </span>
              <Sub>
                {accessState.canManageAccess
                  ? "Owners and managers can provision access by email. New emails attach to this workspace automatically on first sign-in."
                  : "You can see who currently has access to this workspace."}
              </Sub>
            </div>
            <RoleBadge role={accessState.actorRole} />
          </div>

          {accessState.canManageAccess ? (
            <form
              onSubmit={handleInviteSubmit}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.6fr) minmax(160px, 0.9fr) auto",
                gap: 8,
                alignItems: "end",
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="fdp-lbl fdp-lbl--muted">CUSTOMER EMAIL</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.currentTarget.value)}
                  placeholder="grower@example.com"
                  disabled={inviting}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border-light)",
                    background: "var(--surface-white)",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="fdp-lbl fdp-lbl--muted">ROLE</span>
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.currentTarget.value as WorkspaceInviteRole)
                  }
                  disabled={inviting}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border-light)",
                    background: "var(--surface-white)",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                >
                  {accessState.allowedInviteRoles.map((role) => (
                    <option key={role} value={role}>
                      {formatWorkspaceRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={inviting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid transparent",
                  background: "var(--btn-fill-primary)",
                  boxShadow: "var(--shadow-btn)",
                  color: "var(--btn-text-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: inviting ? "wait" : "pointer",
                  opacity: inviting ? 0.7 : 1,
                }}
              >
                <ShieldPlus size={14} />
                {inviting ? "Provisioning..." : "Provision access"}
              </button>
            </form>
          ) : null}

          {accessState.canManageAccess ? (
            <Sub>{describeWorkspaceInviteRole(inviteRole)}</Sub>
          ) : null}

          {notice ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background:
                  noticeTone === "warning"
                    ? "rgba(245,158,11,0.08)"
                    : "rgba(22,163,74,0.08)",
                border:
                  noticeTone === "warning"
                    ? "1px solid rgba(245,158,11,0.18)"
                    : "1px solid rgba(22,163,74,0.18)",
              }}
            >
              <Mono
                color={
                  noticeTone === "warning"
                    ? "var(--status-warning)"
                    : "var(--status-positive)"
                }
              >
                {notice}
              </Mono>
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
            >
              <Mono color="var(--status-danger)">{error}</Mono>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accessState.members.map((member) => (
              <div
                key={member.userId}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--surface-white)",
                }}
                >
                  <div
                    style={{
                      display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    minWidth: 0,
                    flex: 1,
                  }}
                  >
                    <Mono color="var(--text-primary)">
                      {member.email ?? member.userId}
                    </Mono>
                    <Sub>
                    {member.isCurrentActor ? "This is your current account." : ""}
                    {member.isCurrentActor && member.invitedByEmail
                      ? " "
                      : ""}
                    {member.invitedByEmail
                      ? `Added by ${member.invitedByEmail} · `
                      : ""}
                      {formatMemberTimestamp(member.createdAt)}
                  </Sub>
                </div>
                {member.canChangeRole || member.canRemove ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {member.canChangeRole ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <select
                          value={memberDraftRoles[member.userId] ?? member.role}
                          onChange={(event) =>
                            setMemberDraftRoles((current) => ({
                              ...current,
                              [member.userId]: event.currentTarget
                                .value as WorkspaceInviteRole,
                            }))
                          }
                          disabled={
                            updatingMemberId === member.userId ||
                            removingMemberId === member.userId
                          }
                          style={{
                            minWidth: 112,
                            padding: "8px 12px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-light)",
                            background: "var(--surface-white)",
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            color: "var(--text-primary)",
                            outline: "none",
                          }}
                        >
                          {member.allowedRoleChanges.map((role) => (
                            <option key={role} value={role}>
                              {formatWorkspaceRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleMemberRoleUpdate(member)}
                          disabled={
                            updatingMemberId === member.userId ||
                            removingMemberId === member.userId ||
                            (memberDraftRoles[member.userId] ?? member.role) ===
                              member.role
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "8px 12px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-light)",
                            background: "var(--surface-white)",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-body)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor:
                              updatingMemberId === member.userId
                                ? "wait"
                                : "pointer",
                            opacity:
                              (memberDraftRoles[member.userId] ?? member.role) ===
                                member.role ||
                              removingMemberId === member.userId
                                ? 0.45
                                : 1,
                          }}
                        >
                          <Save size={12} />
                          {updatingMemberId === member.userId ? "Saving..." : "Save"}
                        </button>
                      </div>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}

                    {member.canRemove ? (
                      <button
                        type="button"
                        onClick={() => void handleMemberRemoval(member)}
                        disabled={
                          updatingMemberId === member.userId ||
                          removingMemberId === member.userId
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          border: "none",
                          background: "transparent",
                          color: "var(--status-danger)",
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor:
                            removingMemberId === member.userId
                              ? "wait"
                              : "pointer",
                          opacity: updatingMemberId === member.userId ? 0.45 : 1,
                        }}
                      >
                        <UserMinus size={12} />
                        {removingMemberId === member.userId
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <RoleBadge role={member.role} />
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <Sub>Workspace access could not be loaded.</Sub>
      )}
    </Card>
  );
}
