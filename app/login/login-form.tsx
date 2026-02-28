"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {pending ? <Spinner className="mx-auto size-4" /> : "Sign in"}
    </button>
  );
}

export function LoginForm({
  action,
  error,
}: {
  action: (formData: FormData) => void;
  error: boolean;
}) {
  return (
    <form action={action} className="flex w-full max-w-xs flex-col gap-4">
      <h1 className="text-lg font-medium">Reading List</h1>
      <input
        type="password"
        name="password"
        placeholder="Password"
        autoFocus
        required
        className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <SubmitButton />
      {error && <p className="text-sm text-destructive">Wrong password.</p>}
    </form>
  );
}
