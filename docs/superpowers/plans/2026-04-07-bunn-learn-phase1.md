# BunnLearn Phase 1: Research Loop Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/bunn-learn-research` Claude Code skill — an autonomous research loop that iterates through multiple sources, self-scores against a count-based rubric, and improves until quality plateaus.

**Architecture:** A single markdown skill file (`.claude/skills/bunn-learn-research.md`) instructs Claude Code how to run the research loop. Persistent state lives in `~/.claude/memory/bunn-learn/` — a versioned playbook (source rankings + calibration examples), JSONL experiment log, and wip/ directory for context management. No external dependencies, no code to run — this is pure prompt engineering orchestrating Claude Code's existing tools.

**Tech Stack:** Claude Code skill (markdown), WebSearch, WebFetch, Context7 MCP, Firecrawl MCP, JSONL logging, Git

**Spec:** `docs/superpowers/specs/2026-04-07-bunn-learn-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `~/.claude/skills/bunn-learn-research.md` | The skill file — complete prompt with loop logic, rubric, error handling |
| Create | `~/.claude/memory/bunn-learn/research-playbook.md` | Versioned source registry, strategies, calibration examples |
| Create | `~/.claude/memory/bunn-learn/research-log.jsonl` | Empty file — experiment log (one JSON object per cycle) |
| Create | `~/.claude/memory/bunn-learn/wip/` | Empty directory — in-progress research state |

> **Note:** `~` = `C:\Users\jlb2s` throughout this plan.

---

### Task 1: Create Directory Structure

**Files:**
- Exists: `C:\Users\jlb2s\.claude\skills\` (already has 4 skills)
- Create: `C:\Users\jlb2s\.claude\memory\bunn-learn\` (directory)
- Create: `C:\Users\jlb2s\.claude\memory\bunn-learn\wip\` (directory)

- [ ] **Step 1: Create all directories**

```bash
mkdir -p ~/.claude/memory/bunn-learn/wip
```

- [ ] **Step 2: Verify directories exist**

```bash
ls -la ~/.claude/skills/
ls -la ~/.claude/memory/bunn-learn/
ls -la ~/.claude/memory/bunn-learn/wip/
```

Expected: `~/.claude/skills/` has existing skills. `~/.claude/memory/bunn-learn/` and `wip/` are new and empty.

- [ ] **Step 3: Create empty research log**

```bash
touch ~/.claude/memory/bunn-learn/research-log.jsonl
```

- [ ] **Step 4: Commit**

```bash
# Nothing to commit — these are outside the repo in ~/.claude/
# Just verify the structure is ready
```

---

### Task 2: Write the Research Playbook (v1.0)

**Files:**
- Create: `C:\Users\jlb2s\.claude\memory\bunn-learn\research-playbook.md`

This is the living document the skill reads before every cycle. Contains source rankings, tool chains, strategies, and calibration examples.

- [ ] **Step 1: Write the playbook file**

Write `~/.claude/memory/bunn-learn/research-playbook.md` with this content:

```markdown
---
version: "1.0"
last_updated: "2026-04-07"
total_research_sessions: 0
---

# BunnLearn Research Playbook

## Source Registry

Ranked by effectiveness (1-10). Updated by `/bunn-learn-evolve`.

