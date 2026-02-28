import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidToken } from "@/lib/auth";
import { login } from "./actions";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;
  if (token && (await isValidToken(token))) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm action={login} error={!!error} />
    </div>
  );
}
