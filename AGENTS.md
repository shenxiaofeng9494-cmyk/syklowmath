# Repository Guidelines

## Project Structure & Module Organization
- `app/` is the main Next.js 16 application (App Router). Source lives in `app/src/` with routes under `app/src/app/`, shared UI in `app/src/components/`, hooks in `app/src/hooks/`, and utilities in `app/src/lib/`.
- Static assets live in `app/public/` (videos, subtitles, worklets).
- `app/supabase/migrations/` contains database migrations and schema assets.
- `mcp_excalidraw-main/` is a separate TypeScript package for the Excalidraw MCP server (Node + Vite).
- Root docs (e.g., `README.md`, design notes) describe product and architecture.

## Build, Test, and Development Commands
Run all app commands from `app/`:
- `npm run dev` — start the Next.js dev server at `http://localhost:3000`.
- `npm run build` — production build.
- `npm run start` — serve the production build.
- `npm run lint` — run ESLint.

MCP server commands from `mcp_excalidraw-main/`:
- `npm run dev` — concurrent dev for server + Vite frontend.
- `npm run build` — build frontend and server.
- `npm run start` — build server and run `dist/index.js`.

## Coding Style & Naming Conventions
- TypeScript (strict) with React; keep 2-space indentation and prefer ES modules.
- Components use `PascalCase`, hooks use `useCamelCase`, utilities use `camelCase`.
- Follow Next.js App Router conventions for route folders and `page.tsx` files.
- Use Tailwind CSS utilities; keep class lists readable and grouped logically.
- Run `npm run lint` before pushing changes.

## Testing Guidelines
- No test runner is currently configured. If adding tests, document the framework and add scripts in `app/package.json`.
- Prefer colocating tests next to the module (e.g., `Foo.test.tsx` near `Foo.tsx`).

## Commit & Pull Request Guidelines
- Commit messages in this repo are short, imperative, and sentence-cased (e.g., “Add README…”, “Remove …”).
- PRs should include a clear description, testing notes, and screenshots for UI changes.
- Link related issues or design docs when applicable.

## Configuration & Secrets
- App environment variables live in `app/.env.local` (copy from `.env.local.example`).

- Avoid committing secrets; use `.env.local` for API keys and service tokens.

  Always respond in Chinese-simplified
