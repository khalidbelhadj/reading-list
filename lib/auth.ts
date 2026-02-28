import { cookies } from "next/headers";

const AUTH_COOKIE = "auth_token";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env var is not set");
  return secret;
}

function getPassword() {
  const password = process.env.AUTH_PASSWORD;
  if (!password) throw new Error("AUTH_PASSWORD env var is not set");
  return password;
}

/** HMAC-SHA256 using Web Crypto API (works in Edge + Node) */
async function hmac(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create a signed token: `{issued_at_seconds_hex}.{hmac}` */
async function createToken(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000).toString(16);
  const signature = await hmac(issuedAt);
  return `${issuedAt}.${signature}`;
}

/** Verify token signature and check it hasn't expired */
export async function isValidToken(token: string): Promise<boolean> {
  const [issuedAtHex, signature] = token.split(".");
  if (!issuedAtHex || !signature) return false;

  const expectedSignature = await hmac(issuedAtHex);
  if (signature !== expectedSignature) return false;

  const issuedAt = parseInt(issuedAtHex, 16);
  const now = Math.floor(Date.now() / 1000);
  return now - issuedAt < TOKEN_MAX_AGE;
}

export function verifyPassword(input: string): boolean {
  return input === getPassword();
}

export async function setAuthCookie() {
  const token = await createToken();
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}
