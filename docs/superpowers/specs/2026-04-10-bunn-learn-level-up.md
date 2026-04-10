# BunnLearn Level-Up: Voice-AI Readiness + Structured Comparisons

**Date:** 2026-04-10
**Author:** Joey Bunn + Claude
**Status:** Draft
**Builds on:** [`2026-04-07-bunn-learn-design.md`](2026-04-07-bunn-learn-design.md) (foundational BunnLearn design)

## Context

BunnLearn (the `bunn-learn-research` skill) is a mature autonomous research loop: playbook version 1.2, six logged sessions, recent composite scores of 8.0-8.2, count-based rubric, dialectical synthesis, bias-aware self-scoring, category-tagged source effectiveness. The skill is working.

The next real research target is high-stakes and voice-AI adjacent: **"Can a cloned Chatterbox voice replace ElevenLabs for Joshua's production voice agent?"** That research has to be solid before Joey bets on the outcome. Two concerns with running it today:

1. **The skill has no calibration for voice-AI as a topic category.** The source-effectiveness table covers thirteen categories; none of them are voice AI, real-time audio, TTS, or STT. Cycle 1 source selection would be a cold guess.
2. **The skill's output format is narrative.** Comparison-style questions ("X vs Y vs Z") are handled by the existing template, but the centerpiece of benchmark-heavy research — the actual numbers, side-by-side — lives in prose rather than in a structured table that's easy to audit and compare.

Rather than burn the Chatterbox question on a tool that's missing calibration and structure, this spec improves the skill on a **practice topic** first: `"faster-whisper vs Deepgram for real-time voice agents."` Structural twin of the real question (open-source self-hosted vs managed API, same domain, same source landscape), low spoilage risk, independently actionable for Joshua's STT stack.

## Goals

1. Make the skill produce consistently useful output on voice-AI research topics, starting from zero calibration data, without regressing on any prior topic category.
2. Introduce a structured comparison output format so benchmark-heavy research reports are auditable at a glance instead of buried in prose.
3. Close one piece of the learning loop: contradictions found in cycle N must be actively hunted in cycle N+1, not just reported as dissent.
4. Harden the single worst-reliability source in the current registry (YouTube transcripts) because voice-AI content is disproportionately on YouTube.
5. Make all of the above changes additively, with no changes to existing scripts, BunnBrain schema, or log format beyond one optional new field.

## Non-Goals

- Not implementing the "evolve" phase of BunnLearn (auto-updating source effectiveness after every run). That's valuable but out of scope today.
- Not implementing a "cycle 0" domain reconnaissance pass. Would be useful for brand-new domains but is a design problem of its own.
- Not splitting the voice-AI source row into TTS / STT / real-time-pipeline sub-rows. One broad row ships first; split later if post-run data says the source patterns diverge.
- Not renumbering existing Step 4 synthesis substeps. All new logic is additive.
- Not touching the BunnBrain SQLite schema.
- Not running the practice research inside this spec's implementation. The skill improvements ship first, the research run is a separate follow-up session.

## Design Summary

Five additive changes and one piece of glue.

**The glue: research-mode classification.** In Step 1 of cycle 1, the skill makes a one-sentence semantic judgment about the topic and writes a flag into the cycle 1 wip file: `mode = QUANTITATIVE-COMPARISON` or `mode = NARRATIVE`. The flag is decided once, persisted, and read by downstream steps. Two things depend on it: whether Step 4e (metric extraction) runs, and which report template the final report uses. Everything else in the skill ignores the flag.

**Change 1: voice-AI row in source-effectiveness table** (playbook)
**Change 2: `4e. Metric Extraction` substep** (SKILL.md, conditional on mode)
**Change 3: comparison-mode report template** (new file, selected by mode)
**Change 4: contradiction-escalation rule** in Step 1 for cycle 2+ (SKILL.md)
**Change 5: YouTube transcript fallback chain** (playbook + SKILL.md)

Changes 1, 2, and 3 chain together for benchmark-heavy topics: source row feeds cycle 1 gather → metric table is built during synthesis → table is the centerpiece of the comparison report. Change 4 independently reinforces Change 2 (most contradictions on benchmark topics are metric disagreements). Change 5 is independent.

## File Map

Three files touched, one new file added. No scripts, no schema changes.

