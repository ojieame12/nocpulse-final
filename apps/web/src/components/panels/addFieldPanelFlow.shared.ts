export type AddFieldSubmitPhase =
  | "lld-lookup"
  | "lld-create"
  | "csv-preview"
  | "csv-save"
  | "csv-commit"
  | "boundary-parse"
  | "boundary-create"
  | "hydration-retry";

export function applySuggestedFieldName(
  currentFieldName: string,
  suggestedFieldName: string | null | undefined,
) {
  if (currentFieldName.trim()) {
    return currentFieldName;
  }

  const trimmedSuggestedFieldName = suggestedFieldName?.trim();
  return trimmedSuggestedFieldName && trimmedSuggestedFieldName.length > 0
    ? trimmedSuggestedFieldName
    : currentFieldName;
}

export function resolveAddFieldPrimaryLabel(input: {
  isRetryingHydration: boolean;
  isSubmitting: boolean;
  method: "lld" | "csv" | "kml";
  lldDraftReady: boolean;
  boundaryDraftReady: boolean;
  spreadsheetPreviewFieldCount: number | null;
  activeSubmitPhase: AddFieldSubmitPhase | null;
}) {
  if (input.isRetryingHydration || input.activeSubmitPhase === "hydration-retry") {
    return "Retrying Hydration";
  }

  if (input.isSubmitting) {
    switch (input.activeSubmitPhase) {
      case "lld-lookup":
        return "Looking Up";
      case "lld-create":
      case "boundary-create":
        return "Creating";
      case "csv-preview":
        return "Uploading";
      case "csv-save":
      case "csv-commit":
        return "Importing";
      case "boundary-parse":
        return "Parsing";
      default:
        break;
    }
  }

  switch (input.method) {
    case "lld":
      return input.lldDraftReady ? "Create Field" : "Lookup LLD";
    case "csv":
      return input.spreadsheetPreviewFieldCount != null
        ? `Import ${input.spreadsheetPreviewFieldCount} Fields`
        : "Upload & Preview";
    case "kml":
      return input.boundaryDraftReady ? "Create Field" : "Parse Boundary";
  }
}

export function resolveAddFieldProgressCopy(input: {
  activeSubmitPhase: AddFieldSubmitPhase | null;
  retryingHydrationFieldLabel: string | null;
  spreadsheetPreviewFieldCount: number | null;
}) {
  switch (input.activeSubmitPhase) {
    case "lld-lookup":
      return {
        title: "Searching land description databases…",
        detail: "LLD lookups typically resolve within a few seconds.",
      };
    case "lld-create":
      return {
        title: "Creating field boundary and queuing satellite analysis…",
        detail: "We are saving the field and starting its follow-up onboarding work.",
      };
    case "csv-preview":
      return {
        title: "Uploading spreadsheet and validating field rows…",
        detail: "This usually takes 5–15 seconds depending on file size.",
      };
    case "csv-save":
      return {
        title: "Saving the validated import batch…",
        detail:
          "We are storing this preview so a failed import can resume without re-uploading the file.",
      };
    case "csv-commit":
      return {
        title: "Creating fields, resolving boundaries, and queuing satellite onboarding…",
        detail:
          input.spreadsheetPreviewFieldCount != null
            ? `Importing ${input.spreadsheetPreviewFieldCount} fields — this may take up to a minute.`
            : "We are resuming the saved import batch and finishing field creation.",
      };
    case "boundary-parse":
      return {
        title: "Parsing boundary geometry from file…",
        detail: "Boundary parsing depends on file complexity.",
      };
    case "boundary-create":
      return {
        title: "Creating field from boundary and queuing analysis…",
        detail: "We are saving the field and starting its follow-up onboarding work.",
      };
    case "hydration-retry":
      return {
        title: `Retrying hydration for ${input.retryingHydrationFieldLabel ?? "that field"}…`,
        detail:
          "We are replaying field hydration context and queuing a fresh onboarding run.",
      };
    default:
      return null;
  }
}
