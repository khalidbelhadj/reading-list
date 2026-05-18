import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirect } from "@/lib/url";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error, redirect: redirectTo } = await searchParams;

  if (user) {
    redirect(sanitizeRedirect(redirectTo));
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <LoginForm error={!!error} redirectTo={redirectTo} />
    </div>
  );
}