| Rank | Source Type | Effectiveness | Tool Chain | Notes |
|------|-------------|---------------|------------|-------|
| 1 | Official documentation | 8/10 | Context7 MCP → `resolve-library-id` then `query-docs` | Best for library/framework APIs |
| 2 | GitHub repos/issues/discussions | 8/10 | WebSearch `site:github.com <topic>` → WebFetch specific URLs | Best for real-world usage, bugs, workarounds |
| 3 | Web search (general) | 6/10 | WebSearch tool directly | Good starting point, often surface-level |
| 4 | Medium / Dev.to articles | 6/10 | WebSearch `site:medium.com OR site:dev.to <topic>` → WebFetch | Good for tutorials and deep dives |
| 5 | Reddit / HN threads | 5/10 | WebSearch `site:reddit.com OR site:news.ycombinator.com <topic>` → WebFetch | Good for opinions, gotchas, real experience |
| 6 | Stack Overflow | 5/10 | WebSearch `site:stackoverflow.com <topic>` → WebFetch | Good for specific technical Q&A |
| 7 | Academic papers / blogs | 4/10 | WebSearch `<topic> paper OR research` → WebFetch | Good for deep technical topics |
| 8 | YouTube video content | 4/10 | noembed.com/embed for metadata; WebFetch video page for description | Phase 2: full transcript extraction |
| 9 | Podcast transcripts | 3/10 | WebSearch `<topic> podcast transcript` → WebFetch if found | Hit or miss availability |
| 10 | Discord / Slack archives | 3/10 | WebSearch `site:discord.com <topic>` → WebFetch if indexable | Rarely indexable, low reliability |

New sources discovered during research get added at 5/10 ("untested baseline").

## Strategies

- Start with top 4-5 ranked sources per topic
- For library/framework topics: always try Context7 first
- For infrastructure/DevOps topics: prioritize GitHub issues and Reddit
- For emerging tech: prioritize HN threads and blog posts
- When a source returns nothing useful, skip immediately — don't retry the same query
- When WebFetch returns <100 chars of useful content on a URL, try Firecrawl as fallback

## Calibration Examples

Read these BEFORE self-scoring every cycle. They anchor your ratings.

### Example A — Composite 1.6 (Poor)

> "LiveKit is a real-time communication platform. It supports WebRTC. You can use it for video calls."

| Dimension | Score | Count |
|-----------|-------|-------|
| Depth | 2 | 0 primary sources, 0 code examples |
| Source Diversity | 2 | 1 source type (web search) |
| Corroboration | 1 | 0 claims cross-verified |
| Actionability | 2 | 0 concrete steps |
| Novelty | 1 | 0 non-obvious findings |
| **Composite** | **1.6** | |

### Example B — Composite 5.6 (Adequate)

> "LiveKit's SIP integration requires the SIP Trunk resource. Here's a basic config from the docs: [code]. Community reports latency issues with Twilio trunks — see GitHub issue #1234. Alternative: use LiveKit's hosted SIP service."

| Dimension | Score | Count |
|-----------|-------|-------|
| Depth | 5 | 2 primary sources, 1 code example |
| Source Diversity | 6 | 3 source types (docs + GitHub + web) |
| Corroboration | 5 | 2 claims cross-checked |
| Actionability | 8 | 4 concrete steps with config |
| Novelty | 4 | 1 non-obvious finding (Twilio latency) |
| **Composite** | **5.6** | |

### Example C — Composite 8.6 (Excellent)

> "LiveKit SIP has three trunk modes: inbound, outbound, and direct. [Code for each]. The undocumented `enable_krisp` parameter on trunk config enables noise cancellation — found in source code but not docs. Performance: 200ms median setup time per LiveKit benchmarks, but Discord user reports 800ms with Twilio due to SRTP negotiation. Recommended: use LiveKit's hosted trunk for <500ms setup, self-host only if you need custom DTMF handling."

| Dimension | Score | Count |
|-----------|-------|-------|
| Depth | 9 | 5 primary sources, 3 code examples, edge cases documented |
| Source Diversity | 8 | 5 source types (docs + source code + Discord + benchmarks + GitHub) |
| Corroboration | 8 | 6 claims verified, contradictions documented |
| Actionability | 9 | 5 implementable steps, ready-to-use config, decision criteria |
| Novelty | 9 | 4 non-obvious (undocumented param, real latency data, SRTP detail, DTMF edge case) |
| **Composite** | **8.6** | |

## Anti-Patterns

