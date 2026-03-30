import { headers } from "next/headers";

export async function createServerComponentRequest(
  pathname = "/",
  baseRequest?: Request,
) {
  const requestHeaders = new Headers();

  if (baseRequest) {
    baseRequest.headers.forEach((value, key) => {
      requestHeaders.append(key, value);
    });
  } else {
    const incomingHeaders = await headers();
    incomingHeaders.forEach((value, key) => {
      requestHeaders.append(key, value);
    });
  }

  return new Request(`http://localhost${pathname}`, {
    method: baseRequest?.method ?? "GET",
    headers: requestHeaders,
  });
}
