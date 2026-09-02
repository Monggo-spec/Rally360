import type { Metadata } from "next";
import { ActionSelect } from "@/components/action-select";
import { AppShell } from "@/components/app-shell";
import { setMemberAccessAction } from "@/lib/actions/admin";
import { requireSession } from "@/lib/auth";
import { listMembers } from "@/lib/queries";
import { formatDateTime } from "@/lib/schedule";

export const metadata: Metadata = { title: "Members" };

export default async function AdminMembersPage() {
  const session = await requireSession("admin");
  const members = await listMembers();
  const admins = members.filter((member) => member.role === "admin").length;

  return (
    <AppShell
      session={session}
      variant="admin"
      title="Members"
      subtitle={`${members.length} accounts, ${admins} with admin access`}
    >
      <section className="card">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Directory</span>
            <h2 style={{ marginTop: 4 }}>Everyone with an account</h2>
          </div>
        </div>
        <div className="panel-body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Contact</th>
                  <th>Level</th>
                  <th>Joined</th>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.name}</strong>
                      {member.id === session.id ? <span className="pill volt" style={{ marginLeft: 8 }}>You</span> : null}
                    </td>
                    <td>
                      {member.email}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {member.phone ?? "No number on file"}
                      </div>
                    </td>
                    <td>
                      <span className="pill grey">{member.skillLevel}</span>
                    </td>
                    <td className="muted">{formatDateTime(member.createdAt)}</td>
                    <td>
                      <ActionSelect
                        action={setMemberAccessAction}
                        name="role"
                        value={member.role}
                        fields={{ userId: member.id, active: String(member.active) }}
                        options={[
                          { value: "player", label: "Player" },
                          { value: "admin", label: "Admin" },
                        ]}
                      />
                    </td>
                    <td>
                      <ActionSelect
                        action={setMemberAccessAction}
                        name="active"
                        value={String(member.active)}
                        fields={{ userId: member.id, role: member.role }}
                        options={[
                          { value: "true", label: "Active" },
                          { value: "false", label: "Suspended" },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
            Admins see every reservation and can run open play sessions. Players only ever see their own
            bookings plus which hours are free.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