| File | Status | Changes |
|---|---|---|
| `~/.claude/memory/bunn-learn/research-playbook.md` | Modified | + Voice-AI row in source-effectiveness table. + YouTube fallback chain documented in Source Registry entry. Version bump to 1.3. |
| `~/.claude/skills/bunn-learn-research/SKILL.md` | Modified | + Step 1: research-mode classification (cycle 1). + Step 1: contradiction-escalation rule (cycle 2+). + Step 2 Gather: upgraded YouTube tool chain. + Step 4: new substep `4e. Metric Extraction`. + Step 8: optional `contradictions_escalated` field in log entry. + Final Report: template-selection rule. |
| `~/.claude/skills/bunn-learn-research/references/comparison-template.md` | **New** | Alternate report template for QUANTITATIVE-COMPARISON mode. |
| `~/.claude/skills/bunn-learn-research/references/report-template.md` | Unchanged | Still used for NARRATIVE mode. |

## Change 1 — Voice-AI Source Effectiveness Row

Added to the "Source Effectiveness by Category" table in `research-playbook.md`. Marked `untested baseline` so the skill knows this is a reasoned guess, not calibrated data. Post-run, real effectiveness data overwrites it.

| Topic Category | Best Sources | Worst Sources | Notes |
|---|---|---|---|
| Voice AI / Real-time Audio / TTS / STT | HuggingFace model cards + discussions (8), GitHub issues on SYSTRAN/faster-whisper + deepgram-python-sdk + livekit/agents + resemble-ai/chatterbox + rhasspy/piper repos (8), arXiv audio papers — Whisper, VALL-E, XTTS, WavLM (8), LiveKit Discord + official docs (7), engineering blogs from Deepgram / LiveKit / Vapi / Retell (7), Latent Space podcast YouTube + transcripts (7), r/LocalLLaMA for local inference threads (6), Dev.to voice-AI tutorials (6) | Medium (hype posts, 3), Stack Overflow (domain moves too fast for SO's format, 3), general Reddit outside r/LocalLLaMA (4) | Untested baseline — reasoned from domain adjacency. Update after first voice-AI research run. Hard metrics (WER, RTF, MOS, latency ms, VRAM) live in HuggingFace model cards + arXiv + engineering postmortems. Practitioner reality (what actually breaks in production) lives in LiveKit Discord + GitHub issues. |

Design calls:
- **One broad row, not split by TTS / STT / pipeline sub-area.** Easier to iterate. If post-run data shows the source patterns actually diverge, the row gets split in a follow-up.
- **Latent Space podcast named as a specific channel** rather than keeping the row purely at the source-type level. It's unusually high signal for voice-AI topics and tells the skill where to look first. Acceptable deviation from the "source types only" norm.

## Change 2 — Metric Extraction Synthesis Substep

New substep `4e. Metric Extraction`, inserted after the existing `4d. Count explicitly`. Additive; no renumbering of existing substeps.

**Trigger:** Runs only when `mode == QUANTITATIVE-COMPARISON`. On NARRATIVE topics, the step is a no-op and the loop proceeds as before.

**What the step produces:** A cross-source benchmark table, built during synthesis and reproduced verbatim in the final report:

```markdown
| Metric                  | Source A           | Source B          | Source C           | Notes / Discrepancy                               |
|-------------------------|--------------------|-------------------|--------------------|---------------------------------------------------|
| WER (%)                 | 3.2                | 4.1               | 2.8                | A = LibriSpeech clean, B = CommonVoice, C = internal |
| Streaming latency p50   | 180 ms             | 320 ms            | 250 ms             | B is cloud-hosted; context matters                 |
| VRAM at inference       | 1.2 GB             | N/A               | 2.1 GB             | B is managed API, no VRAM data                     |
| Cost per minute         | $0 (self-hosted)   | $0.0043           | $0 (self-hosted)   | B is Deepgram Nova-2 listed rate                  |
```

**Hard rules:**
- Every number gets a source citation in the row or a footnote. Unsourced numbers are deleted, not left in as "probably from somewhere."
- When two sources report the same metric with different numbers, both appear in the row side by side. Synthesis does not pick a winner — that's what Step 4b (Contradiction Exploitation) and cycle 2+ tiebreakers are for.
- The Notes column is mandatory whenever context affects interpretation (different benchmarks, hardware, languages, codec inputs).
- Missing data is literally `N/A`. Never blank, never zero.
- The table is reproduced verbatim in the final report — not rewritten as prose.

**Scoring integration:**
- Metrics reported by 2+ independent sources with compatible numbers count as cross-verified claims for the Corroboration dimension.
- Metric contradictions count as flagged contradictions.
- Extracted metrics count toward "edge cases documented" in Depth scoring.

## Change 3 — Comparison-Mode Report Template

### New file: `~/.claude/skills/bunn-learn-research/references/comparison-template.md`

Added alongside the existing `report-template.md`. Neither template replaces the other; the research mode flag picks which one the final report uses.

### Template selection rule (added to SKILL.md Final Report section)

```
Read the research mode from the cycle 1 wip file.

- mode = QUANTITATIVE-COMPARISON → use references/comparison-template.md
- mode = NARRATIVE → use references/report-template.md (existing, unchanged)
```

### Template structure (rendering order)

```markdown
# Research: <Topic>

**Date:** <YYYY-MM-DD>
**Cycles:** <N>
**Final Score:** <composite>/10
**Playbook Version:** <version>
**Research Mode:** QUANTITATIVE-COMPARISON

## TL;DR
One-sentence verdict per compared option, plus the recommended choice for the asker's context. Under 100 words total.

## Options Compared
Brief identification of each option — name, vendor/origin, licensing, one-line positioning. Max 2 sentences per option.

## Metric Comparison Table
[Verbatim table produced by Step 4e Metric Extraction. Centerpiece of the report.]

## Decision Criteria
Ranked list of what matters when choosing between options. For each:
- Name the criterion
- Which option wins, with the supporting metric row
- How much the winner wins by (order of magnitude, not vague "better")
- Context in which the ranking flips, if any

## Winner by Dimension
| Dimension            | Winner     | Margin          | Confidence |
|----------------------|------------|-----------------|------------|
| Accuracy (WER)       | ...        | ...             | ...        |
| Latency              | ...        | ...             | ...        |
| Cost                 | ...        | ...             | ...        |
| [Other dimensions]   | ...        | ...             | ...        |

Confidence is tied to corroboration count: high = 3+ independent sources agreed, medium = 2, low = 1 or contested.

## Edge Cases and Failure Modes
Cases where the normally-winning option breaks down, cases where the losing option is actually the right pick, production gotchas from practitioner postmortems. Each entry cites its source.

## Contradictions & Unresolved Questions
From Step 4b and the cycle 2+ contradiction hunt. Each entry is one of:
- **Resolved** — what the tiebreaker query found and why the resolution holds
- **Contextualized** — both positions correct under different conditions
- **Still open** — honest "we could not resolve this" with what's blocking resolution

## Recommendation Matrix
| If your priority is...       | Pick...    | Because...                           |
|------------------------------|------------|--------------------------------------|
| Lowest latency               | ...        | [metric-backed reason]               |
| Lowest cost at scale         | ...        | [metric-backed reason]               |
| Best accuracy                | ...        | [metric-backed reason]               |
| Easiest production deploy    | ...        | [practitioner-backed reason]         |
| [Asker's specific context]   | ...        | [reason from project memory]         |

The final row ("asker's specific context") pulls context from project memory (MEMORY.md, `memory/joshua-rework.md`, etc.) and ties the recommendation to Joey's actual situation, not a generic reader.

## Source Quality
[Same source-quality table as existing report-template.md]

## Score History
[Same cycle-by-cycle score table as existing template]

## Related
[Same Obsidian wikilinks section as existing template]

## Meta: What the Loop Learned
[Same meta section as existing template]
```

Design calls:
- **TL;DR leads the report**, not Executive Summary. For comparison research, the verdict is the whole point; readers who want depth scroll. Deliberate break from the narrative template's ordering.
- **Confidence is tied to corroboration count**, not vibes. Keeps the report honest and auditable.
- **Asker-specific recommendation row** forces the skill to connect research to the actual decision at hand, not produce a generic comparison. Context comes from project memory automatically — no new CLI flag.

## Change 4 — Contradiction Escalation (Cycle 2+)

Added to Step 1 Plan in `SKILL.md`. Keeps the existing rule ("on cycle 2+, target weakest dimensions from prior diagnosis") and adds a new mandatory rule on top.

**New rule:** For every contradiction preserved in the prior cycle's Step 4b, the current cycle MUST include at least one explicitly labeled "tiebreaker query":

> "Given [source A claims X] vs [source B claims Y], find a third source that either (a) provides new independent data on this metric, (b) identifies the context that would reconcile both positions (e.g., different benchmark, different hardware), or (c) is a definitive authority on the disputed claim."

**Source preference order for tiebreakers:**
1. Primary sources — original papers, official vendor docs, canonical benchmarks
2. Independent third-party benchmark leaderboards (Papers with Code, HuggingFace Open LLM leaderboard)
3. Practitioner postmortems with explicit numbers
4. Community consensus threads where hard data is absent

**Three possible outcomes, each handled explicitly:**
- **Resolved** — new source gives definitive data. Contradiction annotated in final report as "resolved: [winner] because [reason]."
- **Contextualized** — both prior positions are correct under different conditions. Annotated as "both correct: A holds under condition X, B holds under condition Y."
- **Still open** — no tiebreaker found. Contradiction upgraded from "contradiction" to "genuine open question." Explicitly **not a failure** — an unresolved-but-actively-hunted contradiction is a valid finding. Honesty is the goal.

**Logging:** The Step 8 `log-cycle.sh` JSON entry gains one optional new field: `contradictions_escalated`, an array of `{prior_contradiction, tiebreaker_query, outcome}` objects. Empty on cycle 1 or on cycles where the prior cycle had no contradictions. Backward compatible with existing log entries.

## Change 5 — YouTube Transcript Fallback Chain

Two-part change. Documentation lives in `research-playbook.md` (Source Registry entry); runtime logic lives in `SKILL.md` Step 2 Gather's YouTube tool-chain bullet.

**The chain:**

1. **Primary:** Firecrawl scrape `youtubetotranscript.com/transcript?v=<id>`
2. **If 403 / bot-block / empty / <100 chars:** WebFetch the same URL directly (different user agent sometimes wins)
3. **If still empty:** Firecrawl scrape `tactiq.io/tools/youtube-transcript?url=<full-url>` as an alternative transcript provider
4. **If still empty:** WebFetch `noembed.com/embed?url=<full-url>` for metadata only (title, channel, description). Counts as a partial source, not a full transcript.
5. **If all fail:** WebSearch `"<video title>" transcript` to find third-party transcripts (community blog posts often mirror popular talks).

**Hard rules baked into the step:**
- Always convert `youtu.be/<id>` → `youtube.com/watch?v=<id>` before any fetch. The short form 303-redirects and wastes the attempt.
- Transcript under 100 chars = treat as no-transcript, move to next step.
- Private / deleted / region-locked videos = skip silently, no retries.
- Bot-block HTML or captcha = move immediately to the next step, don't retry current step.
- A video that lands on step 4 (metadata only) counts as half a source in scoring, not zero and not full.

## Research Mode Classification (The Glue)

New logic added to Step 1 Plan, cycle 1 only. Runs exactly once per research invocation, before source selection.

**What the skill does:** Reads the topic string and any context from memory / BunnBrain, then makes a one-sentence classification:

> "Research mode: QUANTITATIVE-COMPARISON" or "Research mode: NARRATIVE"

Classification heuristic (natural language, not regex):
- **QUANTITATIVE-COMPARISON** if the topic is asking which of two-plus options is better along measurable dimensions (accuracy, latency, cost, throughput, memory, etc.), even if phrased loosely. Examples: "X vs Y," "compare A B C," "is X good enough for Z," "which is fastest," "is X cheaper than Y at scale."
- **NARRATIVE** for everything else — "how do I," "what is," "best practices for," "why does X happen."

**Persistence:** The mode flag is written to the cycle 1 wip file as the first line under the sources list:

```
## Research Mode
mode: QUANTITATIVE-COMPARISON
```

**Consumers (read only, never re-classify):**
- Step 4e (Metric Extraction) — runs if mode is QUANTITATIVE-COMPARISON, else no-op
- Final Report — picks comparison template if QUANTITATIVE-COMPARISON, else narrative

Classification happens once. Every later cycle and step reads the flag, never re-decides it. If the classification turns out to be wrong mid-run, the user can correct it by editing the cycle 1 wip file — but that's an escape hatch, not a normal flow.

## Implementation Order

Static files first, then dynamic logic that references them. This way, edits to `SKILL.md` always point to things that already exist.

1. Create `~/.claude/skills/bunn-learn-research/references/comparison-template.md` (new file)
2. Update `~/.claude/memory/bunn-learn/research-playbook.md`:
   - Add voice-AI row to source-effectiveness table
   - Update YouTube source registry entry with fallback chain documentation
   - Bump playbook version to 1.3
3. Update `~/.claude/skills/bunn-learn-research/SKILL.md`:
   - Step 1 (cycle 1): add research-mode classification logic
   - Step 1 (cycle 2+): add contradiction-escalation rule
   - Step 2 Gather: replace YouTube tool-chain bullet with fallback chain
   - Step 4 Synthesize: add new substep `4e. Metric Extraction` after `4d`
   - Step 8 Log: document new optional `contradictions_escalated` field
   - Final Report section: add template-selection rule

No file is modified before its dependencies exist.

## Success Criteria

**On the practice run (faster-whisper vs Deepgram):**
- Cycle 1 hits at least 5 source types, with at least 3 coming from the new voice-AI row (HuggingFace, GitHub issues on the real repos, arXiv or LiveKit Discord). If cycle 1 falls back on generic web search as its top sources, the row wasn't calibrated well enough.
- Research mode classification picks `QUANTITATIVE-COMPARISON` automatically.
- Step 4e produces a metric table with at least 6 rows (WER, latency p50, latency p99, VRAM, cost per minute, plus at least one streaming-specific metric). Every cell is either a sourced number or `N/A`.
- If any contradictions surface in cycle 1 synthesis, cycle 2 fires at least one explicit tiebreaker query per contradiction, logged in the `contradictions_escalated` field.
- At least one YouTube source succeeds via the new fallback chain.
- Final report uses the comparison template, with TL;DR, metric table, winner-by-dimension, and recommendation matrix all populated — including the Joshua-specific row.
- Composite score for the run hits ≥8.0 despite being a brand-new domain for the skill.

**Standing (measurable across future runs):**
- Narrative-mode research still uses the existing template unchanged. No regression on narrative topics.
- After the practice run, the voice-AI source row gets updated with real numbers; `untested baseline` is dropped from the notes.
- The `contradictions_escalated` log field is backward compatible — prior log entries without it are still parseable.
- No new external dependencies, no script changes, no BunnBrain schema changes.

## Risks and Open Questions

- **Semantic classification of research mode could misfire.** If the skill labels a legitimately quantitative comparison as NARRATIVE (or vice versa), the whole run takes the wrong path. Mitigation: the classification is one line in the wip file, easily corrected by hand. Longer-term mitigation: monitor the first three classification calls and add explicit rules if the skill's judgment is unreliable.
- **The voice-AI source row is a guess.** It will almost certainly be wrong in some of its rankings. That's the point of `untested baseline` — the first real run calibrates it. Risk is that the guess is *so* wrong it hurts the first run's score before calibration catches up.
- **YouTube transcript services could all go down simultaneously.** The five-step fallback chain is resilient to any one service failing, but not to all of them. Acceptable risk; metadata-only counts as partial and the run still completes.
- **The asker-specific Recommendation Matrix row depends on the skill successfully reading project memory.** If memory access fails or the relevant memory file doesn't exist, the row falls back to generic "low-volume voice agent" context. The report is still valid, just less personalized.
- **Contradiction escalation could inflate the cycle 2 query budget.** If cycle 1 finds many contradictions, cycle 2 spends most of its queries on tiebreakers rather than depth. This is probably fine (tiebreakers are high-value queries) but worth watching on the first run.

## Out of Scope (Explicit)

- Auto-updating the source-effectiveness table after each run (the "Phase 4 evolve" mode from the foundational spec).
- Cycle 0 domain reconnaissance pass.
- Splitting the voice-AI row into TTS / STT / real-time-pipeline sub-rows.
- Any changes to the BunnBrain database schema.
- Any changes to `scripts/setup.sh`, `scripts/log-cycle.sh`, `scripts/cleanup.sh`, or `scripts/save-findings.sh`.
- Running the actual faster-whisper vs Deepgram research (separate follow-up session after the skill changes are implemented and reviewed).
- Running the real Chatterbox vs ElevenLabs research (a later session, gated on the practice run going well).
