# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full pipeline: generate → run → analyze → open HTML report
npm run ai:flow

# Individual steps
npm run ai:gen              # Generate Playwright tests from all stories in ./stories/
npm run ai:gen -- --story login.md   # Generate from a single story
npm run ai:test             # Run all Playwright tests
npm run ai:analyze          # AI failure analysis (JSON only)
npm run ai:report           # AI failure analysis + build/open HTML dashboard

# UI server (http://localhost:5173)
npm run ui

# Unit tests (Node built-in test runner, no Playwright)
npm test
npm run test:watch
```

**Environment:** `OPENAI_API_KEY` must be set (export or `.env` file) for `ai:gen`, `ai:analyze`, `ai:report`, and the UI's AI features.

## Architecture

The project is an AI-powered test automation pipeline built with Node.js ESM (`"type": "module"`). There are three distinct runtime layers:

### 1. Pipeline scripts (CLI)
- [generateTest.js](generateTest.js) — reads `.md` files from `stories/`, sends each to GPT-4.1-mini, writes `tests/<name>.spec.js`. Accepts `--story <filename>` to target a single story.
- [analyze/analyzeFailures.js](analyze/analyzeFailures.js) — reads `playwright-report.json` (Playwright's JSON reporter output), sends each failed test to GPT-4.1 via `client.responses.create`, writes `ai-analysis.json`. With `--html` flag also writes `ai-report.css` + `ai-report.html` and opens the browser.

### 2. Local UI server
- [server/server.mjs](server/server.mjs) — vanilla Node `http.createServer`, no framework. Serves static files from `ui/` and exposes a REST API at `/api/*`. The server is exported as `createServer(options)` for testability; `mockRuns: true` prevents subprocess execution in tests.
- Key API routes: `POST /api/stories` (validate + save story), `POST /api/run/ai-gen|tests|analyze|pipeline` (shell `exec` of npm scripts), `POST /api/ai/story` (AI story wizard), `POST /api/ai/fix-test` (AI auto-fix + backup).
- File safety: all file paths are validated through `safeStoryFile`/`safeTestFile`/`safeRelativePath` helpers before any FS operation.

### 3. Browser UI
- [ui/index.html](ui/index.html) + [ui/ui.js](ui/ui.js) — vanilla JS, no bundler. Modules in [ui/modules/](ui/modules/) split by concern: `api.js` (fetch wrappers), `editor.js`, `lists.js`, `runConsole.js`, `aiWizard.js`, `confirmModal.js`.

### Data flow
```
stories/*.md  →  generateTest.js  →  tests/*.spec.js
                                          ↓
                               playwright test (playwright-report.json)
                                          ↓
                             analyzeFailures.js  →  ai-analysis.json
                                                         ↓
                                              ai-report.html (dashboard)
```

### Testing
Unit tests use Node's built-in `node:test` runner (not Playwright). Server tests in [server/__tests__/api.test.js](server/__tests__/api.test.js) spin up a real HTTP server in a temp directory with `mockRuns: true`. Utility tests in [utils/__tests__/](utils/__tests__/) test `testHelpers.js` and `buildHtml`.

Run a single test file: `node --test server/__tests__/api.test.js`

### Story format
Stories are `.md` files in `stories/`. The AI analyzers use the filename stem (slugified) to look up matching stories for context. Expected format:
```
Title: <title>
Base URL: https://...

As a user, I want to ...

Acceptance criteria:
- step one
- step two
```

AI-fixed test backups are stored in `tests/.ai-backups/` (hidden in UI listings).