- Don't score yourself generously — use the counts, not vibes
- Don't research the same query twice in the same session — check wip/ files
- Don't skip the WRITE TO FILE step — context window will fill by cycle 3
- Don't count the same source for multiple source types (e.g., a GitHub README found via web search counts as GitHub, not web)
```

- [ ] **Step 2: Verify the playbook was written correctly**

Read back `~/.claude/memory/bunn-learn/research-playbook.md` and confirm:
- Frontmatter has version "1.0"
- Source registry has 10 entries with effectiveness scores
- All 3 calibration examples present with count tables
- Strategies section present
- Anti-patterns section present

---

### Task 3: Write the Skill File — Header and Argument Parsing

**Files:**
- Create: `C:\Users\jlb2s\.claude\skills\bunn-learn-research.md`

This is the big one — the actual skill file. We build it in stages. Start with the header, argument parsing, and setup instructions.

- [ ] **Step 1: Write the skill file header**

Write `~/.claude/skills/bunn-learn-research.md` with:

````markdown
---
name: bunn-learn-research
description: Autonomous research loop — iterates through sources, self-scores, and improves until quality plateaus
---

# BunnLearn Research: Autonomous Research Loop

You are running an autonomous research loop. Your job is to research the given topic thoroughly by iterating: gather → write to file → synthesize → score → diagnose → iterate.

## Argument Parsing

The user's input after the command name is your topic and optional flags.

**Parse these arguments from the input:**
- `--threshold <number>` — Composite score target (default: 8.0)
- `--max-cycles <number>` — Maximum research cycles (default: 5)
- `--max-fetches <number>` — Maximum web fetches per cycle (default: 10)
- Everything else is the `<topic>` to research

**Example inputs:**
- `LiveKit SIP integration` → topic="LiveKit SIP integration", threshold=8.0, max-cycles=5, max-fetches=10
- `--threshold 7.0 --max-cycles 3 Expo SDK 54 migration` → topic="Expo SDK 54 migration", threshold=7.0, max-cycles=3, max-fetches=10

## Setup (Run Once at Start)

Before entering the loop:

1. **Create directories if needed:**
   ```
   mkdir -p ~/.claude/memory/bunn-learn/wip
   ```

2. **Read the playbook:**
   Read `~/.claude/memory/bunn-learn/research-playbook.md` completely.
   This contains your source registry, strategies, and calibration examples.

3. **Check for prior research:**
   Read `~/.claude/memory/bunn-learn/research-log.jsonl` and look for entries with this exact topic.
   If found, note what was learned before — don't repeat the same queries.

4. **Create research directory in current project:**
   ```
   mkdir -p research
   ```

5. **Announce:**
   Tell the user: "Starting BunnLearn research on: **<topic>**. Target: <threshold>, max cycles: <max-cycles>. Reading playbook..."
````

- [ ] **Step 2: Verify the header renders correctly**

Read back `~/.claude/skills/bunn-learn-research.md` and confirm:
- Frontmatter has name and description
- Argument parsing section documents all 3 flags with defaults
- Setup section has all 5 steps

---

### Task 4: Write the Skill File — Rubric Section

**Files:**
- Modify: `C:\Users\jlb2s\.claude\skills\bunn-learn-research.md`

Append the count-based rubric to the skill file.

- [ ] **Step 1: Append the rubric section**

Append to `~/.claude/skills/bunn-learn-research.md`:

````markdown

## The Rubric (Count-Based)

Score your research output on these 5 dimensions using **counts, not vibes**:

| Dimension | 1-3 | 4-6 | 7-8 | 9-10 |
|-----------|-----|-----|-----|------|
| **Depth** | 0-1 primary sources, 0 code examples | 2-3 primary sources, 1 code example | 4-5 primary sources, 2-3 code examples, some edge cases | 6+ primary sources, 4+ code examples, edge cases + failure modes |
| **Source Diversity** | 1 source type | 2-3 source types | 4 source types, each with ≥1 unique finding | 5+ source types, each with ≥1 unique finding |
| **Corroboration** | 0 claims cross-verified | 1-3 claims verified across 2+ sources | 4-6 claims verified, contradictions flagged | 7+ claims verified, contradictions resolved or documented |
| **Actionability** | 0 concrete steps | 1-2 actionable items, generic | 3-4 specific steps with code | 5+ steps, ready-to-use code + config |
| **Novelty** | 0 non-obvious findings | 1 finding not on page 1 of Google | 2-3 non-obvious insights | 4+ surprising findings with data backing |

**Composite** = average of all 5 scores.

**IMPORTANT:** Before scoring, ALWAYS re-read the calibration examples in the playbook. They anchor your ratings. Without them, you will score too generously.
````

- [ ] **Step 2: Verify rubric appended correctly**

Read the file and confirm the rubric table is present with all 5 dimensions and 4 score ranges each.

---

### Task 5: Write the Skill File — The Research Loop

**Files:**
- Modify: `C:\Users\jlb2s\.claude\skills\bunn-learn-research.md`

Append the core loop — the 11-step cycle that drives everything.

- [ ] **Step 1: Append the research loop**

Append to `~/.claude/skills/bunn-learn-research.md`:

````markdown

## The Research Loop

Run this loop until composite >= threshold OR plateau detected (score doesn't improve by 1.0+ for 3 consecutive cycles) OR max-cycles reached.

### Step 1: PLAN

Based on the playbook source rankings and any prior cycle diagnostics:
- Select the top 4-5 source types to query this cycle
- Write specific search queries for each source
- If this is cycle 2+, specifically target the weakest dimensions from last cycle's diagnosis

### Step 2: GATHER

Hit each selected source using the tool chains from the playbook:

**For each source, use the exact tool chain:**
- **Official docs:** Use Context7 MCP — call `resolve-library-id` with the library name, then `query-docs` with your question. If Context7 has no results, fall back to WebSearch `<library> official documentation` → WebFetch.
- **GitHub:** WebSearch `site:github.com <topic>` → WebFetch the top 2-3 results.
- **Web search:** WebSearch `<topic>` directly. Follow up promising results with WebFetch.
- **Medium/Dev.to:** WebSearch `site:medium.com OR site:dev.to <topic>` → WebFetch top 1-2 results.
- **Reddit/HN:** WebSearch `site:reddit.com <topic>` → WebFetch threads with substantive discussion.
- **Stack Overflow:** WebSearch `site:stackoverflow.com <topic>` → WebFetch top answers.
- **YouTube (metadata only):** WebFetch `https://noembed.com/embed?url=https://www.youtube.com/watch?v=<id>` for title/channel. Note video titles for context.
- **Firecrawl fallback:** When WebFetch returns <100 chars of useful content, try the Firecrawl `firecrawl_scrape` tool on the same URL. If Firecrawl is not available, skip.

