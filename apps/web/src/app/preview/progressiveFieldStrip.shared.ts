import type { SidebarFieldItem } from "../../components/layout/Sidebar";

type OnboardingDispatchFieldInfo = {
  fieldId: string;
  fieldLabel: string;
};

type OnboardingDispatchStatus = {
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  fieldId: string | null;
};

export function mergeResolvedSidebarField(
  fields: SidebarFieldItem[],
  resolvedField: SidebarFieldItem,
) {
  const existingIndex = fields.findIndex((field) => field.id === resolvedField.id);

  if (existingIndex === -1) {
    return [...fields, resolvedField];
  }

  return fields.map((field, index) =>
    index === existingIndex ? resolvedField : field,
  );
}

export function resolveCompletedImportedFieldIds(options: {
  dispatchFieldMap: ReadonlyMap<string, OnboardingDispatchFieldInfo>;
  onboardingStatuses: ReadonlyMap<string, OnboardingDispatchStatus>;
  syncedFieldIds: ReadonlySet<string>;
}) {
  const completedFieldIds: string[] = [];
  const seenFieldIds = new Set<string>();

  for (const [dispatchId, dispatchField] of options.dispatchFieldMap) {
    const status = options.onboardingStatuses.get(dispatchId);

    if (status?.status !== "completed") {
      continue;
    }

    const fieldId = status.fieldId ?? dispatchField.fieldId;

    if (
      !fieldId ||
      options.syncedFieldIds.has(fieldId) ||
      seenFieldIds.has(fieldId)
    ) {
      continue;
    }

    seenFieldIds.add(fieldId);
    completedFieldIds.push(fieldId);
  }

  return completedFieldIds;
}
