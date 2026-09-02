import Link from "next/link";
import { bookableDateKeys, formatDayLabel, todayKey } from "@/lib/schedule";

export function DayStrip({ basePath, activeKey }: { basePath: string; activeKey: string }) {
  const today = todayKey();
  return (
    <div className="daystrip">
      {bookableDateKeys().map((key) => (
        <Link
          key={key}
          href={`${basePath}?date=${key}`}
          className={key === activeKey ? "active" : undefined}
        >
          {key === today ? "Today" : formatDayLabel(key)}
        </Link>
      ))}
    </div>
  );
}
