import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    resource:
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://reading-list.khalidbelhadj.com",
    authorization_servers: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
  });
}
