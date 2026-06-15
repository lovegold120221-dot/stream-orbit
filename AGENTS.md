<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Orbit Meeting — Agent Guide

## Monorepo layout

Two independent projects with zero shared code:
- **Frontend:** `src/` — Next.js 16 (Turbopack, React 19), pnpm
- **Agent:** `translator/` — Python LiveKit Agents worker, uv

Other roots:
- `components/` — **Legacy `.js` files.** Do not touch. Pre-existing lint warnings are expected.
- `electron/` — Electron desktop wrapper around the Next.js standalone server
- `android/` — Capacitor Android project loading the production web app
- `supabase/migrations/` — SQL migrations (profiles, meetings, recordings, chat\_messages)
- `scripts/setup.sh` — Idempotent: seeds `.env` files + installs both halves' deps
- `public/` — PWA manifest, service worker, icons
- `.github/workflows/deploy.yml` — Vercel auto-deploy on push/PR to main
- `.github/workflows/signed-release.yml` — Signed macOS/Windows/Linux/Android release builds

Related instruction files: `GEMINI.md` (project overview), `translator/AGENTS.md` (Python agent TDD guide).

## Critical naming — must keep in sync

The agent dispatch name `"gemini-translator"` is hardcoded in **two places**. If you rename it, change both:

| File | Location |
|------|----------|
| `translator/src/agent.py` | `@server.rtc_session(agent_name="gemini-translator")` |
| `src/app/api/token/route.ts` | `const TRANSLATOR_AGENT_NAME = "gemini-translator"` |

A unique name (not `"translator"`) avoids collisions with stale Cloud Agents.

## Config pairing — must mirror

`src/lib/config.ts` ↔ `translator/src/config.py` share overlapping constants. These must stay in sync:

| Constant | Frontend | Agent |
|----------|----------|-------|
| Native sentinel | `NATIVE_LANG = "none"` | `NATIVE_LANG = "none"` |
| Lang attribute key | `PARTICIPANT_LANG_ATTR = "lang"` | `PARTICIPANT_LANG_ATTR = "lang"` |

The token route (`src/app/api/token/route.ts`) hardcodes `SESSION_TTL_SECONDS`, `EMPTY_ROOM_TIMEOUT`, `DEPARTURE_TIMEOUT`, and `MAX_PARTICIPANTS` separately — keep these in sync with `src/lib/config.ts` too.

## Commands

```bash
pnpm run setup       # Idempotent — seeds .env + installs both halves
pnpm run dev         # Frontend + agent concurrently
pnpm run dev:web     # next dev on :3000
pnpm run dev:agent   # uv run python src/agent.py dev (from translator/)
pnpm build           # next build (standalone, except on Vercel)
pnpm lint            # ESLint

# Agent (from translator/)
uv run pytest              # 14 unit tests (pure logic, no connectivity)
uv run ruff check          # Lint
uv run ruff format         # Format
```

**Validation gate:** run `pnpm build` **and** `cd translator && uv run pytest` before claiming a change is done. The translator CI runs these in order: `ruff check` → `ruff format --check` → `pytest`.

## Env files

| File | Variables | Used by |
|------|-----------|---------|
| `.env.local` | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Frontend token route |
| `translator/.env.local` | Same three + `GEMINI_API_KEY` | Python agent |
| `.env` (not committed) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings persistence |

## Translation track routing

Agent publishes tracks named `tx:<speaker_identity>:<track_source>:<target_lang>`.
- `track_source` is `"mic"` or `"screen_share_audio"`
- Frontend parses this in `useTranslationRouting.ts` to subscribe/unsubscribe
- Agent-published tracks carry `lk.translation` text-stream for captions

**Demand model:** a session exists iff at least one listener wants language `T` AND speaker `S` has an enabled mic AND `S.lang != T`. Grace teardown is 10s on mute to avoid thrash. Screen share audio is always translated regardless of the sharer's declared language.

## Key gotchas (agents miss these)

- **Build output differs by environment:** `next.config.ts` checks `process.env.VERCEL || process.env.CI` — sets `output: undefined` on Vercel/CI, `output: "standalone"` everywhere else. Docker copies `.next/standalone`.
- **Hydration safety:** Read `sessionStorage` inside `useEffect`, **never** in a `useState` initializer — prevents SSR mismatch.
- **Settings persistence:** `UserContext.tsx` upserts to Supabase; falls back silently if the `profiles` table doesn't exist. Anonymous user identity is a random UUID in `localStorage("orbitUserId")`.
- **Translator uses raw WebSockets** (not `@google/genai` SDK's `live.connect()`) to control exact JSON shape sent to Gemini v1beta. The `google-genai` SDK was removed as a dependency. See `translator/src/session.py` docstring.
- **TrackSource enum trap:** LiveKit protobuf defines `SOURCE_SCREENSHARE_AUDIO` (no underscore between SCREEN and SHARE). `SOURCE_SCREEN_SHARE_AUDIO` raises `AttributeError` — both occurrences in `router.py` must match.
- **Agent dependency pin:** `yarl<1.24` in `translator/pyproject.toml` — cp310-only wheel issue. Do not remove without testing on all supported Python versions.
- **`showSaveFilePicker()` requires secure context** (HTTPS or localhost). On HTTP deploys, recording falls back to `<a>` download.
- **Supabase migrations must be idempotent:** Use `DROP POLICY IF EXISTS` / `DROP CONSTRAINT IF EXISTS` before `CREATE` / `ALTER`. Column type changes require dropping dependent RLS policies first, then recreating with proper CASTs. See `supabase/migrations/003_chat_fk_fix.sql` for the pattern.
- **Android builds require JDK 21.** Set `JAVA_HOME` accordingly.
- **Electron Windows builds:** `electron-builder.yml` must include `"!.next/node_modules/**"` in `extraResources.filter` to avoid 7zip crash on dangling symlinks. Clean `.next/node_modules` before Windows builds.
- **`.pnpm-store/` at repo root** (global content-addressable store, not inside `node_modules/`). Never delete this directory. Ignored by `.gitignore`.
- **`TASK.md`** is the persistent task ledger. Every significant change gets a `TASK-YYYYMMDD-HHMMSS` record with START + TODO + FINAL REPORT sections.
- **API routes** (`/api/token`, `/api/translate-voice`, `/api/translate-text`, `/api/breakout`, `/api/moderate`, `/api/record`) are stateless — Vercel-friendly.
- **No frontend tests exist.** All tests are in `translator/tests/test_router.py` — pure unit tests with no LiveKit/Gemini connectivity.

## Python agent TDD

When modifying agent behavior (instructions, tool descriptions, workflows), read `translator/AGENTS.md` first. It mandates test-driven development: write tests before implementation, especially for the demand-reconciliation logic in `router.py`.