**Rate limiting:** Wait 2 seconds between external API calls. Do not exceed `--max-fetches` web fetches per cycle.

**Error handling:**
- 403/404/timeout: Skip source, note it, move on. Not a failure.
- Context7 no results: Fall back to WebSearch + WebFetch.
- Empty content (<100 chars): Try Firecrawl. If still empty, skip and note.

### Step 3: WRITE TO FILE (MANDATORY)

**This step is NOT optional. Without it, context fills by cycle 3.**

Write your raw findings to: `~/.claude/memory/bunn-learn/wip/<topic-slug>-cycle-<N>.md`

Where `<topic-slug>` is the topic with spaces replaced by hyphens and lowercased.
Where `<N>` is the current cycle number (1, 2, 3...).

Format:
```markdown
# <Topic> — Cycle <N> Raw Findings

## Sources Queried
- [source type]: [query] → [result summary or "no useful results"]

## Raw Findings
[Everything you found this cycle, organized by source]

## New Information This Cycle
[What's new compared to previous cycles — check prior wip files]
```

### Step 4: SYNTHESIZE

Read ALL `wip/<topic-slug>-cycle-*.md` files (not just the current one).

Combine all findings across all cycles:
- Merge overlapping information
- Flag contradictions between sources
- Note remaining information gaps
- Highlight surprising or non-obvious findings

**COUNT these things explicitly** (you need the counts for scoring):
- Number of primary sources cited
- Number of code examples found
- Number of claims cross-verified across 2+ independent sources
- Number of concrete actionable items
- Number of non-obvious findings

