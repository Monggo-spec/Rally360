"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { clearSessionCookie, registerMember, setSessionCookie, verifyCredentials } from "../auth";
import { SKILL_LEVELS } from "../config";
import { fail, type FormState } from "../form-state";
import {
  MOBILE_HINT,
  isPersonName,
  normalizePhilippineMobile,
  tidyName,
} from "../validation";

const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }).trim(),
  password: z.string().min(1, { error: "Enter your password." }),
});

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Enter your full name." })
    .refine(isPersonName, { error: "Names cannot contain numbers." }),
  email: z.email({ error: "Enter a valid email address." }).trim(),
  phone: z.string().trim().optional(),
  password: z.string().min(8, { error: "Use at least 8 characters." }),
  skillLevel: z.enum(SKILL_LEVELS),
});

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fail(z.flattenError(parsed.error).formErrors[0] ?? "Check your details.");

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) return fail("We could not match that email and password.");

  await setSessionCookie(user);
  redirect(user.role === "admin" ? "/admin" : "/play");
}

export async function registerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    skillLevel: formData.get("skillLevel"),
  });
  if (!parsed.success) {
    const issues = z.flattenError(parsed.error).fieldErrors;
    const first = Object.values(issues).flat()[0];
    return fail(first ?? "Check the form and try again.");
  }

  // The phone is optional, but if one is given it has to be reachable.
  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizePhilippineMobile(parsed.data.phone);
    if (!phone) return fail(`That is not a Philippine mobile number. ${MOBILE_HINT}`);
  }

  const result = await registerMember({
    ...parsed.data,
    name: tidyName(parsed.data.name),
    phone,
  });
  if (!result.ok) return fail(result.error);

  await setSessionCookie(result.user);
  redirect("/play");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/");
}
