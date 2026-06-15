# Orbit Meeting — Project Context & Instructions

Orbit Meeting is a real-time AI voice translation platform for video meetings. It enables participants to speak in their native language and hear others translated into their preferred language on-demand using Gemini Live.

## Project Architecture

The project is a monorepo consisting of:
- **Frontend**: Next.js 16 (Turbopack, React 19) located in `src/`.
- **Agent**: Python LiveKit Agents worker located in `translator/`.
- **Desktop**: Electron wrapper in `electron/`.
- **Mobile**: Capacitor Android project in `android/`.
- **Infrastructure**: Supabase for authentication and persistent settings.

### Technology Stack
- **Web**: Next.js 16, React 19, `@livekit/components-react`, `@supabase/ssr`.
- **Agent**: `livekit-agents` 1.5, Gemini Live API (raw WebSocket v1beta `BidiGenerateContent`).
- **Persistence**: Supabase (Auth, Profiles, Settings).
- **Package Managers**: `pnpm` (Node), `uv` (Python).

## Getting Started

### Prerequisites
- Node.js 20+, `pnpm`.
- Python 3.10+, `uv`.
- API Keys: LiveKit Cloud (URL, Key, Secret), Gemini API Key, Supabase (URL, Anon Key).

### Setup and Development
- **Initial Setup**: `pnpm run setup` (idempotent, installs deps and seeds `.env` files).
- **Run Full Stack**: `pnpm run dev` (starts frontend and agent concurrently).
- **Frontend Only**: `pnpm run dev:web`.
- **Agent Only**: `pnpm run dev:agent` (runs `uv run python src/agent.py dev` in `translator/`).
- **Electron**: `pnpm run dev:electron`.
- **Mobile (Android)**: `pnpm mobile:build`.

## Development Conventions

### Critical Synchronization
1.  **Agent Name**: The name `"gemini-translator"` is hardcoded in `translator/src/agent.py` and `src/app/api/token/route.ts`. Keep them in sync.
2.  **Configuration**: Constants in `src/lib/config.ts` (Frontend) and `translator/src/config.py` (Agent) must be mirrored (e.g., `NATIVE_LANG`, `PARTICIPANT_LANG_ATTR`).
3.  **Task Ledger**: Maintain `TASK.md` for all significant changes following the `TASK-YYYYMMDD-HHMMSS` format.

### Coding Patterns
- **Next.js**: Use modern Next.js 16 patterns. Note that `node_modules/next/dist/docs/` contains relevant documentation.
- **Hydration Safety**: Read from `sessionStorage` or `localStorage` inside `useEffect` to prevent SSR hydration mismatches.
- **Agent Logic**: The agent uses a demand-based model (reconcile loop in `router.py`). It skips translation if source language == target language.
- **LiveKit Enum**: Use `SOURCE_SCREENSHARE_AUDIO` (no underscore between SCREEN and SHARE) in Python to avoid `AttributeError`.
- **Gemini API**: The agent uses raw WebSockets (not the SDK) to control exact JSON shapes for the v1beta Live API.

### Testing
- **Agent**: Unit tests in `translator/tests/test_router.py`. Run with `uv run pytest` inside `translator/`.
- **Frontend**: Currently relies on manual verification and build checks (`pnpm build`).

## Key Files & Directories
- `src/app/`: Next.js App Router source.
- `translator/src/`: Python agent source (`agent.py`, `router.py`, `session.py`).
- `supabase/migrations/`: SQL schema and RLS policies.
- `AGENTS.md`: Detailed guide for AI agents working on this repo.
- `TASK.md`: Persistent task tracking ledger.
- `CLAUDE.md`: Existing environment-specific instructions (redirects to `AGENTS.md`).

## Deployment
- **Web**: Auto-deployed to Vercel via GitHub Actions.
- **Agent**: Deployed to LiveKit Cloud Agents using `lk agent deploy`.
- **Desktop**: Built using `electron-builder` (`pnpm electron:build:mac`, etc.).
- **Mobile**: Capacitor sync and Android Gradle build.
