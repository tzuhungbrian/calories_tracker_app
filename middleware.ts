import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, getAuthSecret, verifySessionToken } from "@/lib/auth";

const publicPaths = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

function authNotConfiguredResponse(): Response {
  return new Response("Authentication is not configured.", {
    status: 500,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function apiUnauthorizedResponse(): Response {
  return NextResponse.json(
    { error: "Authentication required." },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

function loginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const expectedUsername = process.env.APP_USERNAME;
  const expectedPassword = process.env.APP_PASSWORD;
  const pathname = request.nextUrl.pathname;

  if (!expectedUsername || !expectedPassword) {
    return authNotConfiguredResponse();
  }

  const isAuthenticated = await verifySessionToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value, getAuthSecret(expectedUsername, expectedPassword));

  if (publicPaths.has(pathname)) {
    if (pathname === "/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return pathname.startsWith("/api/") ? apiUnauthorizedResponse() : loginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2)$).*)"
  ]
};
