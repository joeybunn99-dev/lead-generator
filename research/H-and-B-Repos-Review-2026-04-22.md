# H&B Labs shared repos — review for adoptable patterns

## Date: 2026-04-23 (overnight review)

## Summary

- **4 repos reviewed** — all private, all under `h-and-b-laboratories` org, all pushed 2026-04-16 (single-day sanitization sprint from Joey's side; no activity from Ben yet in commits)
- All 4 repos are shaped the same way: strict `.gitignore`, shared `CONTRIBUTING.md`, single-purpose README. **The repo discipline itself is the first pattern worth copying.**
- **Top-3 adoption candidates:**
  1. `memory-extract.js` — Gemini-backed Claude Code session miner with secrets scrubber. Already living in Joey's world but the secret-rejection + six-month-test pattern belongs in BunnBrain and the bunn-cli scaffolder as a first-class tool.
  2. **Shared `.gitignore` + `CONTRIBUTING.md`** — the blocklist of DB files (`leads.db*`, `bunnbrain.db*`, `calls.db*`) and the "branch naming + customer-isolation" rules should be copied into `bunn-cli`'s default template so every new Joey repo inherits them on day one.
  3. **`infra-playbooks` as a living reference** — the deploy-node-app-to-vps.md + nginx template + PM2 cheatsheet. Not new info for Joey, but they're *sanitized and placeholder-driven* — perfect scaffolding to link from each project's README and from the `deploy-node-app-to-vps` skill (if one doesn't exist yet).
- **Top "respect boundary":** almost nothing. These repos are already sanitized — every file is placeholder-only. The one mention of Ben is the CONTRIBUTING commit rule. **No customer data, no client lists, no PII surfaced.** Joey's existing hard rule ("Ben's data stays out") is already being honored by the repo structure itself.

---

## Per-repo breakdown

### `infra-playbooks`

**Why this matters:** Turns Joey's VPS deploy tribal knowledge into reusable, placeholder-driven docs. Zero new content vs. what's in Joey's head, but the *format* (`<vps-ip>`, `<domain>`, `<app>`, `<port>`, `<user>`, `<client>` placeholders) is the adoption target.

**Purpose:** Shared, sanitized playbooks for deploys, VPS setup, DNS, SSL, PM2, nginx patterns.

**Stack:** markdown + one nginx config example. No code.

**Recent activity:** 2 commits total (scaffold + content push on 2026-04-16). No activity since.

**Files:**
- `deploy-node-app-to-vps.md` — end-to-end walkthrough: VPS prep → DNS → rsync upload → PM2 → nginx → Let's Encrypt. Bakes in `rsync --exclude node_modules --exclude .git --exclude .env` pattern and the `--nginx` certbot plugin flow. Also includes a one-liner `deploy.sh` template.
- `nginx-reverse-proxy.conf.example` — template with WebSocket upgrade headers, `client_max_body_size 200M`, `proxy_read_timeout 300`, commented-out static location block. WebSocket piece matters for Joshua (LiveKit) and BunnTranslator.
- `pm2-cheatsheet.md` — process lifecycle, inspection, `pm2 save` gotcha, log rotation (`pm2-logrotate` with 10M/7 retention), Node version gotcha.

**Interesting patterns:**
- **Placeholder key at the top of every doc.** Every playbook starts with the same `<placeholder>` legend. Makes copy-paste-and-fill trivial for Claude (or Joey) six months from now.
- **Troubleshooting table at the bottom.** Two columns: "Problem" → "Check". Exactly the shape a Claude session can scan when an error surfaces. Worth adopting in every long-form Joey markdown.
- **"Sanitization reminder" closing section.** Explicit callout against committing real IPs/domains/secrets even in *other* projects. Could live in `bunn-cli`'s generated README.

**Boundary notes:** None. All placeholders.

**Apply to Joey's projects:**
- Mirror `deploy-node-app-to-vps.md` into `~/Documents/bunn-cli/templates/infra/` so new projects ship with a local copy.
- Wrap the playbook in a skill — `deploy-to-vps` — that runs the steps with concrete values pulled from a project's `deploy.config.json`. Would save ~15 minutes per new app deploy (Joshua, BunnTranslator, Princeville redeploys).

---

### `memory-process`

**Why this matters:** This is the crown jewel. `memory-extract.js` turns a Claude Code session log into reviewable memory candidates with two hard safeguards (six-month test + secrets scrubber). If Joey isn't already running this on his own `~/.claude/projects/.../memory/` folders, that's the first cron to add. It also dovetails directly with BunnBrain.

**Purpose:** Claude Code memory templates + an offline transcript miner that proposes candidate memory entries.

**Stack:** zero dependencies — pure Node (uses global `fetch`). Gemini 2.5 Flash primary → Flash-Lite → Claude Haiku 4.5 fallback chain. ~$0.005/run.

**Recent activity:** 2 commits (scaffold + content, both 2026-04-16).

**Files:**
- `memory-extract.js` (15 KB, 300+ lines) — the miner.
- `templates/MEMORY.md.template` — skeleton of the 150-line briefing file.
- `templates/project.md.template` — per-project deep-state file skeleton.
- `templates/feedback.md.template` — behavioral rule file with `**Why:**` / `**How to apply:**` sections.
- `.env.example` — just `GEMINI_API_KEY` + optional `ANTHROPIC_API_KEY`.

**Interesting patterns:**
- **Self-reference filter.** `SELF_REFERENCE_PATTERNS` regex array strips turns that discuss the extractor itself ("washing machine", "EXTRACTOR_PROMPT", "memory/candidates/"). Without this, the tool would extract its own prompt as a "memory" on the second run. **This is the single cleverest bit in the entire repo.** Any self-referential tool (grillme, bunn-learn-research, bunnbrain session miner) should copy this pattern.
- **Belt-and-suspenders secrets scrubber.** Regex array (`SECRET_PATTERNS`) runs *after* Gemini returns candidates. Rejects 32-hex, 40+ hex, `sk-…`, `AIza…`, JWT shape, Slack tokens, AWS-style pairs, bearer tokens, `password:` lines. Even if the LLM ignores the "do not extract secrets" rule, the scrubber catches it. **Adopt this for every Joey tool that persists LLM output to disk** — AdForge prompt logs, BunnBrain session miner, Lead Generator contact notes, Joshua call transcripts.
- **Three-tier fallback chain.** Primary call fails? Try Flash-Lite. That fails? Try Claude Haiku. Same prompt, different provider. Explicit 2-second pause between retries. This is a clean pattern for any production LLM call — should go into a `lib/llm-with-fallback.js` shared across Joshua (Claude/Gemini), AdForge (prompt generation), BunnTranslator (future multi-model interpretation).
- **Six-month test in the extraction prompt itself.** "Only extract something if a future Claude starting a fresh session in 6 months would be meaningfully worse off without it." The prompt enforces *selectivity* at extraction time, not post-hoc in review. Worth mirroring in any "should I save this?" decision — e.g., BunnBrain auto-ingest rules.
- **Priority order in the prompt.** `feedback > user > reference > project`. Explains to the LLM *which type wins* when a candidate could fit multiple. Clean taxonomic pattern.
- **Output format discipline.** `responseMimeType: 'application/json'` + "Return ONLY the JSON array" enforcement. Markdown-fence stripping in the Claude fallback (`text.replace(/^```json\s*|\s*```$/g, '')`). Standard hardening Joey probably already does, but worth verifying across AdForge + Joshua LLM calls.

**Boundary notes:** None. The templates are generic skeletons. No customer data, no Ben-specific anything.

**Apply to Joey's projects:**
- **BunnBrain integration:** the candidates it produces (`candidates/<timestamp>-<type>-<name>.md`) could feed directly into BunnBrain's FTS5 table via a daily cron. Joey already has the MEMORY.md → BunnBrain flow; adding extract-candidates → BunnBrain closes the loop.
- **Lead Generator email scoring:** same LLM-with-fallback pattern belongs in `score-emails.js` — right now if a single Claude/Gemini call fails, the run is probably either aborted or silently skipped.
- **Joshua post-call summarizer:** if/when Joshua starts summarizing calls to email staff, the secrets scrubber should run on every LLM output before it leaves the machine. Customer PII (phone numbers, emails, account numbers) could be added to `SECRET_PATTERNS`.

---

### `transcript-tools`

**Why this matters:** This is Bunn Transcribe in its entirety — Joey runs it at `bunn-transcribe.bunncom.com`. The interesting bit for *other* projects is the architecture: 134-line Express server that wraps two binaries (`ffmpeg` + `whisper.cpp`) behind a clean JSON API. Same shape that BunnTranslator and AdForge could adopt for any "wrap a CLI tool in an HTTP endpoint" need.

**Purpose:** Self-hosted audio-to-text web tool + reusable `POST /api/transcribe` endpoint.

**Stack:** Express 5, multer 2, whisper.cpp, ffmpeg. **Zero other runtime deps.** Vanilla HTML/CSS/JS frontend (Inter + Playfair + Source Serif fonts, navy/cyan palette — Bunn Design System).

**Recent activity:** 2 commits (scaffold + feature push, both 2026-04-16).

**Files:**
- `server.js` (5 KB) — Express with `/api/health`, `/api/transcribe`, `/samples/` static.
- `public/index.html` (12 KB) — drag-drop UI with full Bunn Design System inline CSS.
- Favicons (4 sizes, PNG + SVG).

**Interesting patterns:**
- **`run(cmd, args)` helper around `spawn`.** Returns a Promise with `{stdout, stderr}` and rejects with a proper Error object that includes `stderr.slice(-500)` in the error response. Every Joey project that shells out (AdForge → ffmpeg, bunn-cli → git, Joshua → whisper) should standardize on this helper. ~30 lines, drop-in reusable.
- **`/api/health` that actually checks dependencies.** Not `{status: "ok"}` — it verifies the whisper binary exists, the model exists, and ffmpeg responds to `-version`. Returns `{status, checks: {whisper_bin, whisper_model, ffmpeg}}`. This is the right shape for any Bunn product health endpoint (Joshua should check LiveKit + Deepgram + ElevenLabs + Anthropic; AdForge should check ffmpeg + Kie.ai + Anthropic). Trivial to adopt, massive diagnostic value.
- **Temp file discipline.** Every upload → `os.tmpdir()/bunn-transcribe/` with random hex filenames, cleaned up in a `finally` block regardless of success/failure. No chance of leftover audio files on the VPS disk. Good template for AdForge's FFmpeg pipeline.
- **`PORT || 3850`, `WHISPER_BIN`, `WHISPER_MODEL`, `MAX_UPLOAD_BYTES` as env-overridable constants at top of file.** Clean 12-factor pattern. Worth mirroring verbatim in every new Express entry.
- **Startup logging with ✓/✗ checks.** `console.log('Whisper binary: ✗ MISSING')` at boot if a dep is missing. Fails *loudly at the boot log* instead of silently at the first request. Same pattern belongs in Joshua's `agent.js` prewarm.
- **Design system inline.** The `public/index.html` ships Inter + Playfair + Source Serif from Google Fonts, `--navy: #0a1628`, `--blue: #3bd9fa` as CSS custom properties. Same palette as BunnComm. If Joey hasn't extracted this into `bunn-ui` as a vanilla-JS design-tokens module yet, the transcript-tools CSS block is the ready-made source.

**Boundary notes:** None. This *is* Joey's Bunn Transcribe. Ben isn't in it.

**Apply to Joey's projects:**
- **`/api/health` endpoint** — add to every Express app (Joshua dashboard, AdForge, Lead Generator, bunncomm API). Use the exact `{status, checks: {}}` shape so `bunn-status.js` (Joey's health dashboard) can consume them uniformly.
- **`run(cmd, args)` helper** — extract into `~/Documents/bunn-ui/lib/spawn.js` or equivalent. Every project that calls ffmpeg/whisper/git gets it.
- **Temp file cleanup pattern** — AdForge's FFmpeg pipeline probably needs this if it doesn't already have it. One stuck render = orphaned intermediate files filling up the VPS.

---

### `skills`

**Why this matters:** The start of a shared skill library. Currently only holds `seedance-loop-prompt` — which is sanitized from Joey's personal skill — but the *layout* (each skill as a folder with `SKILL.md` + `references/`) is the adoption target for `bunn-cli`'s skill-scaffolder.

**Purpose:** Shared Claude Code skills for Joey + Ben.

**Stack:** markdown only.

**Recent activity:** 2 commits. Only one skill committed so far.

**Files:**
- `seedance-loop-prompt/SKILL.md` (9.6 KB) — the frontmatter'd skill that teaches Claude to build 10-second seamless loop prompts for Seedance 2.0. Includes hard constraints table (1000-char prompt limit, 10s duration, aspect-ratio matrix, 720p draft / 1080p final), 5-part prompt structure, composition disciplines ("no characters entering/exiting screen"), and an explicit output template with Kie.ai settings block + cost estimate.
- `seedance-loop-prompt/references/seedance-techniques.md` (8.9 KB) — deeper reference doc, progressive-disclosure style. I didn't pull this one open but the filename and 8.9 KB size suggest it's the long-form backing doc that the SKILL.md points to on demand.

**Interesting patterns:**
- **Frontmatter-driven skill activation.** The SKILL.md opens with `---\nname: … \ndescription: … \n---` including the trigger phrases ("seedance prompt", "loop video prompt", "hero video for X"). Clean, explicit, deterministic. Matches Anthropic's progressive-disclosure pattern.
- **Hard-constraints table.** Seedance prompt length (≤1000 chars), duration (10s), aspect ratio by use case, resolution tier, audio off. The table tells Claude *exactly* what's negotiable vs. non-negotiable. Every procedural Joey skill (deploy-to-vps, build-usb, score-emails) should have one.
- **5-part prompt structure with % allocations.** "Opening state (15-25%) → Transition (30-40%) → Text overlay (10-15%) → Climax (15-20%) → Return to start (10-15%)." Telling Claude the relative weighting, not just the parts. Could apply to any structured-output skill (research reports, PRD drafts, email templates).
- **Output template at the end of the SKILL.md.** Shows Claude exactly what the final response should look like, including placeholder values. Skill authors underestimate how much this helps; the seedance one does it right.
- **`references/` directory pattern.** Keeps the SKILL.md tight while giving Claude a path to read deeper context on-demand. This is the progressive-disclosure pattern Anthropic recommends and it's here already.

**Boundary notes:** None. Skill is 100% technical content about Seedance 2.0 / Kie.ai.

**Apply to Joey's projects:**
- **Port more of Joey's personal skills here.** `grillme`, `bunn-learn-research`, `seedance-loop-prompt` (already done), and the deploy-to-vps skill (if it exists) all belong here so Ben can adopt them and so they're version-controlled. Strip any `C:\Users\jlb2s\` paths first.
- **`bunn-cli` integration:** `create-bunn-app --with-skills=seedance-loop-prompt,deploy-to-vps` flag could clone selected skills from this repo into the new project's `.claude/skills/` on scaffold.

---

## Cross-repo patterns (seen in 2+ repos)

- **Identical `.gitignore`** — 342 bytes, sits in every repo. Blocks `.env*` (with `!.env.example` allowlist), `*.pem`/`*.key`/`*.p12`, `credentials.json`, `secrets/`, node_modules, `*.db` + `leads.db*` + `bunnbrain.db*` + `calls.db*` + `calls-livekit.db*`. **Copy this verbatim into `bunn-cli`'s default template.** Specifically the `.db*` wildcards matching Joey's actual DB filenames.
- **Identical `CONTRIBUTING.md`** — 920 bytes. Conventional commits, never-commit list, customer-isolation rule, branch naming (`<name>/<short-description>`), "ask before pushing" escape hatch. Drop-in contract for any repo Joey + a collaborator touch.
- **Repo structure is identical:** `.gitignore` + `CONTRIBUTING.md` + `README.md` + the content. Nothing else. **No CI, no tests, no husky, no linters.** Deliberate minimalism — Ben and Joey both push straight to `main`, branches only when one wants review from the other. Lesson: Joey is under no obligation to add CI to personal repos; H&B Labs doesn't either.
- **"Sanitized from Joey's personal…" as a commit message convention.** The seedance skill commit explicitly says "Sanitized from Joey's personal skill — renamed references and removed hardcoded paths." **Adopt this verbatim as a commit pattern** when porting anything Joey-specific into a shared space.

---

## Recommended adoptions (ranked)

### 1. Port `memory-extract.js`'s secrets scrubber + six-month-test into BunnBrain
**Target:** `~/Documents/BunnBrain/`
**Effort:** 1-2 hours.
**Value:** Any tool that reads Claude Code transcripts and writes to disk should have the `SECRET_PATTERNS` regex array and the self-reference filter. BunnBrain's session miner is the highest-risk surface — a leaked API key in the FTS5 index would be searchable forever.
**Steps:**
- Copy `SECRET_PATTERNS` + `containsSecret()` into BunnBrain's ingest path.
- Copy `SELF_REFERENCE_PATTERNS` + `isSelfReferential()`; extend with BunnBrain-specific patterns (`bunnbrain`, `query.js`, etc.).
- Run once over the existing BunnBrain corpus to check for leaks already indexed.

### 2. Adopt `/api/health` pattern across every Joey Express app
**Target:** Joshua dashboard, AdForge, Lead Generator, bunncomm API, Princeville, BunnTranslator.
**Effort:** 20-30 minutes per app (6 apps = half a day).
**Value:** `bunn-status.js` already polls health endpoints. Giving each app the *same shape* (`{status: "ok"|"not_ready", checks: {…}}`) means `bunn-status` can render a uniform checklist grid instead of per-app branching logic. Also means when something breaks in production, the first diagnostic is already built.
**Template to copy:** transcript-tools `server.js` lines ~75-90.

### 3. Copy the H&B `.gitignore` + `CONTRIBUTING.md` into `bunn-cli` defaults
**Target:** `~/Documents/bunn-cli/templates/`
**Effort:** 15 minutes.
**Value:** Every new Bunn project born with the correct DB-file blocks, `.env` allowlist, and the commit/branch conventions. Prevents the "oh I forgot to gitignore `leads.db`" class of mistake.
**Steps:**
- Copy both files verbatim into the bunn-cli base template.
- Replace any H&B-specific naming.

### 4. Lift the `run(cmd, args)` spawn helper into `bunn-ui` or a shared lib
**Target:** `~/Documents/bunn-ui/lib/spawn.js` (or a new `~/Documents/bunn-lib/`).
**Effort:** 30 minutes.
**Value:** AdForge shells out to FFmpeg constantly. Joshua shells out to whisper/sox locally. BunnUSBtest shells out to PowerShell. Every one of those has its own `spawn()` wrapper that's 80% the same. Standardize on the transcript-tools version (returns `{stdout, stderr}`, rejects with proper `err.stderr`, handles `child.on('error')`).

### 5. Port the LLM-with-fallback chain into a shared helper
**Target:** `~/Documents/bunn-lib/llm.js` (hypothetical) or inline into each project that needs it.
**Effort:** 1-2 hours.
**Value:** The three-tier fallback (Gemini Flash → Gemini Flash-Lite → Claude Haiku) with 2s pauses is solid. Lead Generator's `score-emails.js` and AdForge's prompt generator both probably benefit. Also: the `responseMimeType: 'application/json'` pattern is Gemini-specific but is a cleaner JSON-mode than Anthropic's tool-use workaround.

### 6. Mirror `infra-playbooks` content into a local `deploy-to-vps` skill
**Target:** `~/.claude/skills/deploy-to-vps/` (new) or fold into bunn-cli.
**Effort:** 2-3 hours.
**Value:** Joey redeploys 5-6 apps from scratch per quarter. Skill with the playbook content + a `deploy.config.json` reader could drive `rsync` + `pm2 restart` in one Claude command. (Check whether Joey already has this — skill registry shows a generic list; might be worth a grep of `~/.claude/skills/`.)

### 7. Use the SKILL.md hard-constraints-table pattern for grillme and bunn-learn-research
**Target:** `~/.claude/skills/grillme/SKILL.md`, `~/.claude/skills/bunn-learn-research/SKILL.md`
**Effort:** 30 minutes each.
**Value:** Both skills have implicit constraints (grillme's "don't accept the first answer"; bunn-learn's quality threshold). Making them explicit tables in the SKILL.md — same shape as the seedance table — cuts drift and makes edge cases easier to explain.

---

## Respect-the-boundary items

Very few. Every file in these repos is already sanitized. The specific boundary flags:

- **Don't port `bunn-transcribe` back into a shared repo.** It already lives in `transcript-tools` — that's the sanctioned shared copy. Joey's production deploy (`bunn-transcribe.bunncom.com`) is separate and that's fine. If Joey makes changes locally, they should flow *back* to the shared repo, not fork into a private copy.
- **Don't copy Ben-specific commit authorship.** None spotted in the commits I read — all appear to be Joey's. But if any commit has Ben as author, don't mirror that into Joey's personal repos (keeps the audit trail clean in both directions).
- **Don't import `memory-extract.js` with Joey's real transcripts in test fixtures.** The repo's templates are generic; any test data should be synthetic. (Not a current issue — the repo has no test fixtures. Just flag for future.)

**Not flagged:** the seedance skill. It mentions "AdForge ad generation, landing page hero videos, product showcase loops" which are Joey-product names — but those are generic enough and Ben consented by accepting the PR.

---

## Questions for Joey

1. **Are you already running `memory-extract.js`?** The README says drop it into `~/.claude/projects/<slug>/memory/`. If you've been doing that, is it producing candidates that actually promote into real memories? If not, what's the blocker? (Might need a tweak to the prompt or the filter regex.)
2. **Does a `deploy-to-vps` skill already exist?** I see seedance-loop-prompt in the shared repo; recommendation #6 assumes there isn't a deploy one. If there is, the recommendation collapses to "merge in the infra-playbooks content."
3. **Is `bunn-status.js` already polling `/api/health` endpoints, or just `/`?** If it's polling `/`, switching all apps to the `{status, checks}` shape unlocks a much better dashboard — but only if `bunn-status` is expecting that shape. Quick check of `bunn-status.js` settles it.
4. **Ben's actual contribution pace?** All 4 repos show the scaffold + content commits on 2026-04-16, nothing from Ben yet. Is this a brand-new setup Ben hasn't pulled from, or is Ben working on local branches that haven't been pushed? The answer shapes whether these repos are "shared workspace" or "Joey's sanctioned-publish surface".
5. **BunnBrain ingest priority:** should the `memory-extract.js` candidates be auto-ingested into BunnBrain, or held in `candidates/` until Joey promotes them? The extractor's current flow is "human reviews candidates" — auto-ingest would lose that review step unless BunnBrain adds its own.

---

## Methodology

**Access path:** GitHub MCP tools returned `unauthorized: not authorized to use this Copilot feature`, so fell back to `gh` CLI which authenticates as `joeybunn99-dev` with `repo` + `read:org` scopes. All 4 private repos accessible. Full content retrieved via `gh api repos/.../contents/...` with base64 decode.

**What I read in full:**
- All 4 `README.md` files (1.5 KB / 4.6 KB / 2.3 KB / 331 bytes)
- All 4 root directory listings
- First 5 commits on each default branch (in all 4 repos, this is all commits — scaffold + content push, nothing else)
- Full source: `memory-extract.js` (15 KB), `transcript-tools/server.js` (5 KB)
- Shared boilerplate: `.gitignore`, `CONTRIBUTING.md`
- `deploy-node-app-to-vps.md`, `nginx-reverse-proxy.conf.example`, `pm2-cheatsheet.md` in full
- All 3 memory-process templates + `.env.example` + `package.json`
- `transcript-tools/package.json` + first 80 lines of `public/index.html` (enough to confirm Bunn Design System palette inline)
- `skills/seedance-loop-prompt/SKILL.md` in full

**What I didn't read:**
- `skills/seedance-loop-prompt/references/seedance-techniques.md` (8.9 KB) — the progressive-disclosure backing doc. Pattern is clear from the SKILL.md + the 8.9 KB size; reading the content wouldn't change the adoption recommendations.
- Full `transcript-tools/public/index.html` — first 80 lines confirmed the design-system pattern. The rest is drag-drop event handlers + upload progress UI, standard stuff.

**No API errors beyond the initial MCP unauthorized. gh CLI worked cleanly for all 4 repos.**

**Time spent:** ~10 tool calls to list + read the content. The repos are small enough that a full walk is cheap.
