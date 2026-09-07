"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { ensureAppReady } from "@/db/bootstrap";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireActionUser } from "../auth";
import { SKILL_LEVELS } from "../config";
import { fail, ok, type FormState } from "../form-state";
import {
  MOBILE_HINT,
  isPersonName,
  normalizePhilippineMobile,
  tidyName,
} from "../validation";

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Enter your full name." })
    .refine(isPersonName, { error: "Names cannot contain numbers." }),
  phone: z.string().trim().optional(),
  skillLevel: z.enum(SKILL_LEVELS),
});

/**
 * A member editing their own details. Skill level is deliberately here rather
 * than under the admin: it is a self-assessment used to sort open play, not a
 * rating the club hands out.
 */
export async function updateProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireActionUser();
  await ensureAppReady();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    skillLevel: formData.get("skillLevel"),
  });
  if (!parsed.success) {
    const issues = z.flattenError(parsed.error).fieldErrors;
    return fail(Object.values(issues).flat()[0] ?? "Check the form and try again.");
  }

  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizePhilippineMobile(parsed.data.phone);
    if (!phone) return fail(`That is not a Philippine mobile number. ${MOBILE_HINT}`);
  }

  await getDb()
    .update(users)
    .set({
      name: tidyName(parsed.data.name),
      phone,
      skillLevel: parsed.data.skillLevel,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.id));

  // The name shows in the shell and on the admin roster, and the skill level
  // shows on the TV board, so refresh everything that renders either.
  revalidatePath("/play");
  revalidatePath("/play/profile");
  revalidatePath("/play/open-play");
  revalidatePath("/admin/members");
  revalidatePath("/display");

  return ok("Profile saved.");
}
