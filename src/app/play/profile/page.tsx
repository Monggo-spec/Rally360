import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { requireSession } from "@/lib/auth";
import { getMember } from "@/lib/queries";
import { formatDateTime } from "@/lib/schedule";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const session = await requireSession();
  const member = await getMember(session.id);
  if (!member) notFound();

  return (
    <AppShell
      session={session}
      variant="member"
      title="My profile"
      subtitle="Your details, and the skill level you play at"
    >
      <div className="stack" style={{ gap: 20, maxWidth: 560 }}>
        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Account</span>
              <h2 style={{ marginTop: 4 }}>{member.email}</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Member since {formatDateTime(member.createdAt)}
              </p>
            </div>
            <span className="pill grey">{member.role === "admin" ? "Admin" : "Member"}</span>
          </div>
          <div className="panel-body">
            <ProfileForm name={member.name} phone={member.phone} skillLevel={member.skillLevel} />
          </div>
        </section>

        <p className="muted" style={{ fontSize: 13 }}>
          Your email address is how you sign in, so the front desk changes it for you. Ask them if it
          needs to move.
        </p>
      </div>
    </AppShell>
  );
}
