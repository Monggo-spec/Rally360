import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SessionCard } from "@/components/session-card";
import { requireSession } from "@/lib/auth";
import { PLAYERS_PER_COURT } from "@/lib/config";
import { listUpcomingSessions } from "@/lib/queries";
import { dateKey, formatDayLabel } from "@/lib/schedule";

export const metadata: Metadata = { title: "Open play" };

export default async function OpenPlayPage() {
  const session = await requireSession();
  const sessions = await listUpcomingSessions(session.id);

  const byDay = sessions.reduce<Map<string, typeof sessions>>((groups, item) => {
    const key = dateKey(item.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map());

  return (
    <AppShell
      session={session}
      variant="member"
      title="Open play"
      subtitle={`Every court holds ${PLAYERS_PER_COURT} players. Everybody else waits in the queue for the next rotation.`}
    >
      {sessions.length === 0 ? (
        <p className="empty">No open play sessions on the calendar yet. The club posts them a week ahead.</p>
      ) : (
        <div className="stack" style={{ gap: 26 }}>
          {[...byDay.entries()].map(([key, items]) => (
            <section className="stack" key={key}>
              <h2 style={{ fontSize: 18 }}>{formatDayLabel(key)}</h2>
              <div className="session-list">
                {items.map((item) => (
                  <SessionCard key={item.id} session={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
