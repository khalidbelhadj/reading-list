import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.goog",
]);

const isPrivateIPv4 = (ip: string): boolean => {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
};

const expandIPv6 = (ip: string): number[] | null => {
  const stripped = ip.replace(/^\[|\]$/g, "");
  const zoneIdx = stripped.indexOf("%");
  const base = zoneIdx === -1 ? stripped : stripped.slice(0, zoneIdx);

  const v4Match = base.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  let head = base;
  let tail4: number[] | null = null;
  if (v4Match) {
    const v4Parts = v4Match[2].split(".").map(Number);
    if (v4Parts.length !== 4 || v4Parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    head = v4Match[1].replace(/:$/, ":");
    tail4 = [(v4Parts[0] << 8) | v4Parts[1], (v4Parts[2] << 8) | v4Parts[3]];
  }

  const doubleColon = head.indexOf("::");
  let groups: string[];
  if (doubleColon === -1) {
    groups = head.split(":").filter((g) => g.length > 0);
  } else {
    const left = head.slice(0, doubleColon).split(":").filter((g) => g.length > 0);
    const right = head.slice(doubleColon + 2).split(":").filter((g) => g.length > 0);
    const targetLength = tail4 ? 6 : 8;
    const missing = targetLength - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  }

  const nums = groups.map((g) => parseInt(g, 16));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  const full = tail4 ? [...nums, ...tail4] : nums;
  if (full.length !== 8) return null;
  return full;
};

const isPrivateIPv6 = (ip: string): boolean => {
  const groups = expandIPv6(ip);
  if (!groups) return true;

  if (groups.every((g) => g === 0)) return true;
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;

  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  ) {
    const v4 = `${(groups[6] >> 8) & 0xff}.${groups[6] & 0xff}.${(groups[7] >> 8) & 0xff}.${groups[7] & 0xff}`;
    return isPrivateIPv4(v4);
  }

  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  if ((groups[0] & 0xff00) === 0xff00) return true;
  if (groups[0] === 0x0064 && groups[1] === 0xff9b && groups[2] === 0x0001) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0000) return true;

  return false;
};

export const isPrivateIP = (ip: string): boolean => {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
};

export const assertPublicUrl = async (url: string): Promise<void> => {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid scheme");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const lowerHost = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(lowerHost)) {
    throw new Error("Blocked hostname");
  }

  if (lowerHost === "localhost" || lowerHost.endsWith(".localhost")) {
    throw new Error("Blocked hostname");
  }

  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (isPrivateIP(hostname)) {
      throw new Error("Private IP address");
    }
    return;
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

export type SafeFetchOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  maxRedirects?: number;
};

export const safeFetch = async (
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> => {
  const maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(currentUrl);

    const res = await fetch(currentUrl, {
      headers: options.headers,
      redirect: "manual",
      signal: options.signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      if (hop === maxRedirects) {
        throw new Error("Too many redirects");
      }
      const next = new URL(location, currentUrl).toString();
      try {
        res.body?.cancel();
      } catch {}
      currentUrl = next;
      continue;
    }

    return res;
  }

  throw new Error("Too many redirects");
};
