# BunnLearn Level-Up Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five targeted, additive improvements to the `bunn-learn-research` skill so it handles voice-AI research topics well, with a structured comparison-mode report format and a working contradiction-escalation loop.

**Architecture:** All changes are markdown-content edits to existing skill/playbook files plus one new template file. No scripts, no schema changes, no new runtime dependencies. A single research-mode classification (made once at cycle 1 plan time) acts as the glue — it gates the new metric-extraction substep and selects between narrative and comparison report templates.

**Tech Stack:** Markdown skill definitions (`~/.claude/skills/bunn-learn-research/`), markdown playbook (`~/.claude/memory/bunn-learn/research-playbook.md`), bash for verification (`grep`, `wc`), git for commits.

**Spec:** [`docs/superpowers/specs/2026-04-10-bunn-learn-level-up.md`](../specs/2026-04-10-bunn-learn-level-up.md)

---

## File Structure

Three files modified, one new file created. Same order as the spec's Implementation Order section (static files first, dynamic logic that references them second).

| File | Action | Size estimate | What it gets |
|---|---|---|---|
| `~/.claude/skills/bunn-learn-research/references/comparison-template.md` | **Create new** | ~100 lines | Full comparison-mode report template (Task 1) |
| `~/.claude/memory/bunn-learn/research-playbook.md` | Modify | +10 lines, ~3 lines changed | Voice-AI row in source-effectiveness table; YouTube fallback chain documented; version bump to 1.3 (Tasks 2-3) |
| `~/.claude/skills/bunn-learn-research/SKILL.md` | Modify | +~60 lines across 6 sections | Research-mode classification (Step 1 cycle 1); contradiction escalation (Step 1 cycle 2+); YouTube tool-chain (Step 2); metric-extraction substep 4e (Step 4); log field doc (Step 8); template-selection rule (Final Report) (Tasks 4-9) |
| `~/.claude/skills/bunn-learn-research/references/report-template.md` | **Unchanged** | — | Still used for NARRATIVE-mode research |

## Testing Strategy (Adapted TDD for Content Edits)

These are markdown content edits, not code, so traditional unit tests don't apply. Each task follows a content-TDD pattern:

1. **Verify pre-state:** `grep` confirms the current content matches expectations (the "red" state — edit would be needed).
2. **Make the edit** using the Edit/Write tool with exact content from this plan.
3. **Verify post-state:** `grep` confirms the new content is present and, where applicable, the old content is gone (the "green" state).
4. **Commit** with a conventional-commit message.

After all content edits are complete, Task 10 runs a live smoke test: invoke the skill on a trivial topic and verify the new behaviors actually trigger (mode classification appears in the wip file, template selection works, etc.).

## Commit Conventions

- Type: `feat` for new capability additions (comparison template, metric extraction, contradiction escalation), `docs` for playbook-only updates, `chore` for version bumps.
- Subject: all lowercase (commitlint + husky enforce this).
- Scope: `bunn-learn` when the change is skill-specific.
- Example: `feat(bunn-learn): add comparison-mode report template`

---

## Task 1: Create comparison-mode report template

**Files:**
- Create: `~/.claude/skills/bunn-learn-research/references/comparison-template.md`

- [ ] **Step 1: Verify file does not yet exist**

Run:
```bash
test -f ~/.claude/skills/bunn-learn-research/references/comparison-template.md && echo EXISTS || echo MISSING
```
Expected: `MISSING`

- [ ] **Step 2: Verify parent directory exists**

Run:
```bash
ls ~/.claude/skills/bunn-learn-research/references/
```
Expected: directory listing that includes `report-template.md`, `rubric.md`, `SOUL.md`.

- [ ] **Step 3: Create the file**

Write the following exact content to `~/.claude/skills/bunn-learn-research/references/comparison-template.md`:

````markdown
# BunnLearn Comparison-Mode Report Template

Write to: `research/<topic-slug>.md` in the current project directory.

Use this template when the cycle 1 wip file has `mode: QUANTITATIVE-COMPARISON`. For `mode: NARRATIVE`, use `report-template.md` instead.

