"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { FieldMarketProps } from "./MarketTab";

export function FieldMarketScenarioForm({
  field,
  submitLabel = "Save Scenario",
  onScenarioSaved,
  mode = "full",
}: {
  field: FieldMarketProps;
  submitLabel?: string;
  onScenarioSaved?: (() => void | Promise<void>) | null;
  mode?: "full" | "yield-only";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [basisInput, setBasisInput] = useState(
    field.basisAssumptionCadPerTonne != null
      ? field.basisAssumptionCadPerTonne.toFixed(2)
      : field.basisCadPerTonne != null
        ? field.basisCadPerTonne.toFixed(2)
        : "",
  );
  const [priceInput, setPriceInput] = useState(
    field.closePriceCadPerTonne != null ? field.closePriceCadPerTonne.toFixed(2) : "",
  );
  const [yieldInput, setYieldInput] = useState(
    field.yieldTonnesPerHa != null ? field.yieldTonnesPerHa.toFixed(2) : "",
  );
  const [seasonYearInput, setSeasonYearInput] = useState(
    field.seasonYear != null ? String(field.seasonYear) : "",
  );
  const [noteInput, setNoteInput] = useState(
    field.yieldAssumptionNoteText ?? field.basisAssumptionNoteText ?? "",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const allowPriceInput = mode === "full";
  const allowBasisInput = mode === "full";
  const allowNoteInput = mode === "full";

  useEffect(() => {
    setBasisInput(
      field.basisAssumptionCadPerTonne != null
        ? field.basisAssumptionCadPerTonne.toFixed(2)
        : field.basisCadPerTonne != null
          ? field.basisCadPerTonne.toFixed(2)
          : "",
    );
    setPriceInput(field.closePriceCadPerTonne != null ? field.closePriceCadPerTonne.toFixed(2) : "");
    setYieldInput(field.yieldTonnesPerHa != null ? field.yieldTonnesPerHa.toFixed(2) : "");
    setSeasonYearInput(field.seasonYear != null ? String(field.seasonYear) : "");
    setNoteInput(field.yieldAssumptionNoteText ?? field.basisAssumptionNoteText ?? "");
    setStatusMessage(null);
    setErrorMessage(null);
  }, [
    field.fieldId,
    field.closePriceCadPerTonne,
    field.basisCadPerTonne,
    field.basisAssumptionCadPerTonne,
    field.yieldTonnesPerHa,
    field.seasonYear,
    field.basisAssumptionNoteText,
    field.yieldAssumptionNoteText,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatusMessage(null);
    setErrorMessage(null);

    const parsedBasis =
      allowBasisInput && basisInput.trim().length > 0 ? Number(basisInput.trim()) : undefined;
    const parsedPrice =
      allowPriceInput && priceInput.trim().length > 0 ? Number(priceInput.trim()) : undefined;
    const parsedYield =
      yieldInput.trim().length > 0 ? Number(yieldInput.trim()) : undefined;
    const parsedSeasonYear =
      seasonYearInput.trim().length > 0 ? Number(seasonYearInput.trim()) : undefined;

    if (parsedBasis == null && parsedPrice == null && parsedYield == null) {
      setErrorMessage(
        mode === "yield-only"
          ? "Enter a field yield in tonnes per hectare."
          : "Enter a quote, a yield, a local basis, or any combination.",
      );
      return;
    }

    if (parsedBasis != null && !Number.isFinite(parsedBasis)) {
      setErrorMessage("Enter a valid local basis in CAD per tonne.");
      return;
    }

    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setErrorMessage("Enter a positive quote in CAD per tonne.");
      return;
    }

    if (parsedYield != null && (!Number.isFinite(parsedYield) || parsedYield <= 0)) {
      setErrorMessage("Enter a positive yield in tonnes per hectare.");
      return;
    }

    if (
      parsedSeasonYear !== undefined &&
      (!Number.isInteger(parsedSeasonYear) || parsedSeasonYear < 1900 || parsedSeasonYear > 3000)
    ) {
      setErrorMessage("Enter a valid season year.");
      return;
    }

    startTransition(async () => {
      try {
        const updates = await Promise.all([
          parsedPrice != null
            ? field.cropSymbol && field.priceSubmitUrl
              ? fetch(field.priceSubmitUrl, {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({
                    cropSymbol: field.cropSymbol,
                    closePriceCadPerTonne: parsedPrice,
                    sourceKey: "manual-panel",
                  }),
                }).then(async (response) => ({
                  kind: "price" as const,
                  ok: response.ok,
                  payload: (await response.json().catch(() => null)) as
                    | {
                        snapshot?: {
                          closePriceCadPerTonne?: number;
                        } | null;
                        error?: { message?: string };
                      }
                    | null,
                }))
              : Promise.resolve({
                  kind: "price" as const,
                  ok: false,
                  payload: {
                    error: {
                      message:
                        "A market symbol is required before saving a manual quote for this field.",
                    },
                  },
                })
            : Promise.resolve(null),
          parsedBasis != null
            ? fetch(field.basisSubmitUrl, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  cropSymbol: field.cropSymbol,
                  seasonYear: parsedSeasonYear,
                  basisCadPerTonne: parsedBasis,
                  noteText: allowNoteInput ? noteInput.trim() || undefined : undefined,
                  sourceKey: "manual-panel",
                }),
              }).then(async (response) => ({
                kind: "basis" as const,
                ok: response.ok,
                payload: (await response.json().catch(() => null)) as
                  | {
                      assumption?: {
                        basisCadPerTonne?: number;
                        seasonYear?: number | null;
                        noteText?: string | null;
                      } | null;
                      error?: { message?: string };
                    }
                  | null,
              }))
            : Promise.resolve(null),
          parsedYield != null
            ? fetch(field.yieldSubmitUrl, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  cropSymbol: field.cropSymbol,
                  seasonYear: parsedSeasonYear,
                  yieldTonnesPerHa: parsedYield,
                  noteText: allowNoteInput ? noteInput.trim() || undefined : undefined,
                  sourceKey: "manual-panel",
                }),
              }).then(async (response) => ({
                kind: "yield" as const,
                ok: response.ok,
                payload: (await response.json().catch(() => null)) as
                  | {
                      assumption?: {
                        yieldTonnesPerHa?: number;
                        seasonYear?: number | null;
                        noteText?: string | null;
                      } | null;
                      error?: { message?: string };
                    }
                  | null,
              }))
            : Promise.resolve(null),
        ]);

        const firstFailure = updates.find((entry) => entry && !entry.ok);
        if (firstFailure) {
          setErrorMessage(
            firstFailure.payload?.error?.message ?? "Failed to save market assumptions.",
          );
          return;
        }

        const savedBasis = updates.find((entry) => entry?.kind === "basis");
        const savedPrice = updates.find((entry) => entry?.kind === "price");
        const savedYield = updates.find((entry) => entry?.kind === "yield");

        const savedPriceSnapshot =
          savedPrice?.payload && "snapshot" in savedPrice.payload
            ? savedPrice.payload.snapshot
            : null;
        if (savedPriceSnapshot?.closePriceCadPerTonne != null) {
          setPriceInput(Number(savedPriceSnapshot.closePriceCadPerTonne).toFixed(2));
        }

        if (savedBasis?.payload?.assumption?.basisCadPerTonne != null) {
          setBasisInput(Number(savedBasis.payload.assumption.basisCadPerTonne).toFixed(2));
        }

        if (savedYield?.payload?.assumption?.yieldTonnesPerHa != null) {
          setYieldInput(Number(savedYield.payload.assumption.yieldTonnesPerHa).toFixed(2));
        }

        const savedSeasonYear =
          savedYield?.payload?.assumption?.seasonYear ??
          savedBasis?.payload?.assumption?.seasonYear;
        if (savedSeasonYear != null) {
          setSeasonYearInput(String(savedSeasonYear));
        }

        const savedNoteText =
          savedYield?.payload?.assumption?.noteText ??
          savedBasis?.payload?.assumption?.noteText;
        if (savedNoteText !== undefined) {
          setNoteInput(savedNoteText ?? noteInput);
        }

        setStatusMessage(
          parsedPrice != null && parsedBasis != null && parsedYield != null
            ? "Quote, yield, and basis saved."
            : parsedPrice != null && parsedBasis != null
              ? "Quote and basis saved."
              : parsedPrice != null && parsedYield != null
                ? "Quote and yield saved."
                : parsedBasis != null && parsedYield != null
                  ? "Yield and basis saved."
                  : parsedPrice != null
                    ? "Manual quote saved."
            : parsedBasis != null
              ? "Local basis saved."
              : mode === "yield-only"
                ? "Field yield saved."
                : "Yield assumption saved.",
        );
        await onScenarioSaved?.();
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to save market assumptions.",
        );
      }
    });
  }

  return (
    <form className="market__yield-form" onSubmit={handleSubmit}>
      <div className="market__yield-grid">
        {allowPriceInput ? (
          <label className="market__yield-field">
            <span className="market__yield-label">Manual quote (CAD/t)</span>
            <input
              className="market__yield-input"
              type="number"
              min="0"
              step="0.01"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder={field.cropSymbol ? "725.00" : "Requires market symbol"}
              disabled={!field.cropSymbol || !field.priceSubmitUrl}
            />
          </label>
        ) : null}

        {allowBasisInput ? (
          <label className="market__yield-field">
            <span className="market__yield-label">Local basis (CAD/t)</span>
            <input
              className="market__yield-input"
              type="number"
              step="0.01"
              value={basisInput}
              onChange={(event) => setBasisInput(event.target.value)}
              placeholder="-12.00"
            />
          </label>
        ) : null}

        <label className="market__yield-field">
          <span className="market__yield-label">Yield (t/ha)</span>
          <input
            className="market__yield-input"
            type="number"
            min="0"
            step="0.01"
            value={yieldInput}
            onChange={(event) => setYieldInput(event.target.value)}
            placeholder="Enter field yield"
          />
        </label>
        <label className="market__yield-field">
          <span className="market__yield-label">Season year</span>
          <input
            className="market__yield-input"
            type="number"
            min="1900"
            max="3000"
            step="1"
            value={seasonYearInput}
            onChange={(event) => setSeasonYearInput(event.target.value)}
            placeholder="2026"
          />
        </label>
      </div>

      {allowNoteInput ? (
        <label className="market__yield-field">
          <span className="market__yield-label">Note</span>
          <textarea
            className="market__yield-textarea"
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            placeholder="Optional note about how this yield was estimated"
          />
        </label>
      ) : null}

      <div className="market__yield-actions">
        <button className="market__yield-submit" type="submit" disabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </button>
        <span className="market__yield-meta">
          {field.closePriceCadPerTonne != null ||
          field.basisAssumptionCadPerTonne != null ||
          field.yieldTonnesPerHa != null
            ? [
                field.closePriceCadPerTonne != null
                  ? `Quote ${field.closePriceCadPerTonne.toFixed(2)} CAD/t`
                  : null,
                field.basisAssumptionCadPerTonne != null
                  ? `Basis ${field.basisAssumptionCadPerTonne.toFixed(2)} CAD/t`
                  : null,
                field.yieldTonnesPerHa != null
                  ? `Yield ${field.yieldTonnesPerHa.toFixed(2)} t/ha`
                  : null,
                field.yieldAssumptionCapturedAtLabel ??
                field.basisAssumptionCapturedAtLabel ??
                null,
                field.yieldAssumptionSourceLabel ??
                field.basisAssumptionSourceLabel ??
                null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "No stored quote, basis, or yield assumption yet"}
        </span>
      </div>

      {statusMessage ? <span className="market__yield-status">{statusMessage}</span> : null}
      {errorMessage ? <span className="market__yield-error">{errorMessage}</span> : null}
    </form>
  );
}
