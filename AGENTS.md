# Repository Guidelines

## Project Structure & Modules

- `client/` — React + Vite frontend (`src/components`, `src/pages`, `src/lib`, `src/hooks`).
- `server/` — Express API (`index.ts`, `routes.ts`, `auth.ts`, `storage.ts`, `db.ts`).
- `shared/` — Cross‑layer TypeScript (e.g., `schema.ts`).
- `dist/` — Build output; frontend served from `dist/public` in production.
- Config: `vite.config.ts`, `tailwind.config.ts`, `drizzle.config.ts`, `tsconfig.json`.

## Build, Test, and Development

- `npm run dev` — Start dev server (Express + Vite, port `4001`).
- `npm run build` — Build client with Vite and bundle server with esbuild.
- `npm start` — Run the production build from `dist`.
- `npm run check` — TypeScript type checking.
- `npm run db:push` — Apply Drizzle schema to DB.
  Prereqs: Node 18+, PostgreSQL, `.env` with `DATABASE_URL`, `SESSION_SECRET`.

## Coding Style & Naming

- Language: TypeScript across client/server/shared.
- Formatting: Prettier defaults; 2‑space indent; semi‑colons; single quotes ok.
- Filenames: kebab-case (`bookmark-card.tsx`, `link-checker-service.ts`).
- Identifiers: `camelCase` for vars/functions, `PascalCase` for React components/types, `UPPER_SNAKE` for constants.
- Imports: prefer path aliases — `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets`.

## Testing Guidelines

- No test runner is configured yet. If adding tests, prefer Vitest + React Testing Library.
- Test files: `*.test.ts` / `*.test.tsx` near source or `client/src/__tests__`.
- Aim for unit tests on pure utils and integration tests for routes and hooks.
- Keep fast tests; mock network/db where possible.

## Commit & PR Guidelines

- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- Scope examples: `feat(server): add rate limit`, `fix(client): prevent double submit`.
- PRs must include: clear description, screenshots for UI changes, steps to verify, and linked issues.
- Keep PRs focused and < ~300 LOC when possible.

## Security & Configuration

- Never commit secrets; use `.env` (see `.env.example`).
- Default port is `4001`; run `npm run db:push` after schema updates in `shared/schema.ts`.
- Production serves static files from `dist/public`; ensure `npm run build` succeeds before `npm start`.
