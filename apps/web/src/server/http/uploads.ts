import { RequestContextError } from "../runtime/resolveRequestContext";

const ONE_MEBIBYTE = 1024 * 1024;

export const MAX_BOUNDARY_UPLOAD_BYTES = 5 * ONE_MEBIBYTE;
export const MAX_SPREADSHEET_UPLOAD_BYTES = 10 * ONE_MEBIBYTE;

function formatUploadLimit(maxBytes: number) {
  const wholeMiB = maxBytes / ONE_MEBIBYTE;
  return Number.isInteger(wholeMiB)
    ? `${wholeMiB} MB`
    : `${wholeMiB.toFixed(1)} MB`;
}

export function readUploadedFile(
  formData: FormData,
  key: string,
  options: {
    maxBytes: number;
  },
) {
  const file = formData.get(key);

  if (!(file instanceof File)) {
    throw new RequestContextError(400, `Form field \`${key}\` is required.`);
  }

  if (file.size <= 0) {
    throw new RequestContextError(400, `Uploaded file \`${key}\` is empty.`);
  }

  if (file.size > options.maxBytes) {
    throw new RequestContextError(
      413,
      `Uploaded file \`${key}\` exceeds the ${formatUploadLimit(options.maxBytes)} limit.`,
    );
  }

  return file;
}
