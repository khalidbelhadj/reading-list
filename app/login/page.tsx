import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidToken } from "@/lib/auth";
import { login } from "./actions";

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
      <form action={login} className="flex w-full max-w-xs flex-col gap-4">
        <h1 className="text-lg font-medium">Reading List</h1>
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </button>
        {error && <p className="text-sm text-destructive">Wrong password.</p>}
      </form>
    </div>
  );
}
