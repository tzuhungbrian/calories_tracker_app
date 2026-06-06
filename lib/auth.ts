export const AUTH_SESSION_COOKIE = "ct_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64UrlToText(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

export function getAuthSecret(username: string, password: string): string {
  return `${username}:${password}`;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(username: string, secret: string): Promise<string> {
  const payload: SessionPayload = {
    username,
    expiresAt: Date.now() + AUTH_SESSION_MAX_AGE_SECONDS * 1000
  };
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = await sign(encodedPayload, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlToText(encodedPayload)) as Partial<SessionPayload>;
    return typeof payload.expiresAt === "number" && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}