### Step 5: SELF-SCORE

**First:** Re-read the 3 calibration examples from the playbook.

**Then:** Score each dimension using the counts from Step 4:

```
Depth:            X/10 — [N] primary sources, [N] code examples, [edge cases: yes/no]
Source Diversity:  X/10 — [N] source types used, each contributing unique info: [yes/no]
Corroboration:    X/10 — [N] claims cross-verified, contradictions: [flagged/resolved/none]
Actionability:    X/10 — [N] concrete steps, code provided: [yes/no]
Novelty:          X/10 — [N] non-obvious findings

Composite: X.X
```

### Step 6: DIAGNOSE

Identify the lowest-scoring dimensions and explain WHY with specific counts:

```
Weakest: Source Diversity (4/10) — only used 2 source types (web search, docs).
         Next cycle: add GitHub issues and Reddit threads.

Second weakest: Novelty (3/10) — 0 non-obvious findings.
         Next cycle: search for contrarian opinions, edge cases, undocumented features.
```

### Step 7: DECIDE

**IF** composite >= threshold: **STOP** → Go to "Writing the Final Report"
**ELSE IF** plateau detected (score hasn't improved by 1.0+ for 3 consecutive cycles): **STOP** → Go to "Writing the Final Report"
**ELSE IF** cycle count >= max-cycles: **STOP** → Go to "Writing the Final Report"
**ELSE:** Tell the user the score and diagnosis, then start the next cycle at Step 1.

### Step 8: LOG

Append one line to `~/.claude/memory/bunn-learn/research-log.jsonl`:

```json
{"timestamp":"<ISO-8601>","topic":"<topic>","cycle":<N>,"playbook_version":"<version from playbook frontmatter>","sources_used":["<source_type_1>","<source_type_2>"],"scores":{"depth":<N>,"source_diversity":<N>,"corroboration":<N>,"actionability":<N>,"novelty":<N>},"composite":<N.N>,"notes":"<one-line diagnosis summary>"}
```

### Step 9: ITERATE

Go back to Step 1 with your updated plan targeting weak dimensions.
````

- [ ] **Step 2: Verify the loop was appended correctly**

Read the file and confirm all 9 loop steps are present (Steps 1-9 in the skill, mapping to the spec's 11-step cycle with PLAN/GATHER/WRITE/SYNTHESIZE/SCORE/DIAGNOSE/DECIDE/LOG/ITERATE).

---

### Task 6: Write the Skill File — Final Report and Cleanup

**Files:**
- Modify: `C:\Users\jlb2s\.claude\skills\bunn-learn-research.md`

Append the final report template and cleanup instructions.

- [ ] **Step 1: Append final report section**

Append to `~/.claude/skills/bunn-learn-research.md`:

````markdown

## Writing the Final Report

When the loop stops (threshold met, plateau, or max cycles), write the final report.

### Report Location

Write to: `research/<topic-slug>.md` in the current project directory.

### Report Template

```markdown
# Research: <Topic>

**Date:** <YYYY-MM-DD>
**Cycles:** <N>
**Final Score:** <composite>/10
**Playbook Version:** <version>

## Executive Summary

[3-5 sentences summarizing the key findings and their significance]

## Detailed Findings

### [Subtopic 1]
[Findings organized by theme, not by source]

### [Subtopic 2]
[Continue for each major subtopic]

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| [source] | [N] | [N] | [high/medium/low] |

## Contradictions & Open Questions

- [Any conflicting information found, with sources cited]
- [Questions that remain unanswered]

## Actionable Next Steps

1. [Specific, implementable action]
2. [Continue numbered list]

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | X | X | X | X | X | X.X |
| 2 | X | X | X | X | X | X.X |

## Meta: What the Loop Learned

- Most valuable source this session: [source type + why]
- Least valuable source this session: [source type + why]
- Surprising discovery: [anything unexpected about the research process itself]
```

## Cleanup

After writing the final report:

1. **Delete wip files:** Remove all `~/.claude/memory/bunn-learn/wip/<topic-slug>-cycle-*.md` files
2. **Commit the report:**
   ```
   git add research/<topic-slug>.md
   git commit -m "research: <topic> (score: <composite> after <N> cycles)"
   ```
3. **Tell the user:** "Research complete. Report at `research/<topic-slug>.md`. Final score: <composite>/10 after <N> cycles."

## Context Window Emergency

If at ANY point you notice the context window is getting large and you risk losing earlier information:

1. Immediately write ALL current state to wip/ files
2. Summarize all findings so far into a single synthesis file
3. End the loop gracefully with the current composite score
4. Write the final report with whatever you have

**It is better to produce a 6/10 report than to lose all research to context overflow.**
````

- [ ] **Step 2: Verify the complete skill file**

Read back the entire `~/.claude/skills/bunn-learn-research.md` and verify it has all sections:
1. Frontmatter (name, description)
2. Argument parsing
3. Setup (5 steps)
4. Rubric (count-based, 5 dimensions)
5. Research loop (9 steps)
6. Final report template
7. Cleanup instructions
8. Context window emergency handler

---

### Task 7: Smoke Test — Dry Run

**Files:** None (read-only verification)

Run the skill once on a simple topic to verify it works end-to-end.

- [ ] **Step 1: Invoke the skill**

Run: `/bunn-learn-research Claude Code custom skills best practices --max-cycles 2`

- [ ] **Step 2: Verify the loop executes**

Watch for:
- Playbook is read at start
- Sources are queried in order of effectiveness
- wip/ files are created after each cycle
- Self-scoring uses counts (not vibes)
- Calibration examples are referenced before scoring
- JSONL log entry is appended after each cycle
- Final report is written to `research/`
- wip/ files are cleaned up
- Git commit is created

- [ ] **Step 3: Review the output**

Check:
- `~/.claude/memory/bunn-learn/research-log.jsonl` has entries
- `research/claude-code-custom-skills-best-practices.md` exists and follows the template
- Scores use actual counts, not subjective language
- The report is genuinely useful (not generic filler)

- [ ] **Step 4: Test argument parsing**

Run: `/bunn-learn-research --threshold 6.0 --max-fetches 3 Node.js SQLite best practices`

Verify:
- Threshold is 6.0 (not default 8.0) — loop should stop sooner
- Max fetches is 3 per cycle (not default 10)
- Topic parsed as "Node.js SQLite best practices" (flags stripped out)

- [ ] **Step 5: Test plateau detection**

Run: `/bunn-learn-research --threshold 10.0 --max-cycles 5 JavaScript Date handling`

With threshold=10.0, the loop will never hit threshold. Verify:
- Loop runs multiple cycles
- If score doesn't improve by 1.0+ for 3 consecutive cycles, loop stops with "plateau detected"
- Final report notes plateau as the stop reason

- [ ] **Step 6: Note any issues for tuning**

If anything didn't work right, note it. These become Phase 2 fixes.

---

### Task 8: Commit Everything

- [ ] **Step 1: Commit the plan document**

```bash
cd "C:\Users\jlb2s\Documents\Lead Generator"
git add docs/superpowers/plans/2026-04-07-bunn-learn-phase1.md
git commit -m "docs: add BunnLearn Phase 1 implementation plan"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Create directory structure | `~/.claude/memory/bunn-learn/`, `wip/` |
| 2 | Write research playbook v1.0 | `research-playbook.md` |
| 3 | Skill file: header + arg parsing | `bunn-learn-research.md` (create) |
| 4 | Skill file: rubric section | `bunn-learn-research.md` (append) |
| 5 | Skill file: research loop | `bunn-learn-research.md` (append) |
| 6 | Skill file: final report + cleanup | `bunn-learn-research.md` (append) |
| 7 | Smoke test — dry run | Read-only verification |
| 8 | Commit everything | Git |

**Total estimated tasks: 8**
**Critical path: Tasks 1-6 are sequential (each builds on the last). Task 7 requires all prior. Task 8 is standalone.**
