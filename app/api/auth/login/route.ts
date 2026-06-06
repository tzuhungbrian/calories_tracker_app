import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, AUTH_SESSION_MAX_AGE_SECONDS, createSessionToken, getAuthSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginPayload = {
  username?: string;
  password?: string;
};

function authNotConfiguredResponse(): NextResponse {
  return NextResponse.json({ error: "Authentication is not configured." }, { status: 500 });
}

export async function POST(request: Request) {
  const expectedUsername = process.env.APP_USERNAME;
  const expectedPassword = process.env.APP_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return authNotConfiguredResponse();
  }

  const payload = (await request.json().catch(() => ({}))) as LoginPayload;

  if (payload.username !== expectedUsername || payload.password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await createSessionToken(expectedUsername, getAuthSecret(expectedUsername, expectedPassword));
  const response = NextResponse.json({ ok: true });

  response.cookies.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
