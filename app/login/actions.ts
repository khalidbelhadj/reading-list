"use server";

import { redirect } from "next/navigation";
import { verifyPassword, setAuthCookie } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = formData.get("password") as string;

  if (!verifyPassword(password)) {
    redirect("/login?error=1");
  }

  await setAuthCookie();
  redirect("/");
}
