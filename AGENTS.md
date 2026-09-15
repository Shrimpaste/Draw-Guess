# Repository Guidelines

## Project Structure & Module Organization
This repository is an npm workspace with two packages:

- `client/`: React 19 + Vite frontend. App entry is `client/src/main.jsx`, main UI lives in `client/src/App.jsx`, shared UI pieces live in `client/src/components/`, and tests sit beside source files such as `client/src/App.test.jsx`.
- `server/`: Express + WebSocket backend. HTTP app setup is in `server/src/createApp.js`, runtime entry is `server/src/index.js`, game logic is in `server/src/gameStore.js`, and database/security helpers live in `server/src/db.js`, `security.js`, and related modules.
- Root files: `package.json` defines workspace scripts, `README.md` covers local usage, and `DEVLOG-2026-04-11.md` records recent implementation notes.

## Build, Test, and Development Commands
- `npm install`: install root and workspace dependencies.
- `npm run dev --workspace server`: start the backend on `http://localhost:3001` with watch mode.
- `npm run dev --workspace client`: start the Vite frontend on `http://localhost:5173`.
- `npm run build`: build the client and run the server placeholder build step.
- `npm test`: run server and client Vitest suites from the root.
- `npm run test --workspace server` or `npm run test --workspace client`: run one package’s tests only.

## Coding Style & Naming Conventions
Use ES modules, 2-space indentation, semicolons, and double quotes, matching the existing codebase. Prefer `camelCase` for variables/functions, `PascalCase` for React components, and descriptive file names such as `CanvasBoard.jsx` or `createApp.test.js`. Keep tests close to the code they verify. No lint script is configured, so keep formatting consistent manually.

## Testing Guidelines
Vitest is used in both packages; the server also uses `supertest`, and the client uses Testing Library with `jsdom` setup in `client/src/test/setup.js`. Name tests `*.test.js` or `*.test.jsx`. Add or update tests whenever API behavior, room state logic, or core UI flows change. Run `npm test` before opening a PR.

## Commit & Pull Request Guidelines
Current history uses Conventional Commit style (`feat: initial draw and guess prototype`); continue with prefixes like `feat:`, `fix:`, and `chore:`. Keep each commit focused. PRs should include a short summary, linked issue if applicable, test/build results, and screenshots or short recordings for visible client changes.

## Security & Configuration Tips
Server behavior depends on `PORT`, `CLIENT_ORIGIN`, and `ADMIN_KEY`. Do not hardcode secrets or commit real admin keys. When changing auth, rate limiting, CORS, or moderation endpoints under `/api/admin/*`, document the impact in `README.md`.
