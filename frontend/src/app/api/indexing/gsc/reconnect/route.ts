import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";

/**
 * POST /api/indexing/gsc/reconnect
 * Returns the URL the user should visit to re-authorize with full scopes.
 * Uses a dedicated /api/indexing/gsc/callback endpoint (not NextAuth's callback)
 * so that the GSC OAuth flow doesn't conflict with NextAuth's state/PKCE validation.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.AUTH_GOOGLE_ID ?? "";
  const redirectUri = `${process.env.AUTH_URL ?? "http://localhost:3000"}/api/indexing/gsc/callback`;
  const state = randomUUID();

  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/webmasters",
    "https://www.googleapis.com/auth/indexing",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response = NextResponse.json({ authUrl });
  response.cookies.set("gsc_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  return response;
}
