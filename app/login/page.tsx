import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    redirect(redirectTo || "/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm error={!!error} redirectTo={redirectTo} />
    </div>
  );
}
