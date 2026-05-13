# Agents — Lead Generator

Codex CLI reads `agents.md`; Claude Code reads `CLAUDE.md`. This file is a pointer so Codex doesn't fly blind on this project.

For project rules, commands, architecture, and conventions, **read `CLAUDE.md`** in this same directory — it is the single source of truth.

## Quick pointer (1-line summary)

B2B lead generation tool for NC businesses. Express + SQLite (`@libsql/client` for Turso-compat) + Tailwind. Entry `node server.js` on port 3000. **Status: LOCKED DOWN 2026-04-02 for TCPA compliance — read CLAUDE.md before resuming any feature work.**

## Why this file exists

Pattern from Nate Herk's Codex tutorial (yt:3TdD8Qv5Tk8): different harnesses look for different config filenames, but the underlying project rules are the same. Keeping a one-line pointer here lets Codex sessions inherit the project context without duplicating CLAUDE.md (which would create drift).

If Codex needs the full ruleset, it can read `CLAUDE.md` directly via its Read tool.
