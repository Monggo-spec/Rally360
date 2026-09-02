# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# Project notes

- Branding is a **template**. Club name, copy, and artwork live in `src/lib/brand.ts` and `public/brand/*.svg`. Nothing else hardcodes them.
- Club rules (7 courts, 06:00–22:00, 4 players per court, 14-day booking window) live in `src/lib/config.ts`.
- `src/lib/schedule.ts` and `src/lib/open-play.ts` are pure and unit-tested. Put counting and availability logic there, not in pages or actions.
- Every Server Action calls `requireActionUser()` first — they are reachable by direct POST.
- Members must never see who booked a court. `getDayAvailability` returns slot *states* only; anything richer belongs behind an admin guard.
