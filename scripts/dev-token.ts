#!/usr/bin/env bun
// An access token for the local stack's dev user, for scripts and agents
// that call the API directly:
//
//   curl -H "Authorization: Bearer $(bun run --silent dev:token)" localhost:3000/api/items
//
// Local only: the hosted project has no password user.
import { DEV_USER, resolveBackend } from "./profiles";

const backend = resolveBackend("local");
const anonKey = backend.values.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const response = await fetch(
  `${backend.supabaseUrl}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify(DEV_USER),
  },
);
if (!response.ok) {
  console.error(
    `sign-in failed (${response.status}): ${await response.text()}`,
  );
  process.exit(1);
}
const { access_token: token } = (await response.json()) as {
  access_token: string;
};
console.log(token);
