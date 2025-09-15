# System Notes and Reuse Rules

## Data Model (Tables)
- users: id (uuid), username (unique), password (scrypt hash).
- bookmarks: id, userId, name, url, description?, tags[], suggestedTags[], isFavorite, categoryId?, passcodeHash?, isShared, shareId, screenshotUrl?, screenshotStatus, screenshotUpdatedAt, linkStatus, httpStatus?, lastLinkCheckAt?, linkFailCount, createdAt, updatedAt.
- categories: id, userId, name, parentId?, createdAt.
- user_preferences: id, userId, theme('light'|'dark'), viewMode('grid'|'list'), createdAt, updatedAt.
- sessions: persisted via connect-pg-simple; table name is `session` (singular) in Postgres.

## Ownership & Access
- All queries are user-scoped by `userId` (bookmarks/categories/preferences).
- Unauthenticated reads default to demo user `VENSERA_USER_ID` where allowed.

## Bookmark Rules
- Client uses `passcode` (4–64 chars); server maps to `passcodeHash` (bcrypt).
- Create: `passcode` → hash; empty string → null; omit server-managed fields.
- Update: omit `passcode` to keep existing; set to null to remove; set to string to replace.
- Server-managed only: suggestedTags, screenshot*, linkStatus/httpStatus/lastLinkCheckAt/linkFailCount.

## Protected Bookmarks
- For update/delete/check-link/screenshot/auto-tags on protected items:
  - Require `passcode` in body. The provided secret may be either the bookmark's passcode or the owner's account password (only when the owner is authenticated). 400 on bad format; 401 on missing/invalid.
- Verify endpoint: `POST /api/bookmarks/:id/verify-passcode` → `{ valid }`. Accepts passcode or owner's account password when authenticated.

## Sharing
- `PATCH /api/bookmarks/:id/share` { isShared }: generates/clears `shareId`.
- Cannot share protected bookmarks (403).
- Public fetch: `GET /api/shared/:shareId` returns minimal safe fields.

## Query, Sort, Filter
- `GET /api/bookmarks` params: `search`, `categoryId`, `isFavorite`, `tags` (comma), `linkStatus`, `sortBy` (name|createdAt|isFavorite), `sortOrder` (asc|desc).
- Search matches name, description, url, and tags.

## Bulk Operations
- Delete: `POST /api/bookmarks/bulk/delete` { ids[], passcodes? }.
- Move: `PATCH /api/bookmarks/bulk/move` { ids[], categoryId|null, passcodes? }.
- For protected items, `passcodes` is a map of `id -> passcode`; failures are per-item.

## Auto‑Tagging
- Preview (no auth): `POST /api/bookmarks/preview-auto-tags` { url, name?, description? } → `{ suggestedTags }`.
- Existing: `POST /api/bookmarks/:id/auto-tags` (passcode if protected) → updates `suggestedTags`.

## Screenshots
- Trigger: `POST /api/bookmarks/:id/screenshot` → 202 Accepted; async processing.
- Status: `GET /api/bookmarks/:id/screenshot/status` → `{ status, screenshotUrl?, updatedAt }`.

## Link Checker
- Background service runs every 30m; batch size 25; concurrency 5; timeouts and redirect limits.
- Statuses: ok, broken, timeout, unknown; increments `linkFailCount` on non-ok.
- SSRF safeguards: DNS resolution, private IP/hostname blocklist, request timeouts.
- Admin-only manual trigger with rate-limit.

## Preferences
- `GET /api/preferences` returns user row or defaults.
- `PATCH /api/preferences` updates (auth required).

## Auth & Sessions
- Local auth via Passport (username/password); user passwords use scrypt; sessions via `express-session` + `connect-pg-simple` (table `session`).
