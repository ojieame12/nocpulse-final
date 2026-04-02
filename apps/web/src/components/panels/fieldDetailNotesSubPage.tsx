/**
 * Notes subpage for FieldDetailPanel.
 *
 * Extracted from SubPageView — owns all scout-note form state,
 * submission logic, and the note entry list render.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  SCOUT_NOTE_OUTCOME_OPTIONS,
  type FieldNotesInspectionTarget,
  type FieldNotesProps,
  type ScoutNoteOutcome,
} from "./NotesTab";
import { titleCaseLabel } from "./fieldDetailHelpers";
import { Card, Lbl, LblM, Sub } from "./fieldDetailCardPrimitives";
import {
  flushOfflineScoutNotesQueue,
  listQueuedOfflineScoutNotes,
  queueOfflineScoutNote,
} from "../../features/offline/offlineScoutNotesQueue";

export function NotesSubPage({
  notes,
  selectedNotesTarget,
  effectiveInspectionTarget,
  ac,
  isDark,
}: {
  notes: FieldNotesProps | null;
  selectedNotesTarget: FieldNotesInspectionTarget | null;
  effectiveInspectionTarget: FieldNotesInspectionTarget | null;
  ac: string;
  isDark: boolean;
}) {
  const [selOutcome, setSelOutcome] = useState<ScoutNoteOutcome>("confirmed");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSubmitError, setNoteSubmitError] = useState<string | null>(null);
  const [noteSubmitStatus, setNoteSubmitStatus] = useState<string | null>(null);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [submittedNoteEntries, setSubmittedNoteEntries] = useState<
    readonly FieldNotesProps["entries"][number][]
  >([]);
  const [queuedNoteEntries, setQueuedNoteEntries] = useState<
    readonly FieldNotesProps["entries"][number][]
  >([]);

  /* Reset form state when inspection target changes */
  useEffect(() => {
    setSelOutcome("confirmed");
    setNoteDraft("");
    setNoteSubmitError(null);
    setNoteSubmitStatus(null);
    setIsSubmittingNote(false);
    setSubmittedNoteEntries([]);
    setQueuedNoteEntries([]);
  }, [
    effectiveInspectionTarget?.cellKey,
    effectiveInspectionTarget?.findingId,
    effectiveInspectionTarget?.zoneId,
    notes?.fieldId,
  ]);

  const reloadQueuedNotes = useCallback(async () => {
    if (!notes?.fieldId) {
      setQueuedNoteEntries([]);
      return;
    }

    const queuedNotes = await listQueuedOfflineScoutNotes(notes.fieldId);
    setQueuedNoteEntries(
      queuedNotes.map((note) => ({
        id: `offline:${note.id}`,
        date: note.payload.observedAt ?? note.createdAt,
        text: note.payload.noteText,
        status: note.payload.outcome,
        syncStatus: note.syncStatus,
        findingId: note.payload.findingId,
        zoneId: note.payload.zoneId,
        cellKey: note.payload.cellKey,
      })),
    );
  }, [notes?.fieldId]);

  useEffect(() => {
    void reloadQueuedNotes();
  }, [reloadQueuedNotes]);

  /* Compute scoped + submitted note entries */
  const scopedBaseNoteEntries =
    selectedNotesTarget != null && notes != null
      ? notes.entries.filter(
          (entry) =>
            (selectedNotesTarget.findingId != null &&
              entry.findingId === selectedNotesTarget.findingId) ||
            (selectedNotesTarget.zoneId != null &&
              entry.zoneId === selectedNotesTarget.zoneId) ||
            (selectedNotesTarget.cellKey != null &&
              entry.cellKey === selectedNotesTarget.cellKey),
        )
      : (notes?.entries ?? []);
  const scopedQueuedNoteEntries =
    selectedNotesTarget != null
      ? queuedNoteEntries.filter(
          (entry) =>
            (selectedNotesTarget.findingId != null &&
              entry.findingId === selectedNotesTarget.findingId) ||
            (selectedNotesTarget.zoneId != null &&
              entry.zoneId === selectedNotesTarget.zoneId) ||
            (selectedNotesTarget.cellKey != null &&
              entry.cellKey === selectedNotesTarget.cellKey),
        )
      : queuedNoteEntries;
  const noteEntries = [...scopedQueuedNoteEntries, ...submittedNoteEntries, ...scopedBaseNoteEntries].filter(
    (entry, index, entries) =>
      entries.findIndex((candidate) => candidate.id === entry.id) === index,
  );

  const flushQueuedNotes = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    const result = await flushOfflineScoutNotesQueue();
    if (!notes?.fieldId) {
      return;
    }

    const syncedNotes = result.syncedNotes
      .filter((entry) => entry.fieldId === notes.fieldId)
      .map((entry) => ({
        id: entry.note.id,
        date: entry.note.observedAt,
        text: entry.note.noteText,
        status: entry.note.outcome,
        findingId: entry.note.findingId ?? null,
        zoneId: entry.note.zoneId ?? null,
        cellKey: entry.note.cellKey ?? null,
      }));

    if (syncedNotes.length > 0) {
      setSubmittedNoteEntries((current) => [...syncedNotes, ...current]);
      setNoteSubmitStatus("Offline scout notes synced.");
      setNoteSubmitError(null);
    }

    await reloadQueuedNotes();
  }, [notes?.fieldId, reloadQueuedNotes]);

  useEffect(() => {
    void flushQueuedNotes();

    const handleOnline = () => {
      void flushQueuedNotes();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flushQueuedNotes]);

  const handleNoteSubmit = useCallback(async () => {
    const trimmed = noteDraft.trim();

    if (!notes?.submitUrl) {
      setNoteSubmitError("Scout note submission is unavailable for this field.");
      return;
    }

    if (!trimmed || isSubmittingNote) {
      return;
    }

    setIsSubmittingNote(true);
    setNoteSubmitError(null);
    setNoteSubmitStatus(null);

    const payload = {
      outcome: selOutcome,
      noteText: trimmed,
      findingId: effectiveInspectionTarget?.findingId ?? null,
      zoneId: effectiveInspectionTarget?.zoneId ?? null,
      cellKey: effectiveInspectionTarget?.cellKey ?? null,
      observedAt: null,
    } as const;

    const queueCurrentNote = async () => {
      const queuedNote = await queueOfflineScoutNote({
        fieldId: notes.fieldId,
        workspaceId: notes.workspaceId,
        submitUrl: notes.submitUrl,
        payload,
      });

      setQueuedNoteEntries((current) => [
        {
          id: `offline:${queuedNote.id}`,
          date: queuedNote.createdAt,
          text: queuedNote.payload.noteText,
          status: queuedNote.payload.outcome,
          syncStatus: queuedNote.syncStatus,
          findingId: queuedNote.payload.findingId,
          zoneId: queuedNote.payload.zoneId,
          cellKey: queuedNote.payload.cellKey,
        },
        ...current,
      ]);
      setNoteDraft("");
      setNoteSubmitStatus("Saved offline. This scout note will sync when the connection returns.");
    };

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await queueCurrentNote();
        return;
      }

      const response = await fetch(notes.submitUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-fieldpulse-workspace-id": notes.workspaceId,
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            note?: {
              id: string;
              observedAt: string;
              noteText: string;
              outcome: ScoutNoteOutcome;
              findingId?: string | null;
              zoneId?: string | null;
              cellKey?: string | null;
            } | null;
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.note) {
        throw new Error(body?.error?.message ?? "Scout note submission failed.");
      }

      const savedNote = body.note;
      setSubmittedNoteEntries((current) => [
        {
          id: savedNote.id,
          date: savedNote.observedAt,
          text: savedNote.noteText,
          status: savedNote.outcome,
          findingId: savedNote.findingId ?? null,
          zoneId: savedNote.zoneId ?? null,
          cellKey: savedNote.cellKey ?? null,
        },
        ...current,
      ]);
      setNoteDraft("");
      setNoteSubmitStatus("Scout note saved.");
    } catch (error) {
      if (
        error instanceof TypeError ||
        (error instanceof Error &&
          /network|fetch|offline/i.test(error.message))
      ) {
        try {
          await queueCurrentNote();
          setNoteSubmitError(null);
          return;
        } catch (queueError) {
          setNoteSubmitError(
            queueError instanceof Error
              ? queueError.message
              : "Scout note submission failed.",
          );
          return;
        }
      }

      setNoteSubmitError(error instanceof Error ? error.message : "Scout note submission failed.");
    } finally {
      setIsSubmittingNote(false);
    }
  }, [effectiveInspectionTarget, isSubmittingNote, noteDraft, notes, selOutcome]);

  return (
    <>
      <Card span={-1} accent={ac}>
        <Lbl color={ac}>Inspection Target</Lbl>
        <div>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{effectiveInspectionTarget?.name ?? "No active target selected"}</span>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{effectiveInspectionTarget?.dateLabel ?? "Field-wide"}</span>
            <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{effectiveInspectionTarget?.coordinateLabel ?? "Hover or select a mapped cell to scope notes."}</span>
          </div>
        </div>
      </Card>
      <Card span={-1}>
        <LblM>What did you find?</LblM>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          {SCOUT_NOTE_OUTCOME_OPTIONS.map((o, i) => {
            const optionColor = isDark ? o.darkColor : o.lightColor;
            const selectedBorder = isDark ? o.selectedBorderDark : o.selectedBorderLight;
            return (
              <div
                key={i}
                onClick={() => setSelOutcome(o.id)}
                className={`fdp__outcome-card ${selOutcome === o.id ? "fdp__outcome-card--selected" : ""}`}
                style={{ borderColor: selOutcome === o.id ? selectedBorder : undefined }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: optionColor,
                  }}
                >
                  {o.title}
                </span>
                <div>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {o.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card span={-1}>
        <LblM>Field Observation</LblM>
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="Describe what you observed in the field..."
          style={{
            width: "100%",
            minHeight: 88,
            resize: "vertical",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border-light)",
            background: "var(--color-slate-50)",
            color: "var(--text-body)",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            lineHeight: 1.6,
            outline: "none",
          }}
        />
        {noteSubmitError ? (
          <Sub>{noteSubmitError}</Sub>
        ) : noteSubmitStatus ? (
          <Sub>{noteSubmitStatus}</Sub>
        ) : (
          <Sub>Submit a scout note against the current inspection target and keep it in the field history.</Sub>
        )}
        <button
          type="button"
          onClick={() => {
            void handleNoteSubmit();
          }}
          disabled={isSubmittingNote || noteDraft.trim().length === 0}
          style={{
            alignSelf: "flex-end",
            padding: "8px 20px",
            borderRadius: 999,
            background:
              isSubmittingNote || noteDraft.trim().length === 0
                ? "rgba(148, 163, 184, 0.45)"
                : isDark
                  ? "rgba(255,255,255,0.12)"
                  : ac,
            border: isDark ? "1px solid rgba(255,255,255,0.18)" : "none",
            cursor:
              isSubmittingNote || noteDraft.trim().length === 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, color: "white" }}>
            {isSubmittingNote ? "Saving…" : "Submit Scout Report"}
          </span>
        </button>
      </Card>
      <div style={{ gridColumn: "1 / -1", paddingTop: 4 }}>
        <LblM>Field Notes ({noteEntries.length})</LblM>
      </div>
      {noteEntries.map((n, i) => (
        <Card key={i} span={-1}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="fdp-mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>{new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            {n.status && (
              <span style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: n.status === "confirmed" ? "rgba(239,68,68,0.12)" : n.status === "monitor" ? "rgba(245,158,11,0.12)" : n.status === "resolved" ? "rgba(22,163,74,0.12)" : "rgba(107,114,128,0.12)", color: n.status === "confirmed" ? "#ef4444" : n.status === "monitor" ? "#f59e0b" : n.status === "resolved" ? "#16a34a" : "#6b7280" }}>{titleCaseLabel(n.status.replace(/_/g, " "))}</span>
            )}
          </div>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-body)", lineHeight: 1.6 }}>{n.text}</span>
          {n.syncStatus ? (
            <Sub>{n.syncStatus === "pending" ? "Pending sync" : "Sync failed. Will retry when online."}</Sub>
          ) : null}
        </Card>
      ))}
      {noteEntries.length === 0 ? (
        <Card span={-1}>
          <Sub>No scout notes have been logged for this field yet.</Sub>
        </Card>
      ) : null}
    </>
  );
}
