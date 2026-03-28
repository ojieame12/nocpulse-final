import { headers } from "next/headers";

export async function createServerComponentRequest(pathname = "/") {
  const incomingHeaders = await headers();
  const requestHeaders = new Headers();

  incomingHeaders.forEach((value, key) => {
    requestHeaders.append(key, value);
  });

  return new Request(`http://localhost${pathname}`, {
    headers: requestHeaders,
  });
}
