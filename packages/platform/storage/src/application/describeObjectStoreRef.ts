import type { ObjectStoreRef } from "../contracts/ObjectStoreRef";

export function describeObjectStoreRef(ref: ObjectStoreRef) {
  return `${ref.bucket}/${ref.key}`;
}
