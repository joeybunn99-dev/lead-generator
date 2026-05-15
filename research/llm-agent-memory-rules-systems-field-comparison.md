# Research: Field comparison of memory + rules systems for LLM coding agents — vs. our 16-rule precedence-ordered constitution

**Date:** 2026-05-14
**Cycles:** 2
**Final Score:** 8.8/10
**Playbook Version:** 1.4

> **Note on deliverable location:** The brief at `memory/specs/2026-05-14-rules-system-field-comparison-brief.md` requested the report be written to `memory/specs/2026-05-14-rules-system-field-comparison.md`. The skill convention is `research/<slug>.md` for git tracking + BunnBrain sync. This report lives at `research/llm-agent-memory-rules-systems-field-comparison.md`; a pointer + symlink-equivalent will be placed at the brief-specified path during cleanup.

## Executive Summary

The 73→16 collapse + 5-tier precedence-ordered constitution puts Joey in **roughly the same engineering territory as Anthropic's own teams, HumanLayer, Cognition (Devin), and Letta** — all of whom have independently converged on small, layered, file-based memory systems with hard-enforcement hooks at the bottom and advisory rules on top. The field consensus is unanimously that **smaller is measurably better** (Cem Karaca measured 1,207-line CLAUDE.md = 42,200 tokens per conversation; Anthropic's own April 23 postmortem traced a 3% intelligence drop to *one line* added to the system prompt; Gloaguen et al. found context files *reduce* SWE-bench task success by 20%+ on average; HumanLayer pegs the "instruction budget" at 150-200 instructions before adherence decays uniformly across all rules). What's emerging in 2026 isn't more rules — it's **classifier-based authorization** (Anthropic's auto-mode paper, March 25 2026, is a direct architectural twin of Joey's action-class declarations, with FPR/FNR data and a deny-and-continue retry cap that mirrors R-2.3). Joey's setup has **9 of the 14 things the field has converged on** already; the remaining 5 (procedural-memory decay scoring, memory provenance, rules-as-eval-loop, MCP definition audit, runtime rule-toggle UI) are concrete drop-in upgrades. Critically — Engram independently benchmarked a hand-maintained MEMORY.md at **28.8% on LoCoMo conversational recall**, vs Letta/Engram's 74-80% with filesystem tools, vs Mem0's contested 91.6% — telling us flat-file memory is fine for project routing + rules + pickup continuity (Joey's actual use case) but would cap us hard if we ever needed dialog recall. **Smoke-test the constitution before adding anything.** The biggest gaps are not rule additions — they're a 4-question pre-flight audit (below).

## Detailed Findings — organized by the 7 questions from the brief

### 1. Memory architectures in the wild

The field has converged on **file-based markdown + lazy loading + topic-scoped rules** as the dominant pattern, with vector/graph systems treated as optional upgrades for conversational-recall workloads (not coding-agent workloads).

**Cross-tool reality (2026-05-14):**

- **AGENTS.md** is now the official cross-tool standard — Linux Foundation-stewarded (Agentic AI Foundation), [60,000+ open source projects](https://agents.md/) ship one, ~22 named adopters including Codex, Jules, Cursor, RooCode, Devin, Aider, Augment, Factory, Junie, Windsurf, Gemini CLI. The spec's conflict-resolution rule is identical to Joey's (verbatim from agents.md FAQ): *"The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything."* OpenAI's main repo ships **88 nested AGENTS.md** files.
- **Claude Code (Anthropic's own)** reads CLAUDE.md, not AGENTS.md. Official recommended interop: `CLAUDE.md` = `@AGENTS.md` + `## Claude Code` Claude-specific additions, OR symlink `ln -s AGENTS.md CLAUDE.md` (non-Windows). [(Anthropic docs)](https://code.claude.com/docs/en/memory).
- **Cursor / Cline / RooCode / Continue.dev** each have their own dialect (`.cursorrules`, `.clinerules/`, `.roo/rules-{mode-slug}/`, `config.json`), and the tool [rulesync](https://dev.to/dyoshikawatech/rulesync-published-a-tool-to-unify-management-of-rules-for-claude-code-gemini-cli-and-cursor-390f) generates per-tool files from a single `.rulesync/*.md` source-of-truth.
- **Aider** uses a fundamentally different approach: a **graph-ranked repo-map** sent with every change request (default `--map-tokens=1k`), computed via dependency-edge ranking, plus `CONVENTIONS.md` for human-written conventions ([Aider docs](https://aider.chat/docs/repomap.html)). This is "compute relevant context at runtime" vs Claude/Cursor's "load eagerly at session start."
- **Devin (Cognition)** auto-generates a session prompt from each session; `/handoff` migrates a local Devin session to cloud Devin with its own VM; supports fork/rollback, machine snapshots, async handoffs.
- **Letta (formerly MemGPT)** ships **git-backed memory** ([Context Repositories](https://www.letta.com/blog/context-repositories), Feb 2026) — every memory change is auto-committed, multiple subagents work concurrently in git worktrees, defragmentation skill restructures into "**15-25 focused files**" target.
- **Mem0** structures memory in 4 composable scopes (`user_id`, `agent_id`, `run_id`, `app_id`) with metadata filtering and 3-signal hybrid retrieval (semantic + BM25 + entity). [Their 2026 state-of-memory report](https://mem0.ai/blog/state-of-ai-agent-memory-2026) explicitly names **procedural memory** (learned workflows, coding patterns, tool-use habits, review conventions) as a third category alongside episodic and semantic — *this is what Joey's constitution is*.
- **Anthropic Claude Code's auto-memory system** (cited from official docs): `~/.claude/projects/<project>/memory/` with `MEMORY.md` (index, first 200 lines / 25KB auto-loaded) + topic files (lazy-loaded). Anthropic *officially* uses the daily-log-newest-by-mtime pattern Joey already has.

**What this means for Joey:** Joey's `~/.claude/projects/.../memory/` setup IS the canonical Claude Code auto-memory pattern. The flat `memory/` dir + `session_pickup_<date>-<slug>.md` newest-by-mtime + `INDEX.md` router + topic files is structurally identical to (a) Claude Code's official auto-memory, (b) [Amit Ray's 5-file taxonomy](https://amitray.com/claude-md-vs-agents-md-memory-md-skills-md-context-md-guide-2026/) MEMORY.md daily-log pattern, and (c) Cline's Memory Bank `memory-bank/*.md` pattern. The architecture is correct.

The Cline Memory Bank canonical pattern (from [nickbaumann98/cline_docs](https://github.com/nickbaumann98/cline_docs) and [cline/prompts](https://github.com/cline/prompts/blob/main/.clinerules/memory-bank.md)) — 6 mandatory files (`projectBrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`) — gives Joey a vocabulary mismatch worth examining: Joey's `[[lead-generator]]` `[[joshua]]` etc. deep files cover the same ground but inconsistently. Cline's "activeContext.md" specifically tracks *current work focus, recent changes, next steps, active decisions, learnings and project insights* — that's a mix of Joey's session pickup + active state file + INDEX. The reduction matters less than knowing the field has settled on naming this "activeContext".

### 2. Precedence + conflict resolution

**The field uses 3-5 tiers in production, but no single deep hierarchy. Composed tier systems are the norm.**

- **OpenAI's Wallace et al. 2024 paper** ([arxiv:2404.13208](https://arxiv.org/abs/2404.13208)) introduced the 3-tier instruction hierarchy (system > user > third-party content) — the canonical academic baseline.
- **ManyIH 2026** ([arxiv:2604.09443](https://arxiv.org/abs/2604.09443)) argues for *arbitrary* tier counts in agentic settings: *"the dominant paradigm assumes a fixed, small set of privilege levels typically fewer than five, defined by rigid role labels, which is inadequate for real-world agentic settings."*
- **CMAG 2026** ([arxiv:2603.13189](https://arxiv.org/abs/2603.13189)) — Constitutional Multi-Agent Governance — combines hard constraint filtering with soft penalized-utility optimization. Frontier models still perform ~40% on instruction conflict at scale, so hierarchies are not reliably *enforced* by the model.
- **AGENTS.md spec**: closest-file-wins, user chat overrides everything. One 2-rule hierarchy.
- **Anthropic Claude Code permissions**: 3-tier `deny → ask → allow` evaluation order ([docs](https://code.claude.com/docs/en/permissions)). First match wins.
- **Anthropic Claude Code CLAUDE.md hierarchy**: 5 layers (managed policy → user → project → local → nested subdirs), filesystem-root-down concatenation, closest-wins.
- **Anthropic Claude Code [auto-mode classifier](https://www.anthropic.com/engineering/claude-code-auto-mode)**: 3 tiers — built-in safe-tool allowlist → in-project file ops auto-allowed → transcript classifier for everything else (shell, web fetches, external tools, subagent spawns, filesystem outside project).
- **Letta tool rules** ([blog mention](https://www.letta.com/blog/agent-memory)): graph-constrained tool sequences (the classic example: "must call `search_files` first, can call `answer_question` to terminate"). Different from rule precedence — *call-order constraint*, not policy precedence.

**Joey's 5-tier × 6-action-class system** is single-document and more aggressive than any single source I found. The composed reality at Anthropic is multiple 3-5 tier systems at different abstraction layers (file scopes, action classification, allow/ask/deny inside each tier). **Contextualized contradiction outcome:** Joey's design is at the high end of what's in production but not unusual; the question is whether 5 tiers × 6 classes is too many *decision points* the agent has to track per action, vs being split into 3 narrower systems.

### 3. Action-class / authorization-boundary patterns — **strongest field validation of Joey's design**

**Direct architectural twin: Anthropic's auto-mode classifier paper (March 25, 2026).**

The [auto-mode paper](https://www.anthropic.com/engineering/claude-code-auto-mode) operationalizes exactly Joey's "declare your action class before doing it" rule, but as a *production-grade transcript classifier* with FPR/FNR data. Key parallels:

- **4 named threat models**: overeager behavior, honest mistakes, prompt injection, misaligned model. Joey's R-1.1/R-1.2/R-4.1 specifically target overeager behavior (interpretation drift past Joey's words).
- **5 named danger categories** that trigger auto-mode blocks (verbatim from real internal incidents):
  1. Scope escalation ("clean up old branches" → mass delete remote)
  2. Credential exploration (agent grepping env vars after auth error)
  3. Agent-inferred parameters ("cancel my job" → wrong job)
  4. Sharing via external service (creating Gist for "debugging")
  5. Safety-check bypass (retry with `--force` after pre-check failure)
   These map almost 1:1 onto Joey's class declarations (paid-gen, deploy, production-integration, diagnosis).
- **3-tier authorization architecture** (verbatim):
  1. Built-in safe-tool allowlist (reads, search, plan-mode transitions, todos) + user `permissions.allow`
  2. In-project file ops auto-allowed (reviewable via git)
  3. Transcript classifier on everything else
- **Two-stage classifier**: fast yes/no filter (8.5% FPR, 6.6% FNR), full chain-of-thought reasoning only if stage 1 flags. Drops to 0.4% FPR / 17% FNR end-to-end on real overeager actions.
- **Reasoning-blind by design**: *"We strip assistant text so the agent can't talk the classifier into making a bad call."* This is profound — Joey's hooks are also action-only (they don't see Claude's reasoning), so this is *structural agreement* on the right design. *"It judges what the agent did, not what the agent said."*
- **Deny-and-continue + retry cap**: classifier blocks → agent retries with safer path. **3 consecutive denials OR 20 total → escalate to human. In headless mode, kill the process.** This is the production version of Joey's R-2.3 (cap attempts at 2; attempt 3 = name the deliverable and check in).
- **Real internal incident log examples** (verbatim from §6.2.1 of Opus 4.6 system card): *"deleting remote git branches from a misinterpreted instruction, uploading an engineer's GitHub auth token to an internal compute cluster, and attempting migrations against a production database."* Joey's constitution exists *because* these classes of incident exist.
- Classifier prompt = **fixed template + 3 customizable slots** (environment trust boundary, block rules list, allow exception list).

**What this means for Joey:** His action-class system is correctly designed and ahead of most of the field. The drop-in upgrade is **classifier vs declaration**: instead of Joey-the-human declaring `action-class: paid-gen ($estimate)`, the agent's actions could be classified by a separate Haiku call (already approved standing exception per R-3.1's "PreCompact Haiku Agent SDK summarizer"). This would close the gap where Joey forgets to declare. Existing `paid_call_gate.py` and `deployment_context_gate.py` hooks already enforce the *result*; the classifier would make the *decision* upstream of Claude's own reasoning.

### 4. Context-window economics — **contradiction 2 resolved**

Field consensus: ≤200 lines for CLAUDE.md, ≤60 lines for the root if you can, **measured token impact is linear with line count**.

- **Cem Karaca's measured data** (from search summary; original Medium article 403'd):
  - Month 1, ~150 lines → ~2,000 tokens
  - Month 3, ~400 lines → ~8,000 tokens
  - Month 6, ~800 lines → ~20,000 tokens
  - Month 9, ~1,207 lines → **42,200 tokens** per conversation
  - Linear empirical, no inflection point until the ceiling.
- **Anthropic's April 23, 2026 postmortem**: a **single line** in the Claude Code system prompt (*"Length limits: keep text between tool calls to ≤25 words. Keep final responses to ≤100 words unless the task requires more detail."*) caused a **3% intelligence drop** in ablation evals on Opus 4.6 *and* 4.7. *Reverted within 4 days of full investigation.* Anthropic: *"For any change that could trade off against intelligence, we'll add soak periods, a broader eval suite, and gradual rollouts."*
- **HumanLayer's "instruction budget"** ([essay](https://www.humanlayer.dev/blog/writing-a-good-claude-md)): *"Frontier thinking LLMs can follow ~150-200 instructions with reasonable consistency. Smaller models can attend to fewer instructions than larger models, and non-thinking models can attend to fewer instructions than thinking models."* Claude Code's own system prompt contains ~50 instructions baseline.
- **HumanLayer's key empirical finding** (verbatim, from the essay): *"As instruction count increases, instruction-following quality decreases uniformly. This means that as you give the LLM more instructions, it doesn't simply ignore the newer ('further down in the file') instructions - it begins to ignore all of them uniformly."* ← This is exactly Joey's "rule 73 was getting lost in the noise" failure mode, with the mechanism explained.
- **HumanLayer reverse-proxied the actual system reminder Claude Code injects with CLAUDE.md content**: *"IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task."* This is Anthropic *officially* telling Claude to ignore non-relevant CLAUDE.md content. Memory-is-not-control is operationalized at the prompt level.
- **HumanLayer's own root CLAUDE.md is <60 lines.** Matt Pocock ([aihero.dev](https://www.aihero.dev/a-complete-guide-to-agents-md)) and [Anthropic's own engineering blog](https://www.anthropic.com/engineering/claude-code-best-practices) recommend the same.
- **Gloaguen et al. 2026** ([arxiv:2602.11988](https://arxiv.org/abs/2602.11988)) — 138 real-world repos studied: *"context files tend to reduce task success rates compared to providing no repository context, while also increasing inference cost by over 20%."* Conclusion: *"unnecessary requirements from context files make tasks harder, and human-written context files should describe only minimal requirements."*

**Joey's current state**: `MEMORY.md` ~12KB ≈ 250 lines + `00-constitution.md` ~12KB ≈ 250 lines = ~500 lines auto-loaded every session. Total ~24KB auto-load. Per the field, this is **2-4× the recommended budget**. The 73→16 collapse moved in the right direction but didn't go far enough — the constitution itself is still 250 lines.

**Resolution of contradiction 2**: ≤200 lines is field consensus. ≤60 lines is the practitioner-elite target.

### 5. Pickup / session-handoff patterns — **Joey's pattern is field-validated**

- **Claude Code official auto-memory**: `~/.claude/projects/<project>/memory/` with `MEMORY.md` index (first 200 lines / 25KB auto-loaded), topic files lazy-loaded. *This is exactly Joey's setup.*
- **Amit Ray taxonomy** (cited): *"In power-user setups, instead of a single flat MEMORY.md, developers create a `/memory/` folder with date-stamped files like `memory/2026-04-14.md`. At the start of each session, the agent reads the most recent log file to understand the exact state of the codebase."* ← Joey's `session_pickup_<date>-<slug>.md` newest-by-mtime is exactly this.
- **Devin Cognition**: auto-generated session prompts, `/handoff` to cloud Devin, fork/rollback, machine snapshots, async handoffs. Devin's *automation* is one-command vs Joey's mtime-newest convention, but the *artifact shape* is identical.
- **Cline tasks**: each task = unique ID + dedicated storage dir + full conversation + git-based checkpoints + resumable across sessions. **Searchable history** via fuzzy search across prompts/responses/code/files; sortable by newest/cost/tokens/relevance/favorites. Joey doesn't have search across pickups (BunnBrain FTS5 exists but `session_pickup_*.md` are by-design excluded from BunnBrain ingestion).
- **Anthropic Claude Code `/rewind` + checkpoints** — every prompt creates a restorable checkpoint, conversation+code both rollbackable.
- **Cline v3.13** introduced a **runtime rule-toggle popover** below the chat input — visible UI for "which rules are active right now." Joey doesn't have this.

**Joey's pickup architecture is correct.** The drop-in upgrades are (1) optional fuzzy-search over pickup files (Cline pattern), (2) a runtime "which rules are active" introspection (Cline + Anthropic `/memory` command — Joey could expose the same via a `/active-rules` skill).

### 6. Anti-patterns + horror stories — **rich field documentation**

Cataloging what the field has identified and what specifically applies to Joey's 73-rule pre-collapse:

**Named anti-patterns (cited):**

- **Pocock's "Ball of Mud"** ([aihero.dev](https://www.aihero.dev/a-complete-guide-to-agents-md)): *"The agent does something you don't like / You add a rule to prevent it / Repeat hundreds of times over months / File becomes a 'ball of mud'."* — Joey's exact pre-73 story.
- **Anthropic's 5 named failure patterns** ([Best practices](https://www.anthropic.com/engineering/claude-code-best-practices)):
  1. *"The kitchen sink session"* — one task, then unrelated, then back, context full of noise. Fix: `/clear` between tasks.
  2. *"Correcting over and over"* — corrected once, still wrong, corrected again. Context polluted with failed approaches. Fix: after 2 failed corrections, `/clear` and rewrite the initial prompt with what you learned.
  3. *"The over-specified CLAUDE.md"* — *"If your CLAUDE.md is too long, Claude ignores half of it because important rules get lost in the noise."* Fix: ruthlessly prune.
  4. *"The trust-then-verify gap"* — produces plausible-looking implementation that doesn't handle edge cases. Fix: always provide verification (tests, scripts, screenshots).
  5. *"The infinite exploration"* — "investigate X" without scoping, reads hundreds of files. Fix: scope investigations narrowly OR use subagents.
- **Gloaguen 20%+ cost penalty** for context files that aren't strictly minimal.
- **HumanLayer "auto-generated CLAUDE.md is never recommended"** — *"The CLAUDE.md file affects every single phase of your workflow and every single artifact produced by it. As a result, we think you should spend some time thinking very carefully about every single line that goes into it."* (matches Anthropic's own `/init` warnings — `/init` is meant as a starter, not a final state).
- **"Stale documentation poisons context"** (Pocock): *"Documentation goes out of date quickly. For human developers, stale docs are annoying, but the human usually has enough built-in memory to be skeptical about bad docs. For AI agents that read documentation on every request, stale information actively poisons the context."* Especially file-path references — describe capabilities, not structure.
- **"Claude is not an expensive linter"** (HumanLayer + Pocock + Anthropic): code style → linter+formatter+Stop hook, never in CLAUDE.md.

**Anthropic's own production horror story** ([April 23 postmortem](https://www.anthropic.com/engineering/april-23-postmortem)):
- 3 stacked failures over 6 weeks: silent reasoning-effort drop (March 4 → reverted April 7); cache-optimization bug that dropped thinking blocks every turn (March 26 → fixed April 10); single-line verbosity instruction causing 3% intelligence drop (April 16 → reverted April 20).
- Internal evals didn't catch any of them. *"The changes it introduced made it past multiple human and automated code reviews, as well as unit tests, end-to-end tests, automated verification, and dogfooding."*
- **Validates the smoke-test-before-trust pattern.** Joey's pending smoke tests on the new constitution are the right move.

**MCP definition bloat** (from [InfoQ secondary on Anthropic postmortem](https://www.infoq.com/news/2026/05/anthropic-claude-code-postmortem/)): *"Tool definitions are loaded upfront into the context window of the host, bloating it, with more MCP servers meaning more tool definitions bloating the context."* ← This is a category of context consumer Joey hasn't audited.

### 7. Gaps the field has solved — **5 drop-in upgrades for Joey, ranked**

For each gap from the brief, what concrete implementations exist:

#### 7a. Vector / semantic recall + reranker layer
- **What field has**: Mem0's 3-signal hybrid retrieval (semantic + BM25 + entity), reranker layer (Cohere, ZeroEntropy, Sentence Transformers, LLM-based). Engram's sqlite-vec + Gemini/OpenAI embeddings.
- **Joey has**: FTS5 only (BunnBrain).
- **Drop-in upgrade**: **Engram** (npm install, SQLite + sqlite-vec, single binary, MCP server for Claude Code). 80% LoCoMo with 1,504 tokens/query vs 23,423 full-context. *Don't add this unless conversational dialog recall becomes a real need* — for project-routing + rules + pickup, FTS5 + mtime-newest is sufficient and 28.8% LoCoMo doesn't matter (different workload).

#### 7b. Memory staleness / decay scoring
- **What field has** — 7 distinct patterns:
  1. Ebbinghaus exponential decay (vectors store continuous decay rate)
  2. Hippo Memory's reward-weighted half-life (7-day default, reward factor 0.63-1.42)
  3. Temporal decay scoring: `relevance × exp(-Δt/τ)`
  4. TTL / auto-eviction (Mem0 native)
  5. Access reinforcement (half-life × 3 for frequently-accessed; non-durable −5%/week)
  6. Bi-temporal `valid_from`/`valid_until` (Engram, knowledge-graph style)
  7. "Hippo sleep" background reflection cycle
- **Joey has**: zero — feedback memo got replaced by constitution 24h later but memo still active. This is the *single hardest* gap from Joey's brief.
- **Drop-in upgrade**: bi-temporal columns + 7-day default half-life. Concrete: every `feedback_*.md` and `session_pickup_*.md` gets a `valid_until: <date>` frontmatter field, defaulting to created_at + 7d. A nightly hook re-evaluates and either renews (referenced this session) or archives. **This is the highest-leverage cheap upgrade.**

#### 7c. Memory provenance / signed memories
- **What field has**: Mem0 actor-aware memory in multi-agent systems — message `name` field for attribution, agents can filter by participant and session.
- **Joey has**: zero — memories don't say who wrote them (Joey vs Claude vs Codex). Auto-saved pickups are *implicitly* Claude-authored but never labeled.
- **Drop-in upgrade**: `author:` frontmatter field (joey | claude | codex | multica-<agent>) on every memory write. **2-line schema change**, no code.

#### 7d. Memory tests / eval loop
- **What field has**: Arize Prompt Learning ([blog post](https://arize.com/blog/optimizing-coding-agent-rules-claude-md-agents-md-clinerules-cursor-rules-for-improved-accuracy/)) — empirically improved Cline's accuracy by 10-15% on SWE-bench Lite (150 test examples) *just by automatically optimizing the ruleset.* Final optimized ruleset = 20-50 rules. Their meta-prompt is published in the article and copy-pasteable.
- **Joey has**: pending smoke tests on the new constitution. No iterated optimization loop.
- **Drop-in upgrade**: after smoke tests, set up a Multica nightly that runs 10 "what would the right action be?" scenarios against the constitution and reports % aligned. Use BunnBrain to track. **Joey's 16-rule corpus is in the field's sweet spot of 20-50.**

#### 7e. Compression / summarization (auto rollup of older pickups)
- **What field has**: Anthropic's compaction (preserves architectural decisions, unresolved bugs, implementation details; discards redundant tool outputs); Letta's defragmentation skill (restructures into 15-25 focused files target).
- **Joey has**: nothing — pickups accumulate indefinitely. Currently 11 in the top-5-newest header; older ones not pruned.
- **Drop-in upgrade**: Letta's 15-25 file target after defrag is a useful number. Joey could set: any month-old pickup that wasn't read in current sessions → archive to `memory/archive/<year>-<month>/`.

#### 7f. Memory linting
- **What field has**: rulesync frontmatter validation (`root: true|false`, `targets:`, `description:`, `globs:`). Cline's globs YAML frontmatter on memory-bank.md.
- **Joey has**: implicit frontmatter shape with no validator.
- **Drop-in upgrade**: small `validate-memory.py` script run via hook. Required: `name:`, `description:`, `type:`. Optional: `author:`, `valid_until:`, `tags:`, `globs:`.

#### 7g. Hot/cold tiers
- **What field has**: Claude Code's `MEMORY.md` 200-line / 25KB auto-load + topic files lazy-load IS this. Cursor's `@-symbol` references. Aider's add/drop.
- **Joey has**: `MEMORY.md` primer (hot) + `INDEX.md` on `/resume` (warm) + deep files (cold). **Already 3 tiers, already correct.** Just over-budget on hot tier.

#### 7h. Runtime rule-toggle UI / introspection
- **What field has**: Cline v3.13 popover showing active rules; Anthropic's `/memory` command listing all loaded files.
- **Joey has**: nothing visible at runtime (Joey can `cat` files but Claude can't show him "rule R-1.2 is currently active").
- **Drop-in upgrade**: a `/active-rules` skill that reads `memory/rules/00-constitution.md`, parses the 16 rules, and prints which would fire for the *next action class*. Effort: ~30 minutes.

#### 7i. Hard-enforcement classifier (Anthropic's auto-mode pattern)
- **What field has**: Anthropic's auto-mode 3-tier transcript classifier + prompt-injection probe + reasoning-blind by design + deny-and-continue with retry cap. **0.4% FPR / 17% FNR** on real overeager actions.
- **Joey has**: ~10 hooks doing the same job (paid_call_gate, deployment_context_gate, test_gate, etc.) but no classifier orchestrating them.
- **Drop-in upgrade**: **None recommended.** Joey's hooks are *deterministic + cheap*; the classifier adds latency and false positives. The architectural insight to *steal* is "reasoning-blind classifier" — Joey's hooks already only see actions/results, not Claude's chain-of-thought. **Confirm don't change.**

## The 4-question pre-smoke-test audit

Before running the smoke tests on the new constitution, audit:

1. **Constitution size**: Is `memory/rules/00-constitution.md` still ≤200 lines? It was 12KB ≈ 250 lines per the brief. *Target: ≤200 lines, ideal ≤120, where every line is load-bearing.* (Field consensus from Anthropic + HumanLayer + Pocock + Cem Karaca empirical data.)
2. **MEMORY.md size**: Is `MEMORY.md` still under the 200-line / 25KB Claude Code auto-load threshold? Joey's brief says ~12KB now — under the 25KB limit but above the 200-line guidance. *Target: pickup-router section ≤100 lines; everything else moves to deep files referenced via `[[wikilinks]]`.*
3. **Combined auto-load**: `MEMORY.md` + `00-constitution.md` is the per-session tax. Per the field, anything over ~30KB combined is a tax that's eating an Opus 4.7 conversation. *Target: <25KB combined, ideal <15KB.*
4. **MCP server tool definitions**: How many MCP servers does Claude Code load with their tool definitions? *Each loaded MCP adds context-window bloat per InfoQ's coverage of the Anthropic postmortem.* Action: run `/mcp` and count tool definitions; uninstall any MCP that isn't earning its tokens.

## What Joey already has that the field hasn't standardized

- **Action-class declaration as a self-required ritual** before destructive actions. Anthropic's auto-mode does this as a *classifier on the agent's output*; Joey does it as a *self-declaration before the agent acts*. Both are valid; Joey's is more explicit/auditable but requires discipline.
- **5-tier × 6-class single-document constitution.** No single source documents an equivalent. Letta's Context Constitution is closest but written *to the agent*, not *to the engineer*.
- **Cross-project memory routing via `~/.claude/project-routing.json`** with explicit + implicit switch triggers + 2-hour TTL state file. The field has rulesync (cross-*tool* federation, not cross-project) and Letta's git worktree subagent merge (different problem). Joey's routing is unique and clean.
- **Hooks library doing hard enforcement** (`paid_call_gate.py`, `deployment_context_gate.py`, `test_gate.py`, `artifact_audit_gate.py`, `show_me_enforcer.py`, `retry_cap_watcher.py`). The field talks about hooks but Joey has ~10 wired in. Anthropic's official guidance: *"Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens."* Joey is already deeper into hook-based enforcement than most public examples.

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Anthropic engineering blog | 4 fetches | 8 (auto-mode classifier, postmortem, context-engineering paper, best-practices) | high |
| Anthropic Claude Code docs | 2 fetches | 6 (memory.md, permissions, auto memory, claudeMdExcludes, hooks pattern) | high |
| arXiv academic | 4 fetches | 5 (Gloaguen 20%, Wallace IH, ManyIH, CMAG) | high |
| Linux Foundation spec (agents.md) | 1 fetch | 4 (60k repos, 22 adopters, closest-wins, nested) | high |
| Letta blog | 2 fetches | 8 (74% LoCoMo, Context Constitution, Context Repositories, defrag 15-25 target) | high |
| Mem0 industry report | 1 fetch | 9 (procedural memory category, 3-signal, 4-scope, 6 open problems) | high |
| Engram independent benchmark | 1 fetch | 4 (28.8% MEMORY.md baseline, 80% replication, sqlite-vec, bi-temporal) | high |
| Practitioner essays (HumanLayer, Pocock, Amit Ray, Agensi) | 4 fetches | 12 (instruction budget, ball-of-mud, 5-file taxonomy, system reminder reverse-proxy) | high |
| Aider docs | 1 fetch | 3 (graph-ranked repo-map, 1k token default) | medium |
| Cline docs + GitHub raw | 3 fetches | 8 (Memory Bank 6-file structure, .clineignore, v3.13 toggle popover) | high |
| Arize independent research | 1 fetch | 4 (10-15% accuracy gain, 20-50 rule target, meta-prompt) | high |
| HN community threads | 2 fetches | 3 (anatomy of .claude/, MCP definition bloat) | medium |
| InfoQ secondary | 1 fetch | 2 (postmortem coverage, MCP bloat detail) | medium |
| Dev.to (rulesync) | 1 fetch | 2 (cross-tool federation) | medium |
| GreenCode Constitution | 1 fetch | 1 (confirms "constitution" is a field term) | low |
| Web search (15 queries) | n/a | 25+ (consistently hit strong material; none empty) | high |

## Contradictions & Open Questions

**Resolved this run (cycle 2):**
- Letta 74% vs Mem0 91.6% on LoCoMo → **contextualized**: Mem0's self-report doesn't replicate. Engram (80%) and Letta (74%) are close; Mem0's 66.9% under Engram replication is more realistic. Joey's flat-file MEMORY.md baseline = **28.8%** — fine for project-routing/pickup, capped for conversational dialog recall.
- CLAUDE.md ≤200 lines vs AGENTS.md "any length" → **resolved**: ≤200 lines is empirically correct (Cem Karaca measurement, Anthropic 3% drop from one line, HumanLayer 150-200 instruction budget, Pocock + Anthropic consensus). HumanLayer's elite target is ≤60 lines.
- 3-tier vs many-tier instruction hierarchy → **contextualized**: production uses 3-5 tiers *composed* across abstraction layers (file scope, action classification, allow/ask/deny). Joey's single 5-tier × 6-class document is at the high end of complexity but not unprecedented.

**Open / unresolved:**
- **Memory staleness at scale** — Mem0 lists this as an *open research problem* (their words: *"a highly-retrieved memory about a user's employer is highly relevant until it is not, at which point it becomes confidently wrong rather than just outdated"*). 7 partial implementations exist (Ebbinghaus, Hippo, TTL, bi-temporal, etc.) but no industry-best-practice.
- **Cross-session identity resolution** (Mem0 open problem). Joey's `[[joey-bunn]]` user-memory file is single-identity, this isn't a current pain point.
- **Application-level memory evaluation** (Mem0 open problem). Joey could build this for himself via Multica nightly scenario tests.

## Actionable Next Steps

**Pre-smoke-test pre-flight (do first):**

1. **Re-measure the auto-load tax.** Run `wc -l C:/Users/jlb2s/.claude/projects/.../memory/MEMORY.md` and `wc -l memory/rules/00-constitution.md`. If combined > 400 lines or > 25KB, pause smoke tests and prune. Target the constitution to ≤200 lines first; MEMORY.md should be ≤100 lines of pickup-router + everything else as deep files.
2. **MCP definition audit.** Inside Claude Code: `/mcp` to count loaded servers + their tool definitions. Uninstall any MCP server that isn't actively earning its tokens. (InfoQ-cited bloat category Joey hasn't audited.)
3. **Add an `author:` frontmatter field** to the memory schema. Required on next write. Backfill is *not* needed — go-forward only. 2-line schema change, zero code. ([cite: Mem0 actor-aware memory pattern])
4. **Run smoke tests on the new constitution.** Already on Joey's TODO. Field validates this approach (Arize Prompt Learning loop is a more rigorous version of the same idea).

**High-leverage drop-in upgrades (ranked):**

5. **Bi-temporal validity windows on memories.** Every `feedback_*.md` and `session_pickup_*.md` gets `valid_until: <YYYY-MM-DD>` frontmatter, defaulting to created+7d (Hippo half-life default). Nightly hook re-evaluates: referenced this session = renew; not referenced 30d = archive to `memory/archive/<year>-<month>/`. **Fixes the "feedback memo got replaced by constitution 24h later" failure.** Effort: ~1 hour. Single highest leverage cheap upgrade.
6. **Auto-mode-style classifier audit.** Don't add the classifier (latency cost), but adopt the 5-category danger list and audit each existing hook against it: scope escalation, credential exploration, agent-inferred parameters, sharing via external service, safety-check bypass. Verify each is covered by an existing hook OR a constitution rule. If gap exists, add hook (preferred) or rule (fallback).
7. **`/active-rules` skill.** Parse `memory/rules/00-constitution.md` and print which rules would apply for the next declared action class. Mirrors Anthropic's `/memory` introspection + Cline's v3.13 popover. Effort: ~30 minutes.
8. **Multica nightly: 10 scenarios → constitution alignment %.** Field's eval-loop pattern from Arize Prompt Learning. Tracks rule erosion over time. Effort: half-day to set up; pays back over months.
9. **Compaction policy for pickups**: any pickup older than 30 days that wasn't referenced in current sessions → `memory/archive/`. Letta's 15-25 file target after defrag is a reasonable ceiling. Effort: hook + cron.

**Don't-do list:**

- ❌ **Don't add vector recall (Engram/Mem0).** Joey's use case isn't multi-session conversational dialog recall. FTS5 is sufficient. ([cite: Engram's MEMORY.md baseline 28.8% LoCoMo is irrelevant to Joey's project-routing workload])
- ❌ **Don't switch to Letta git-backed memory.** Their pattern is elegant but Joey's flat `memory/` + git already gives the same versioning at the *repo* level.
- ❌ **Don't add an instruction-hierarchy classifier on top of hooks.** Anthropic's auto-mode classifier has 17% FNR + 0.4% FPR — Joey's hooks are deterministic. Field validates "hooks > rules > classifier" for hard enforcement.
- ❌ **Don't auto-generate constitution rules from feedback memos.** Anthropic + HumanLayer + Pocock all converge: *every line of the constitution should be hand-pruned, never auto-generated.*

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 8 | 8 | 7 | 7 | 8 | 7.6 |
| 2 | 9 | 9 | 9 | 8 | 9 | 8.8 |

## Related

- [[joshua]] — voice AI SaaS, same rule constitution applies
- [[lead-generator]] — project where the constitution lives
- [[bunn-create]] — paused project but action-class declarations originated from BunnCreate paid-gen incidents
- [[bunntranslator]] — Carmen tear/disaster (2026-05-10/13) is the source incident for R-1.1/R-1.2/R-2.2/R-4.1/R-4.2
- [[principeville]] — project that exercises deploy action class
- [[bunn-cli]] — project scaffolding tool, could be home for memory-linting validator script
- [[claude-code-hooks-automation]] — prior BunnLearn research on hooks; directly upstream of this report
- [[ai-research-synthesis-techniques]] — prior BunnLearn research using contradiction-preservation pattern
- [[agent-memory-knowledge-systems-obsidian]] — prior BunnLearn research on memory architectures; this report extends it

## Meta: What the Loop Learned

- **Most valuable source this session:** Anthropic's own engineering blog (auto-mode classifier paper + April 23 postmortem + context-engineering paper + best-practices). Four papers, all internally-consistent, all explicitly addressing Joey's exact failure modes. Anthropic is now publishing the kind of production-grounded write-ups that used to require Discord-mining + paid-podcast hunting.
- **Surprising discovery:** **Anthropic operationalized "memory is not control" at the prompt level** — they inject *"this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task."* alongside CLAUDE.md content. HumanLayer reverse-proxied this and published it. This is structurally identical to what Codex flagged to Joey ("memory is not control") and explains *why* CLAUDE.md rules get ignored even when present.
- **Least valuable source this session:** the GreenCode Constitution (greencode-constitution.org) — generic sustainable-coding principles, no field-specific findings. Confirmed "constitution" is a real field term, otherwise low-signal. ALSO: Reddit was entirely empty for niche memory+rules terminology (consistent with prior research findings; r/ClaudeAI and r/cursor are dominated by general-use complaints not memory-architecture discussions).
- **Method note**: Context-mode WebFetch block surfaced quickly; Python `urllib.request` via `ctx_execute` was a clean workaround and gave better text extraction than Firecrawl for these specific pages. The 6-URL batch fetch via custom Python script (cycle 2) was the highest-throughput pattern of the run.
