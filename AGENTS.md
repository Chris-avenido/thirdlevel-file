# thirdlevel-file

Third-level officials system: Express + PostgreSQL API in `api/`, Vite + React UI in `ui/`. Run all commands from the repo root.

## Commands
- Lint: `npm run lint`
- Test: `npm run test` (Vitest; one smoke test per app)
- Build: `npm run build` (UI only)
- Tier 2, once after all changes: `npm run lint && npm run test && npm run build`
- Dev servers: `npm run dev`

## Hard rules
1. Never print or commit secrets from `.env` files.
2. Schema changes are SQL files in `database/migrations/` (see `.agents/AGENTS.md`); rehearse locally, never touch the production DB or VM without asking.
3. Preserve existing behavior, validation, styling and business logic; make the smallest change that fixes the task.
4. Run Tier 2 once before saying work is done; after 3 failed repairs of one command, stop and report the error.
5. Never weaken lint or tests to get green.

## Routing
| Trigger | File |
| --- | --- |
| Code modification, bug-fix and migration rules | `.agents/AGENTS.md` |
| Agent architecture notes | `.agents/AGENT_ARCHITECTURE_GUIDE.md` |
| Folder conventions | `.agents/current-foldering-rules.md` |
| Verify changes (two-tier gate) | `.claude/skills/ci-gate/SKILL.md` |
| Score the folder structure | `.claude/skills/folder-architecture-audit/SKILL.md` |
| Set up or harden agent files | `.claude/skills/agent-ide-brain/SKILL.md` |
