import type { Metadata } from "next";
import { ActionSelect } from "@/components/action-select";
import { AppShell } from "@/components/app-shell";
import { setCourtStatusAction } from "@/lib/actions/admin";
import { requireSession } from "@/lib/auth";
import { CLOSE_HOUR, OPEN_HOUR, PLAYERS_PER_COURT } from "@/lib/config";
import { getDayAvailability, listCourts } from "@/lib/queries";
import { todayKey } from "@/lib/schedule";

export const metadata: Metadata = { title: "Courts" };

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "maintenance", label: "Maintenance" },
  { value: "closed", label: "Closed" },
];

export default async function AdminCourtsPage() {
  const session = await requireSession("admin");
  const today = todayKey();
  const [courts, availability] = await Promise.all([listCourts(), getDayAvailability(today)]);

  const bookedHours = new Map(
    availability.courts.map((court) => [
      court.courtId,
      court.slots.filter((slot) => slot.state === "booked" || slot.state === "open-play").length,
    ]),
  );

  return (
    <AppShell
      session={session}
      variant="admin"
      title="Courts"
      subtitle={`${courts.length} courts, ${OPEN_HOUR}:00 to ${CLOSE_HOUR}:00, ${PLAYERS_PER_COURT} players per court`}
    >
      <section className="card">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Court status</span>
            <h2 style={{ marginTop: 4 }}>
              {courts.filter((court) => court.status === "open").length} of {courts.length} open
            </h2>
          </div>
        </div>
        <div className="panel-body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Court</th>
                  <th>Surface</th>
                  <th>Location</th>
                  <th>Booked hours today</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court.id}>
                    <td>
                      <strong>{court.label}</strong>
                    </td>
                    <td className="muted">{court.surface}</td>
                    <td>
                      <span className="pill grey">{court.indoor ? "Indoor" : "Outdoor"}</span>
                    </td>
                    <td>
                      {bookedHours.get(court.id) ?? 0} of {CLOSE_HOUR - OPEN_HOUR}
                    </td>
                    <td>
                      <ActionSelect
                        action={setCourtStatusAction}
                        name="status"
                        value={court.status}
                        fields={{ courtId: court.id }}
                        options={STATUS_OPTIONS}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
            Marking a court as maintenance or closed hides every one of its hours from members immediately.
            Existing reservations are kept - cancel them from the Reservations page if the court has to go down.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
