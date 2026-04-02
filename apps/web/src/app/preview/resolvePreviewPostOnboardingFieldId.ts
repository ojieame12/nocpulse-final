export function isPlaceholderPreviewFieldId(fieldId?: string | null) {
  return !fieldId || fieldId === "__empty__";
}

export function resolvePreviewPostOnboardingFieldId(input: {
  activeFieldId: string;
  preferredFieldId?: string | null;
}) {
  if (isPlaceholderPreviewFieldId(input.activeFieldId)) {
    return input.preferredFieldId ?? null;
  }

  return input.activeFieldId;
}
