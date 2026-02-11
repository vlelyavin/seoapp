/**
 * API client for communicating with the FastAPI backend.
 * In production, requests go through nginx. In dev, we proxy through Next.js API routes.
 */

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

/** Server-side fetch to FastAPI (used in API routes) */
export async function fastapiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${FASTAPI_URL}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}
