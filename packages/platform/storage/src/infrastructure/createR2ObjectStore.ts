import { Buffer } from "node:buffer";
import { createHash, createHmac } from "node:crypto";
import type { ObjectStore, ObjectStorePutInput } from "../contracts/ObjectStore";

type CreateR2ObjectStoreInput = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
};

function sha256Hex(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeObjectPath(value: string) {
  return value
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toAmzDate(value: Date) {
  const iso = value.toISOString();
  return iso.replace(/[:-]|\.\d{3}/g, "");
}

function buildCanonicalHeaders(
  url: URL,
  amzDate: string,
  payloadHash: string,
  contentType?: string,
  cacheControl?: string,
  metadata?: Record<string, string>,
) {
  const headerEntries: [string, string][] = [
    ["host", url.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ];

  if (contentType) {
    headerEntries.push(["content-type", contentType]);
  }

  if (cacheControl) {
    headerEntries.push(["cache-control", cacheControl]);
  }

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      headerEntries.push([
        `x-amz-meta-${key.toLowerCase()}`,
        value.replace(/\s+/g, " ").trim(),
      ]);
    }
  }

  headerEntries.sort(([left], [right]) => left.localeCompare(right));

  const canonicalHeaders = headerEntries
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  const signedHeaders = headerEntries.map(([key]) => key).join(";");

  return {
    canonicalHeaders,
    signedHeaders,
    headers: Object.fromEntries(headerEntries),
  };
}

function signRequest(
  secretAccessKey: string,
  amzDate: string,
  canonicalRequest: string,
) {
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return {
    scope,
    signature,
  };
}

async function putR2Object(
  config: CreateR2ObjectStoreInput,
  input: ObjectStorePutInput,
) {
  const endpoint = new URL(
    trimTrailingSlash(
      config.endpoint ??
        `https://${config.accountId}.r2.cloudflarestorage.com`,
    ),
  );
  const basePath = trimTrailingSlash(endpoint.pathname || "");
  const objectPath = `${basePath}/${encodeRfc3986(input.bucket)}/${encodeObjectPath(input.key)}`;
  const url = new URL(endpoint.toString());
  url.pathname = objectPath;
  url.search = "";

  const now = new Date();
  const amzDate = toAmzDate(now);
  const payloadHash = sha256Hex(input.body);
  const { canonicalHeaders, signedHeaders, headers } = buildCanonicalHeaders(
    url,
    amzDate,
    payloadHash,
    input.contentType,
    input.cacheControl,
    input.metadata,
  );
  const canonicalRequest = [
    "PUT",
    objectPath || "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const { scope, signature } = signRequest(
    config.secretAccessKey,
    amzDate,
    canonicalRequest,
  );

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: [
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${signature}`,
      ].join(", "),
    },
    body: Buffer.from(input.body),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(
      `[storage] R2 putObject failed with ${response.status}: ${detail}`,
    );
  }

  return {
    ref: {
      bucket: input.bucket,
      key: input.key,
      version: response.headers.get("etag") ?? undefined,
    },
    etag: response.headers.get("etag"),
  };
}

export function createR2ObjectStore(
  input: CreateR2ObjectStoreInput,
): ObjectStore {
  return {
    putObject(putInput) {
      return putR2Object(input, putInput);
    },
  };
}
