import { resolve4, resolve6 } from "node:dns/promises";
import type { Item } from "@/lib/types";

const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.goog",
]);

const isPrivateIP = (ip: string): boolean => {
  if (ip === "::1" || ip === "0.0.0.0") return true;

  // IPv6 link-local (fe80::/10) or unique local (fc00::/7)
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;

  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
};

export const assertPublicUrl = async (url: string): Promise<void> => {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid scheme");
  }

  const hostname = parsed.hostname;

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Blocked hostname");
  }

  let ips: string[] = [];
  try {
    ips = await resolve4(hostname);
  } catch {}
  try {
    const v6 = await resolve6(hostname);
    ips = ips.concat(v6);
  } catch {}

  if (ips.length === 0) {
    throw new Error("Could not resolve hostname");
  }

  for (const ip of ips) {
    if (isPrivateIP(ip)) {
      throw new Error("Private IP address");
    }
  }
};

export const sanitizeRedirect = (next: string | undefined | null): string => {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  try {
    const url = new URL(next, "http://dummy");
    if (url.hostname !== "dummy") return "/";
  } catch {
    return "/";
  }
  return next;
};

export const normalizeUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
};

export const findDuplicateItem = (
  items: Item[] | undefined,
  rawUrl: string,
): Item | null => {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized || !items) return null;
  for (const item of items) {
    if (normalizeUrl(item.url) === normalized) return item;
  }
  return null;
};
