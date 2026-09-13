# MacroTrack

MacroTrack is a responsive, local-first nutrition tracker for logging food, monitoring daily calories and macros, saving favorite foods, reviewing history, and editing daily targets.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/macrotrack/src/App.tsx` — primary tracker UI, local state, validation, and localStorage persistence
- `artifacts/macrotrack/src/index.css` — responsive visual system and component styles
- `artifacts/macrotrack/.replit-artifact/artifact.toml` — web artifact routing and workflow configuration
- `attached_assets/` — original self-contained MacroTrack HTML reference

## Architecture decisions

- MacroTrack is frontend-only for the first release; localStorage keeps logging fast and usable on a phone without requiring an account.
- Stored data is normalized on load so malformed or older localStorage values do not break the app.
- The UI is a single responsive route with modal surfaces for food entry, favorites, history, and daily targets.

## Product

- Log, edit, and remove foods for today or a previously logged day.
- Track calories, protein, carbohydrates, and fat against daily targets.
- Save foods as favorites and add them back in one tap.
- Browse logged days and return to today.
- Persist data locally on the device.

## User preferences

- The app must be usable on a phone.

## Gotchas

- Local data is device-specific and is not synced between devices.
- Production builds need `PORT` and `BASE_PATH` supplied by the managed artifact workflow.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
