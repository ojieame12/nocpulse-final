import type { ObjectStore } from "@fieldpulse/platform-storage";
import type { ReportArtifact } from "../contracts/ReportArtifact";
import type {
  ReportArtifactStore,
  SaveReportArtifactInput,
} from "./ReportArtifactStore";

type CreateObjectStoreReportArtifactStoreInput = {
  objectStore: ObjectStore;
  bucket: string;
};

function toStoredArtifact(
  artifact: ReportArtifact,
  bucket: string,
): ReportArtifact {
  return {
    ...artifact,
    url: `r2://${bucket}/${artifact.artifactKey}`,
    storageMode: "persisted",
  };
}

async function saveReportArtifact(
  input: CreateObjectStoreReportArtifactStoreInput,
  payload: SaveReportArtifactInput,
) {
  await input.objectStore.putObject({
    bucket: input.bucket,
    key: payload.artifact.artifactKey,
    body: payload.bytes,
    contentType: payload.contentType,
    cacheControl: payload.cacheControl,
    metadata: payload.metadata,
  });

  return toStoredArtifact(payload.artifact, input.bucket);
}

export function createObjectStoreReportArtifactStore(
  input: CreateObjectStoreReportArtifactStoreInput,
): ReportArtifactStore {
  return {
    save(payload) {
      return saveReportArtifact(input, payload);
    },
  };
}
