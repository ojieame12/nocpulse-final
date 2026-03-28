export type ReportArtifact = {
  id: string;
  fieldId: string;
  artifactKey: string;
  url: string;
  storageMode: "ephemeral" | "persisted";
};