```markdown
# Research: <Topic>

**Date:** <YYYY-MM-DD>
**Cycles:** <N>
**Final Score:** <composite>/10
**Playbook Version:** <version>
**Research Mode:** QUANTITATIVE-COMPARISON

## TL;DR

[One-sentence verdict per compared option, plus the recommended choice for the asker's specific context. Under 100 words total. This section leads the report — readers who want depth scroll down.]

## Options Compared

[Brief identification of each option being compared — name, vendor/origin, licensing, one-line positioning. Maximum 2 sentences per option.]

## Metric Comparison Table

[The verbatim table produced by Step 4e Metric Extraction during synthesis. This is the centerpiece of the report. Every number has a source citation. Missing data is "N/A", never blank.]

| Metric | Source A | Source B | Source C | Notes / Discrepancy |
|--------|----------|----------|----------|---------------------|
| [metric 1] | ... | ... | ... | ... |
| [metric 2] | ... | ... | ... | ... |

## Decision Criteria

[Ranked list of what actually matters when choosing between the options. For each criterion:]
- **[Criterion name]** — [Which option wins, with the supporting metric row] — [How much the winner wins by, order of magnitude not vague "better"] — [Context in which the ranking flips, if any]

## Winner by Dimension

| Dimension | Winner | Margin | Confidence |
|---|---|---|---|
| Accuracy | [option] | [margin] | [high/med/low] |
| Latency | [option] | [margin] | [high/med/low] |
| Cost | [option] | [margin] | [high/med/low] |
| [Other dimensions] | ... | ... | ... |

Confidence is tied to corroboration count: **high** = 3+ independent sources agreed, **medium** = 2, **low** = 1 or contested.

## Edge Cases and Failure Modes

[Cases where the normally-winning option breaks down, cases where the losing option is actually the right pick, known bugs or production gotchas from practitioner postmortems. Each entry cites its source.]

## Contradictions & Unresolved Questions

[From Step 4b synthesis and the cycle 2+ contradiction hunt. Each entry is one of:]

- **Resolved** — [what the tiebreaker query found and why the resolution holds]
- **Contextualized** — [both original positions are correct under different conditions, described here]
- **Still open** — [honest "we could not resolve this" with what's blocking resolution. Explicitly not a failure.]

## Recommendation Matrix

| If your priority is... | Pick... | Because... |
|---|---|---|
| Lowest latency | [option] | [metric-backed reason] |
| Lowest cost at scale | [option] | [metric-backed reason] |
| Best accuracy | [option] | [metric-backed reason] |
| Easiest production deploy | [option] | [practitioner-backed reason] |
| [Asker's specific context, pulled from project memory] | [option] | [reason specific to Joey's situation] |

The final row ("asker's specific context") pulls context from project memory (MEMORY.md, relevant `memory/*.md` files) and ties the recommendation to Joey's actual situation, not a generic reader.

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| [source] | [N] | [N] | [high/medium/low] |

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | X | X | X | X | X | X.X |
| 2 | X | X | X | X | X | X.X |

## Related

[Add Obsidian `[[wikilinks]]` to connect this report to the knowledge graph. Link to:]
- [Relevant project notes: [[Joshua]], [[AdForge]], [[Lead Generator]], [[Princeville Connect]]]
- [Relevant area notes: [[Bunn Communications]], [[Gaming PC]], [[Voice AI Research]]]
- [Relevant decision/gotcha notes: [[Decisions]], [[Working Rules]], [[Joshua Gotchas]], [[Joshua Rework]]]
- [Other research reports in 08-Research/ that overlap with this topic]

[Only include links that are genuinely related — be selective, not exhaustive.]

## Meta: What the Loop Learned

- Most valuable source this session: [source type + why]
- Least valuable source this session: [source type + why]
- Surprising discovery: [anything unexpected about the research process itself]
```
````

- [ ] **Step 4: Verify the file exists with expected sections**

Run:
```bash
test -f ~/.claude/skills/bunn-learn-research/references/comparison-template.md && echo EXISTS
grep -c "^## " ~/.claude/skills/bunn-learn-research/references/comparison-template.md
grep -q "QUANTITATIVE-COMPARISON" ~/.claude/skills/bunn-learn-research/references/comparison-template.md && echo HAS-MODE
grep -q "Recommendation Matrix" ~/.claude/skills/bunn-learn-research/references/comparison-template.md && echo HAS-MATRIX
grep -q "TL;DR" ~/.claude/skills/bunn-learn-research/references/comparison-template.md && echo HAS-TLDR
```
Expected:
- `EXISTS`
- Section count `10` or higher (one `## ` heading per top-level report section)
- `HAS-MODE`
- `HAS-MATRIX`
- `HAS-TLDR`

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add skills/bunn-learn-research/references/comparison-template.md
git commit -m "feat(bunn-learn): add comparison-mode report template"
```

Note: if `~/.claude` is not a git repo, skip the commit step for this task and bundle into a final commit after all SKILL.md changes. Check with `cd ~/.claude && git rev-parse --is-inside-work-tree 2>&1` before attempting.

---

## Task 2: Add voice-AI row to source-effectiveness table

**Files:**
- Modify: `~/.claude/memory/bunn-learn/research-playbook.md`

- [ ] **Step 1: Verify playbook currently lacks a voice-AI row**

Run:
```bash
grep -i "voice ai\|tts / stt\|real-time audio" ~/.claude/memory/bunn-learn/research-playbook.md
```
Expected: no output (grep exit code 1 — nothing matches).

- [ ] **Step 2: Identify the insertion point**

Run:
```bash
grep -n "Claude Code Hooks / Event Automation" ~/.claude/memory/bunn-learn/research-playbook.md
```
Expected: one line number matching the last row of the Source Effectiveness by Category table (this is where the new row inserts after).

- [ ] **Step 3: Add the voice-AI row**

Using the Edit tool, append the following row to the "Source Effectiveness by Category" table in `~/.claude/memory/bunn-learn/research-playbook.md`, immediately after the existing "Claude Code Hooks / Event Automation / PreToolUse PostToolUse" row. The new row goes on its own line in the table:

```
| Voice AI / Real-time Audio / TTS / STT | HuggingFace model cards + discussions (8), GitHub issues on SYSTRAN/faster-whisper + deepgram-python-sdk + livekit/agents + resemble-ai/chatterbox + rhasspy/piper repos (8), arXiv audio papers — Whisper, VALL-E, XTTS, WavLM (8), LiveKit Discord + official docs (7), engineering blogs from Deepgram / LiveKit / Vapi / Retell (7), Latent Space podcast YouTube + transcripts (7), r/LocalLLaMA for local inference threads (6), Dev.to voice-AI tutorials (6) | Medium (hype posts, 3), Stack Overflow (domain moves too fast for SO's format, 3), general Reddit outside r/LocalLLaMA (4) | Untested baseline — reasoned from domain adjacency. Update after first voice-AI research run. Hard metrics (WER, RTF, MOS, latency ms, VRAM) live in HuggingFace model cards + arXiv + engineering postmortems. Practitioner reality (what actually breaks in production) lives in LiveKit Discord + GitHub issues. |
```

- [ ] **Step 4: Verify the row was added**

Run:
```bash
grep -c "Voice AI / Real-time Audio / TTS / STT" ~/.claude/memory/bunn-learn/research-playbook.md
grep -q "Untested baseline — reasoned from domain adjacency" ~/.claude/memory/bunn-learn/research-playbook.md && echo HAS-BASELINE-TAG
```
Expected:
- Count: `1`
- `HAS-BASELINE-TAG`

- [ ] **Step 5: Do not commit yet**

Bundle this change with Task 3 (YouTube docs) and Task 3b (version bump) into one playbook commit.

---

## Task 3: Expand YouTube source registry entry with fallback chain

**Files:**
- Modify: `~/.claude/memory/bunn-learn/research-playbook.md`

- [ ] **Step 1: Verify current YouTube entry is the terse one-liner**

Run:
```bash
grep -n "YouTube transcripts" ~/.claude/memory/bunn-learn/research-playbook.md
```
Expected: a single row in the Source Registry table with "Full transcripts via Firecrawl. Find IDs via WebSearch." as the notes. Confirm it does NOT mention "fallback chain" or "tactiq.io" yet:

```bash
grep -q "tactiq.io" ~/.claude/memory/bunn-learn/research-playbook.md && echo ALREADY-EXPANDED || echo TERSE-AS-EXPECTED
```
Expected: `TERSE-AS-EXPECTED`

- [ ] **Step 2: Replace the YouTube row's Notes column**

Using the Edit tool, replace the existing YouTube row's Notes cell. The old text:

```
| 9 | YouTube transcripts | 6/10 | Firecrawl scrape `youtubetotranscript.com/transcript?v=<id>` | Full transcripts via Firecrawl. Find IDs via WebSearch. |
```

With the new expanded row:

```
| 9 | YouTube transcripts | 6/10 | See fallback chain below | 5-step fallback chain: (1) Firecrawl `youtubetotranscript.com/transcript?v=<id>`, (2) WebFetch same URL on block, (3) Firecrawl `tactiq.io/tools/youtube-transcript?url=<full-url>`, (4) WebFetch `noembed.com/embed?url=<full-url>` for metadata only (counts as half source), (5) WebSearch `"<title>" transcript` for third-party mirrors. Hard rules: always convert `youtu.be/<id>` → `youtube.com/watch?v=<id>` first (303 redirect); <100 chars = no-transcript, move to next step; private/deleted/region-locked = skip silently; bot-block/captcha = move immediately, no retry on current step. |
```

- [ ] **Step 3: Verify the expansion is in place**

Run:
```bash
grep -q "5-step fallback chain" ~/.claude/memory/bunn-learn/research-playbook.md && echo HAS-CHAIN-DESC
grep -q "tactiq.io" ~/.claude/memory/bunn-learn/research-playbook.md && echo HAS-TACTIQ
grep -q "youtu.be/<id>" ~/.claude/memory/bunn-learn/research-playbook.md && echo HAS-REDIRECT-RULE
```
Expected: all three echoes succeed.

- [ ] **Step 4: Bump playbook version from 1.2 to 1.3**

First verify the current version:
```bash
grep "^version:" ~/.claude/memory/bunn-learn/research-playbook.md
```
Expected: `version: "1.2"`

Then using the Edit tool, change the frontmatter:

Old:
```
version: "1.2"
last_updated: "2026-04-07"
```

New:
```
version: "1.3"
last_updated: "2026-04-10"
```

- [ ] **Step 5: Verify version bump**

Run:
```bash
grep "^version:" ~/.claude/memory/bunn-learn/research-playbook.md
grep "^last_updated:" ~/.claude/memory/bunn-learn/research-playbook.md
```
Expected:
- `version: "1.3"`
- `last_updated: "2026-04-10"`

- [ ] **Step 6: Commit playbook changes (Tasks 2 + 3 combined)**

```bash
cd ~/.claude
git add memory/bunn-learn/research-playbook.md
git commit -m "docs(bunn-learn): add voice-ai source row and youtube fallback chain"
```

(Skip if `~/.claude` is not a git repo — see Task 1 Step 5 note.)

---

## Task 4: Add research-mode classification to SKILL.md Step 1

**Files:**
- Modify: `~/.claude/skills/bunn-learn-research/SKILL.md` — Step 1 PLAN section (~line 38-46)

- [ ] **Step 1: Verify current Step 1 contents**

Run:
```bash
grep -n "^### Step 1: PLAN" ~/.claude/skills/bunn-learn-research/SKILL.md
grep -q "Research Mode" ~/.claude/skills/bunn-learn-research/SKILL.md && echo ALREADY-HAS-MODE || echo NO-MODE-YET
```
Expected: Step 1 line number reported, and `NO-MODE-YET`.

- [ ] **Step 2: Insert the classification block**

Using the Edit tool, find the existing Step 1 content:

```
### Step 1: PLAN

**Cycle 1 MUST target at least 5 source types.** Select from playbook rankings based on topic category. Write specific search queries for each. On cycle 2+, target weakest dimensions from prior diagnosis.
```

And replace it with:

```
### Step 1: PLAN

**On cycle 1 only — Research Mode Classification (run before source selection):**

Read the topic string and any relevant context from project memory (`~/.claude/projects/.../memory/MEMORY.md` and referenced files). Then classify the topic into exactly one mode, as a single-sentence judgment:

- **QUANTITATIVE-COMPARISON** — if the topic asks which of two-or-more options is better along measurable dimensions (accuracy, latency, cost, throughput, memory, etc.), even when phrased loosely. Examples: "X vs Y", "compare A B C", "is X good enough for Z", "which is fastest", "is X cheaper than Y at scale".
- **NARRATIVE** — everything else: "how do I", "what is", "best practices for", "why does X happen".

Write the classification as a new top-level section at the very start of the cycle 1 wip file, immediately after the `# <Topic> — Cycle <N> Raw Findings` header and before `## Sources Queried`:

```
## Research Mode
mode: QUANTITATIVE-COMPARISON
```

This flag is decided exactly once per research invocation. Later cycles and steps read it, never re-classify. If misclassified mid-run, the user can correct by hand-editing the cycle 1 wip file.

**Source selection (all cycles):**

**Cycle 1 MUST target at least 5 source types.** Select from playbook rankings based on topic category. Write specific search queries for each. On cycle 2+, target weakest dimensions from prior diagnosis.

**On cycle 2+ — Contradiction Escalation (mandatory):** For every contradiction preserved in the prior cycle's Step 4b, the current cycle MUST include at least one explicitly labeled tiebreaker query:

> "Given [source A claims X] vs [source B claims Y], find a third source that either (a) provides new independent data on this metric, (b) identifies the context that would reconcile both positions (e.g., different benchmark, different hardware), or (c) is a definitive authority on the disputed claim."

**Tiebreaker source preference order** (use the highest-ranked type that fits the disputed claim):
1. Primary sources — original papers, official vendor docs, canonical benchmarks
2. Independent third-party benchmark leaderboards (Papers with Code, HuggingFace Open LLM leaderboard)
3. Practitioner postmortems with explicit numbers
4. Community consensus threads where hard data is absent

**Three possible tiebreaker outcomes**, each handled explicitly in the final report:
- **Resolved** — new source gives definitive data. Contradiction annotated as "resolved: [winner] because [reason]".
- **Contextualized** — both prior positions are correct under different conditions. Annotated as "both correct: A holds under X, B holds under Y".
- **Still open** — no tiebreaker found. Upgraded from "contradiction" to "genuine open question". Explicitly **not a failure** — an actively-hunted-but-unresolved contradiction is a valid finding. Honesty is the goal.
```

Note: this single edit covers both Change #4 (contradiction-escalation rule) and the research-mode classification from the Glue section. They share the same Step 1 location, so they're done in one edit to preserve locality.

- [ ] **Step 3: Verify both additions are present**

Run:
```bash
grep -q "Research Mode Classification" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-MODE-HEADER
grep -q "QUANTITATIVE-COMPARISON" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-QUANTITATIVE
grep -q "Contradiction Escalation" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-ESCALATION
grep -q "tiebreaker query" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-TIEBREAKER
grep -q "Honesty is the goal" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-HONESTY-NOTE
```
Expected: all five echoes succeed.

- [ ] **Step 4: Do not commit yet**

Bundle with remaining SKILL.md edits (Tasks 5-9) into one commit.

---

## Task 5: Upgrade YouTube tool chain in Step 2 Gather

**Files:**
- Modify: `~/.claude/skills/bunn-learn-research/SKILL.md` — Step 2 GATHER, YouTube bullet

- [ ] **Step 1: Verify current YouTube entry is the terse one**

Run:
```bash
grep -n "YouTube transcripts" ~/.claude/skills/bunn-learn-research/SKILL.md
grep -q "tactiq.io" ~/.claude/skills/bunn-learn-research/SKILL.md && echo ALREADY-UPGRADED || echo TERSE-AS-EXPECTED
```
Expected: line number reported, `TERSE-AS-EXPECTED`.

- [ ] **Step 2: Replace the YouTube bullet**

Using the Edit tool, find the existing bullet in Step 2 GATHER:

```
- **YouTube transcripts:** Firecrawl scrape `youtubetotranscript.com/transcript?v=<id>` for full transcript text. Find video IDs via WebSearch `site:youtube.com <topic>`. Fallback: noembed metadata only.
```

And replace it with:

```
- **YouTube transcripts:** Use this 5-step fallback chain in order; advance to next step on any failure (empty, <100 chars, 403, captcha, bot-block):
    1. Firecrawl scrape `youtubetotranscript.com/transcript?v=<id>` (primary)
    2. WebFetch same URL directly (different user agent sometimes wins)
    3. Firecrawl scrape `tactiq.io/tools/youtube-transcript?url=<full-url>` (alternative provider)
    4. WebFetch `noembed.com/embed?url=<full-url>` for metadata only (title + channel + description). Counts as a half-source in scoring, not a full source.
    5. WebSearch `"<video title>" transcript` for third-party mirrors in community blog posts.
    
    **Hard rules:**
    - Always convert `youtu.be/<id>` → `youtube.com/watch?v=<id>` before any fetch (the short form 303-redirects).
    - Transcript under 100 chars = treat as no-transcript, advance to next step.
    - Private / deleted / region-locked videos = skip silently, no retries.
    - Bot-block HTML or captcha = advance immediately, don't retry current step.
    
    Find video IDs via WebSearch `site:youtube.com <topic>`.
```

- [ ] **Step 3: Verify the upgrade**

Run:
```bash
grep -q "5-step fallback chain" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-CHAIN
grep -q "tactiq.io" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-TACTIQ
grep -q "youtu.be/<id>" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-REDIRECT-RULE
grep -q "half-source in scoring" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-HALF-SOURCE
```
Expected: all four echoes succeed.

- [ ] **Step 4: Do not commit yet**

---

## Task 6: Add metric-extraction substep 4e to Step 4 Synthesize

**Files:**
- Modify: `~/.claude/skills/bunn-learn-research/SKILL.md` — Step 4 SYNTHESIZE

- [ ] **Step 1: Verify Step 4 currently ends at substep 4d**

Run:
```bash
grep -n "^### Step 4: SYNTHESIZE" ~/.claude/skills/bunn-learn-research/SKILL.md
grep -n "^\*\*4d\. Count explicitly" ~/.claude/skills/bunn-learn-research/SKILL.md
grep -q "^\*\*4e\." ~/.claude/skills/bunn-learn-research/SKILL.md && echo ALREADY-HAS-4E || echo NO-4E-YET
```
Expected: Step 4 and 4d line numbers reported, `NO-4E-YET`.

- [ ] **Step 2: Insert substep 4e after 4d**

Using the Edit tool, find the existing 4d block:

```
**4d. Count explicitly:** primary sources, code examples, cross-verified claims, contradictions found, actionable items, non-obvious findings.
```

And replace it with:

```
**4d. Count explicitly:** primary sources, code examples, cross-verified claims, contradictions found, actionable items, non-obvious findings.

**4e. Metric Extraction (conditional — runs only when `mode == QUANTITATIVE-COMPARISON`):**

On NARRATIVE topics, this substep is a no-op and the loop proceeds to Step 5.

On QUANTITATIVE-COMPARISON topics, build a cross-source benchmark table as the final synthesis artifact. Extract every hard number from every source and organize them by metric:

```
| Metric                  | Source A          | Source B          | Source C          | Notes / Discrepancy                              |
|-------------------------|-------------------|-------------------|-------------------|--------------------------------------------------|
| WER (%)                 | 3.2               | 4.1               | 2.8               | A = LibriSpeech clean, B = CommonVoice, C = internal |
| Streaming latency p50   | 180 ms            | 320 ms            | 250 ms            | B is cloud-hosted; context matters                |
| VRAM at inference       | 1.2 GB            | N/A               | 2.1 GB            | B is managed API, no VRAM data                    |
| Cost per minute         | $0 (self-hosted)  | $0.0043           | $0 (self-hosted)  | B is Deepgram Nova-2 listed rate                 |
```

**Hard rules for the table:**
- Every number gets a source citation in the row or a footnote. Unsourced numbers are deleted, not left as "probably from somewhere".
- When two sources report the same metric with different numbers, BOTH appear in the row side by side. Do NOT pick a winner during synthesis — that's what Step 4b and cycle 2+ tiebreakers are for.
- The Notes column is mandatory when context affects interpretation (different benchmarks, hardware, languages, codec inputs).
- Missing data is literally `N/A`. Never blank, never zero.
- The table is reproduced verbatim in the final report — not rewritten as prose.

**Scoring integration:**
- Metrics reported by 2+ independent sources with compatible numbers count as cross-verified claims for the Corroboration dimension.
- Metric contradictions count as flagged contradictions.
- Extracted metrics count toward "edge cases documented" in Depth scoring.
```

- [ ] **Step 3: Verify 4e is present and properly conditional**

Run:
```bash
grep -q "^\*\*4e\. Metric Extraction" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-4E-HEADER
grep -q "mode == QUANTITATIVE-COMPARISON" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-CONDITIONAL
grep -q "Cross-source benchmark table\|cross-source benchmark table" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-DESCRIPTION
grep -q "reproduced verbatim in the final report" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-VERBATIM-RULE
```
Expected: all four echoes succeed.

- [ ] **Step 4: Do not commit yet**

---

## Task 7: Add `contradictions_escalated` field to Step 8 LOG

**Files:**
- Modify: `~/.claude/skills/bunn-learn-research/SKILL.md` — Step 8 LOG

- [ ] **Step 1: Verify current Step 8 content**

Run:
```bash
grep -n "^### Step 8: LOG" ~/.claude/skills/bunn-learn-research/SKILL.md
grep -q "contradictions_escalated" ~/.claude/skills/bunn-learn-research/SKILL.md && echo ALREADY-HAS-FIELD || echo NO-FIELD-YET
```
Expected: Step 8 line number reported, `NO-FIELD-YET`.

- [ ] **Step 2: Add documentation of the new optional field**

Using the Edit tool, find the existing Step 8 content:

```
### Step 8: LOG
Run the logging script with a JSON entry:
```bash
bash "${CLAUDE_SKILL_DIR}/scripts/log-cycle.sh" '{"timestamp":"<ISO-8601>","topic":"<topic>","cycle":<N>,"playbook_version":"<ver>","sources_used":[...],"scores":{"depth":<N>,"source_diversity":<N>,"corroboration":<N>,"actionability":<N>,"novelty":<N>},"composite":<N.N>,"notes":"<diagnosis>"}'
```
```

And replace it with:

```
### Step 8: LOG
Run the logging script with a JSON entry:
```bash
bash "${CLAUDE_SKILL_DIR}/scripts/log-cycle.sh" '{"timestamp":"<ISO-8601>","topic":"<topic>","cycle":<N>,"playbook_version":"<ver>","sources_used":[...],"scores":{"depth":<N>,"source_diversity":<N>,"corroboration":<N>,"actionability":<N>,"novelty":<N>},"composite":<N.N>,"notes":"<diagnosis>","contradictions_escalated":[]}'
```

**Optional field `contradictions_escalated`** (added in playbook v1.3): array of objects documenting cycle 2+ contradiction hunt outcomes. Format per entry:

```json
{"prior_contradiction": "<brief description of cycle N-1 contradiction>", "tiebreaker_query": "<query text fired this cycle>", "outcome": "resolved" | "contextualized" | "still_open"}
```

Empty array `[]` on cycle 1 or when the prior cycle had no contradictions. Backward compatible — prior log entries without this field remain parseable by consumers that ignore unknown keys.
```

- [ ] **Step 3: Verify the field is documented**

Run:
```bash
grep -q '"contradictions_escalated"' ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-FIELD
grep -q "resolved.*contextualized.*still_open\|still_open" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-OUTCOMES
grep -q "Backward compatible" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-COMPAT-NOTE
```
Expected: all three echoes succeed.

- [ ] **Step 4: Do not commit yet**

---

## Task 8: Add template-selection rule to Final Report section

**Files:**
- Modify: `~/.claude/skills/bunn-learn-research/SKILL.md` — Final Report section

- [ ] **Step 1: Verify current Final Report content**

Run:
```bash
grep -n "^## Final Report" ~/.claude/skills/bunn-learn-research/SKILL.md
grep -q "comparison-template" ~/.claude/skills/bunn-learn-research/SKILL.md && echo ALREADY-HAS-SELECTION || echo NO-SELECTION-YET
```
Expected: Final Report line number reported, `NO-SELECTION-YET`.

- [ ] **Step 2: Replace the current report-writing line**

Using the Edit tool, find the existing line:

```
Write report to `research/<topic-slug>.md` using template in [references/report-template.md](references/report-template.md).
```

And replace it with:

```
**Template selection (based on cycle 1 Research Mode flag):**

Read the `## Research Mode` section from the cycle 1 wip file:

- `mode: QUANTITATIVE-COMPARISON` → Write report to `research/<topic-slug>.md` using [references/comparison-template.md](references/comparison-template.md). The metric table from Step 4e goes in the "Metric Comparison Table" section verbatim. The Recommendation Matrix's last row pulls the asker's specific context from project memory (MEMORY.md and referenced memory files).
- `mode: NARRATIVE` → Write report to `research/<topic-slug>.md` using [references/report-template.md](references/report-template.md) (existing narrative template).
```

- [ ] **Step 3: Verify template-selection rule is present**

Run:
```bash
grep -q "Template selection" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-SELECTION
grep -q "comparison-template.md" ~/.claude/skills/bunn-learn-research/SKILL.md && echo REFS-COMPARISON
grep -q "report-template.md" ~/.claude/skills/bunn-learn-research/SKILL.md && echo REFS-NARRATIVE
grep -q "NARRATIVE" ~/.claude/skills/bunn-learn-research/SKILL.md && echo HAS-NARRATIVE-BRANCH
```
Expected: all four echoes succeed.

- [ ] **Step 4: Commit all SKILL.md changes (Tasks 4-8 bundled)**

```bash
cd ~/.claude
git add skills/bunn-learn-research/SKILL.md
git commit -m "feat(bunn-learn): add research mode classification, metric extraction, contradiction escalation, youtube fallback, template selection"
```

(Skip if `~/.claude` is not a git repo.)

---

## Task 9: Full-skill consistency check

**Files:**
- Read-only verification of all modified files

This task is a post-edit sanity check to catch anything the per-task verifications missed.

- [ ] **Step 1: Verify all five changes are live in SKILL.md**

Run:
```bash
SKILL_FILE=~/.claude/skills/bunn-learn-research/SKILL.md
echo "=== Change 1 (voice-AI row lives in playbook, not SKILL.md) ==="
echo "=== Change 2 (metric extraction 4e) ==="
grep -c "4e\. Metric Extraction" $SKILL_FILE
echo "=== Change 3 (template selection) ==="
grep -c "Template selection" $SKILL_FILE
echo "=== Change 4 (contradiction escalation) ==="
grep -c "Contradiction Escalation" $SKILL_FILE
echo "=== Change 5 (YouTube fallback chain) ==="
grep -c "5-step fallback chain" $SKILL_FILE
echo "=== Glue (research mode classification) ==="
grep -c "Research Mode Classification" $SKILL_FILE
```
Expected: every count reports `1`.

- [ ] **Step 2: Verify playbook changes**

Run:
```bash
PLAYBOOK=~/.claude/memory/bunn-learn/research-playbook.md
grep '^version:' $PLAYBOOK
grep -c "Voice AI / Real-time Audio / TTS / STT" $PLAYBOOK
grep -c "5-step fallback chain\|tactiq.io" $PLAYBOOK
```
Expected:
- `version: "1.3"`
- `1` (voice-AI row)
- `1` or `2` (fallback chain references)

- [ ] **Step 3: Verify comparison template exists and has all required sections**

Run:
```bash
TEMPLATE=~/.claude/skills/bunn-learn-research/references/comparison-template.md
test -f $TEMPLATE && echo EXISTS
for section in "TL;DR" "Options Compared" "Metric Comparison Table" "Decision Criteria" "Winner by Dimension" "Edge Cases and Failure Modes" "Contradictions & Unresolved Questions" "Recommendation Matrix" "Source Quality" "Score History"; do
    grep -q "$section" $TEMPLATE && echo "HAS: $section" || echo "MISSING: $section"
done
```
Expected: `EXISTS` followed by 10 `HAS:` lines, no `MISSING:` lines.

- [ ] **Step 4: Verify report-template.md is unchanged**

Run:
```bash
cd ~/.claude
git diff skills/bunn-learn-research/references/report-template.md
```
Expected: empty output (no diff).

---

## Task 10: Live smoke test

**Files:**
- None (test only)

This task verifies the changes actually work end-to-end by invoking the skill on a trivial topic.

- [ ] **Step 1: Pick a throwaway test topic**

Use something small that exercises QUANTITATIVE-COMPARISON mode without spending significant research budget. Recommended: a 2-cycle max run with low threshold, e.g.:

```
Topic: "python logging vs loguru for small scripts"
Flags: --threshold 6.0 --max-cycles 2 --max-fetches 5
```

This is deliberately narrative-adjacent with a comparison framing so the mode classifier has to make a real call.

- [ ] **Step 2: Run the skill and observe its cycle 1 plan step**

In a fresh Claude Code session, trigger the skill with a natural-language request that matches its activation triggers (the skill activates on "research", "compare options for", "deep dive", etc. — there is no `/bunn-learn` slash command).

Example prompt to use:

> "Run bunn-learn research on: python logging vs loguru for small scripts. Use --threshold 6.0 --max-cycles 2 --max-fetches 5."

Watch for the skill to output the research mode classification before source selection. Expected: a one-line classification announcing `mode: QUANTITATIVE-COMPARISON` (because "X vs Y" triggers it).

- [ ] **Step 3: Inspect the cycle 1 wip file**

After the skill finishes cycle 1 (or if you pause it), read the wip file:

```bash
ls ~/.claude/memory/bunn-learn/wip/
cat ~/.claude/memory/bunn-learn/wip/<topic-slug>-cycle-1.md | head -20
```
Expected: the file starts with `# ... Raw Findings` then has `## Research Mode` with `mode: QUANTITATIVE-COMPARISON` before `## Sources Queried`.

- [ ] **Step 4: Let the skill complete and inspect the final report**

After all cycles finish, read the generated report:

```bash
cat research/python-logging-vs-loguru-for-small-scripts.md | head -40
```

Expected: the report opens with a TL;DR section (not Executive Summary), has a "Metric Comparison Table" header, uses comparison-template section names ("Winner by Dimension", "Recommendation Matrix"), and has `**Research Mode:** QUANTITATIVE-COMPARISON` in the header.

- [ ] **Step 5: Inspect the log entry**

```bash
tail -1 ~/.claude/memory/bunn-learn/research-log.jsonl | python -m json.tool
```

Expected: valid JSON with all standard fields plus either `contradictions_escalated: []` (cycle 1 always empty) or a populated array (cycle 2+).

- [ ] **Step 6: Clean up the test artifacts**

```bash
rm -f research/python-logging-vs-loguru-for-small-scripts.md
rm -f ~/.claude/memory/bunn-learn/wip/python-logging-vs-loguru-for-small-scripts-cycle-*.md
```

The log entry stays — it's a real data point for the skill.

- [ ] **Step 7: Smoke test pass/fail**

Smoke test PASSES if all of the following are true:
- Mode classification ran and wrote to the wip file
- Cycle 1 used at least 5 source types (check the wip file's `## Sources Queried` section)
- The final report used the comparison template (TL;DR-first, has metric table)
- Log entry is valid JSON and parseable
- No errors surfaced during the run

If any of the above failed, the plan is NOT done. Fix the failing change and re-run the smoke test.

---

## Post-Implementation

After Task 10 passes:

1. Update the `MEMORY.md` project memory index to note the playbook is now at v1.3 with voice-AI readiness.
2. (Optional, separate session) Run the real practice research topic: `/bunn-learn faster-whisper vs Deepgram for real-time voice agents`. Treat the output as both a research result AND a calibration run for the skill improvements. Post-run, update the voice-AI row in the playbook with real source-effectiveness data, drop `untested baseline` from the notes.
3. (Later session, gated on practice run success) Run the real Chatterbox vs ElevenLabs research for Joshua.
