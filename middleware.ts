import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function unauthorizedResponse(): Response {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Calories Tracker", charset="UTF-8"'
    }
  });
}

function authNotConfiguredResponse(): Response {
  return new Response("Basic Auth is not configured.", {
    status: 500,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(header.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const expectedUsername = process.env.APP_USERNAME;
  const expectedPassword = process.env.APP_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return authNotConfiguredResponse();
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));

  if (credentials?.username !== expectedUsername || credentials.password !== expectedPassword) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2)$).*)"
  ]
};
