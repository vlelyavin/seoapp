/**
 * API client for communicating with the FastAPI backend.
 * In production, requests go through nginx. In dev, we proxy through Next.js API routes.
 */

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS = 60_000;

/** Server-side fetch to FastAPI (used in API routes) */
export async function fastapiFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const url = `${FASTAPI_URL}${path}`;
  const { timeoutMs, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    return await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchInit?.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
