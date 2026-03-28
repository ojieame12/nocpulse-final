import type { ObjectStoreRef } from "./ObjectStoreRef";

export type ObjectStorePutInput = {
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

export type ObjectStorePutResult = {
  ref: ObjectStoreRef;
  etag?: string | null;
};

export type ObjectStore = {
  putObject(input: ObjectStorePutInput): Promise<ObjectStorePutResult>;
};
