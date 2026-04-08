# BunnLearn: Autonomous Research & Learning Skill for Claude Code

**Date**: 2026-04-07
**Author**: Joey Bunn + Claude
**Status**: Draft (Rev 2 — post-review fixes)

## Problem

Claude Code's research capabilities are ad-hoc. Every conversation starts from scratch — no accumulated knowledge about what sources work best, no self-assessment of research quality, no memory of which approaches yielded the best results. Research quality varies wildly between sessions.

Meanwhile, Joey's projects (Joshua, Lead Generator, AdForge, OptiVoice, Princeville Connect) share patterns and architecture decisions that Claude re-discovers every time instead of knowing deeply.

## Solution

A Claude Code skill called `bunn-learn` that applies the autoresearch pattern (atomic iteration + mechanical scoring + keep/revert) to three domains:

1. **Research quality** — autonomous loop that researches a topic, scores itself, identifies gaps, and iterates until quality plateaus
2. **Codebase comprehension** — deep study of project architecture, patterns, and cross-project comparisons
3. **Meta-learning** — reviews past research sessions to discover which sources and methods work best, evolving its own playbook

## Glossary

- **Cycle**: One complete pass through the research loop (plan → gather → write to file → synthesize → score → log)
- **Plateau**: When the composite score fails to improve by 1.0+ for 3 consecutive cycles
- **Composite score**: The average of all five rubric dimension scores (1-10 scale)
- **Playbook**: The `research-playbook.md` file containing ranked sources, strategies, and calibration examples — read before every cycle
- **Corroboration**: The degree to which a claim is independently confirmed by multiple unrelated sources (replaces "Accuracy" — we measure source agreement, not ground truth)

## Design Principles

- **Measurable over subjective**: Every improvement scored via count-based rubric metrics
- **Atomic iterations**: One focused research cycle at a time, scored independently
- **File-based persistence**: Research state written to files after each cycle to manage context window; final reports committed to git
- **Self-expanding**: The system discovers new research sources and methods on its own
- **Safe by default**: Read-only during research, rate limits on external APIs
- **Build in layers**: Research loop first, then study mode, then meta-learning, then code optimization

## Architecture

### Skill Structure

Claude Code custom slash commands live in `.claude/commands/` as markdown files. Sub-commands use the hyphenated naming convention:

```
.claude/commands/
  bunn-learn-research.md    # Mode 1: autonomous research loop
  bunn-learn-study.md       # Mode 2: codebase comprehension (Phase 3)
  bunn-learn-evolve.md      # Mode 3: meta-learning (Phase 4)
```

**Invocation:**
- `/bunn-learn-research LiveKit SIP integration best practices`
- `/bunn-learn-research --threshold 7.5 --max-cycles 3 Expo SDK 54 migration`
- `/bunn-learn-study joshua`
- `/bunn-learn-evolve`

### Configuration

All configurable values are passed as command arguments with defaults:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--threshold` | 8.0 | Composite score target to stop iterating |
| `--max-cycles` | 5 | Maximum research cycles per invocation |
| `--max-fetches` | 10 | Maximum web fetches per cycle (context budget) |

### Persistent State

Cross-project state lives in a shared directory:

```
C:\Users\jlb2s\.claude\memory\bunn-learn\
  research-playbook.md       # Ranked source registry + strategies + calibration examples (versioned)
  research-log.jsonl         # Experiment log: one JSON object per line per cycle
  wip/                       # In-progress research state (cleaned up on completion)
  project-profiles/          # Per-project knowledge files from study mode
    joshua.md
    lead-generator.md
    adforge.md
    ...
  cross-project-patterns.md  # Patterns that appear across multiple projects
```

### Research Log Format (JSONL)

One JSON object per line — no delimiter collision, self-describing, trivially parseable:

```json
{"timestamp":"2026-04-07T14:30:00Z","topic":"LiveKit SIP","cycle":1,"playbook_version":"1.0","sources_used":["web_search","context7","github"],"scores":{"depth":5,"source_diversity":4,"corroboration":6,"actionability":7,"novelty":3},"composite":5.0,"notes":"Only found overview docs, no real-world implementation examples"}
```

---

## Mode 1: Research Loop (`/bunn-learn-research <topic>`)

### Purpose

Run an autonomous, self-improving research loop on any topic. Iterates: research → write to file → score → diagnose gaps → research again — until quality plateaus or hits threshold.

### The Rubric (Count-Based)

Every research output is scored 1-10 on five dimensions using **countable criteria**:

| Dimension | 1-3 (Poor) | 4-6 (Adequate) | 7-8 (Good) | 9-10 (Excellent) |
|-----------|------------|-----------------|-------------|-------------------|
| **Depth** | 0-1 primary sources, 0 code examples | 2-3 primary sources, 1 code example | 4-5 primary sources, 2-3 code examples, some edge cases | 6+ primary sources, 4+ code examples, edge cases + failure modes |
| **Source Diversity** | 1 source type used | 2-3 source types used | 4 source types, each contributing ≥1 unique finding | 5+ source types, each contributing ≥1 unique finding |
| **Corroboration** | 0 claims cross-verified | 1-3 claims verified across 2+ sources | 4-6 claims verified, contradictions flagged | 7+ claims verified, contradictions resolved or documented |
| **Actionability** | 0 concrete steps or examples | 1-2 actionable items, generic advice | 3-4 specific implementable steps with code | 5+ implementable steps, ready-to-use code + config examples |
| **Novelty** | 0 non-obvious findings | 1 finding not on page 1 of Google | 2-3 non-obvious insights from diverse sources | 4+ surprising findings, hidden connections, or contrarian evidence with data |

**Composite score** = average of all five dimensions (equal weighting for v1; evolve mode may introduce topic-specific weights later).
**Target threshold** = 8.0 (configurable via `--threshold`).
**Plateau detection** = if score doesn't improve by 1.0+ for 3 consecutive cycles, stop.

### Calibration Examples

The playbook includes 3 golden examples read before every self-scoring to anchor ratings:

**Example A — Score 4.2 (Poor research):**
> "LiveKit is a real-time communication platform. It supports WebRTC. You can use it for video calls."
> Depth: 2 (0 primary sources, 0 code), Diversity: 2 (web search only), Corroboration: 1 (0 verified), Actionability: 2 (0 steps), Novelty: 1 (0 non-obvious)

**Example B — Score 6.4 (Adequate research):**
> "LiveKit's SIP integration requires the SIP Trunk resource. Here's a basic config from the docs: [code]. Community reports latency issues with Twilio trunks — see GitHub issue #1234. Alternative: use LiveKit's hosted SIP service."
> Depth: 5 (2 primary sources, 1 code example), Diversity: 6 (docs + GitHub + web = 3 types), Corroboration: 5 (2 claims cross-checked), Actionability: 8 (concrete config), Novelty: 4 (1 non-obvious finding)

**Example C — Score 8.6 (Excellent research):**
> "LiveKit SIP has three trunk modes: inbound, outbound, and direct. [Code for each]. The undocumented `enable_krisp` parameter on trunk config enables noise cancellation — found in source code but not docs. Performance: 200ms median setup time per LiveKit benchmarks, but Discord user reports 800ms with Twilio due to SRTP negotiation. Recommended: use LiveKit's hosted trunk for <500ms setup, self-host only if you need custom DTMF handling."
> Depth: 9 (5 primary sources, 3 code examples, edge cases), Diversity: 8 (docs + source code + Discord + benchmarks + GitHub = 5 types), Corroboration: 8 (6 claims verified, contradictions documented), Actionability: 9 (5 steps, ready-to-use config, decision criteria), Novelty: 9 (4 non-obvious: undocumented param, real-world latency data, SRTP detail, DTMF edge case)

### Source Registry (Initial)

Each source type has an initial effectiveness estimate (1-10) and its concrete tool chain:

| Rank | Source Type | Effectiveness | Tool Chain |
|------|-------------|---------------|------------|
| 1 | Official documentation | 8/10 | Context7 MCP → `resolve-library-id` then `query-docs` |
| 2 | GitHub repos/issues/discussions | 8/10 | WebSearch `site:github.com <topic>` → WebFetch specific URLs |
| 3 | Web search (general) | 6/10 | WebSearch tool directly |
| 4 | Medium / Dev.to articles | 6/10 | WebSearch `site:medium.com OR site:dev.to <topic>` → WebFetch |
| 5 | Reddit / HN threads | 5/10 | WebSearch `site:reddit.com OR site:news.ycombinator.com <topic>` → WebFetch |
| 6 | Stack Overflow | 5/10 | WebSearch `site:stackoverflow.com <topic>` → WebFetch |
| 7 | Academic papers / blogs | 4/10 | WebSearch `<topic> paper OR research` → WebFetch |
| 8 | YouTube video content | 4/10 | Phase 2 — metadata only for now (noembed API for title/channel) |
| 9 | Podcast transcripts | 3/10 | WebSearch `<topic> podcast transcript` → WebFetch if found |
| 10 | Discord / Slack archives | 3/10 | WebSearch `site:discord.com <topic>` → WebFetch if indexable |

New sources discovered during research or evolve cycles get added at 5/10 ("untested baseline").

### One Research Cycle

```
1.  READ PLAYBOOK     — Load research-playbook.md for source rankings, strategies, calibration examples
2.  READ HISTORY      — Check research-log.jsonl for past research on this exact topic
3.  PLAN              — Select top 4-5 sources based on playbook rankings, decide search queries
4.  GATHER            — Hit each source using tool chains from source registry:
                         - WebSearch for web/site-specific results
                         - WebFetch for specific URLs and articles
                         - Context7 MCP for library documentation
                         - Firecrawl when WebFetch returns <100 chars useful content (JS-heavy pages)
5.  WRITE TO FILE     — *** MANDATORY *** Write raw findings to wip/<topic-slug>-cycle-<N>.md
                         This offloads context so earlier cycles aren't forgotten.
                         Without this step, context window fills by cycle 3.
6.  SYNTHESIZE        — Read all wip/<topic-slug>-cycle-*.md files, combine findings:
                         - Merge overlapping info, flag contradictions, note gaps
                         - COUNT: primary sources, code examples, cross-verified claims,
                           actionable items, non-obvious findings
7.  SELF-SCORE        — Read calibration examples first to anchor scoring.
                         Rate output against rubric using counts from step 6.
8.  DIAGNOSE          — Identify lowest-scoring dimensions with specific counts:
                         "Depth: 5 — found 2 primary sources but only 1 code example"
                         "Source diversity: 4 — only used 2 source types (web, docs)"
9.  DECIDE            — If composite >= threshold OR plateau detected: STOP → write final report
                         Otherwise: plan next cycle targeting weakest dimensions
10. LOG               — Append to research-log.jsonl (see JSONL format above)
11. ITERATE           — Go to step 3 with updated plan
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| WebFetch returns 403/404/timeout | Skip source, note in cycle log, try next source. Not a failure — some sources are unreachable. |
| Context7 has no docs for library | Fall back to WebSearch `<library> documentation` → WebFetch official site |
| WebFetch returns <100 chars useful | Try Firecrawl for same URL. If still empty, skip and note. |
| All sources for a dimension fail | Score that dimension as-is (low). Diagnose will flag it for next cycle with alternative sources. |
| Context window approaching limit | Write all current state to wip/ files, summarize findings, gracefully end loop with current score. |
| Self-score ties across dimensions | Target the dimension whose source types have the most untried options in the playbook. |

### Output

Final research report written to `research/<topic-slug>.md` in the current project directory:

- Executive summary (3-5 sentences)
- Detailed findings organized by subtopic
- Source list with quality ratings
- Contradictions or open questions
- Actionable next steps
- Meta section: which sources contributed most, what the loop learned
- Score history: composite score per cycle showing improvement trajectory

**Git behavior**: The final report is committed with message `research: <topic> (score: X.X after N cycles)`. Work-in-progress files in `wip/` are cleaned up after the final report is written and are NOT committed.

### YouTube Handling (Phase 2)

YouTube transcript extraction lacks a reliable free method from Claude Code. Deferred to Phase 2:

**Phase 1 (now):** YouTube metadata only — noembed API for title/channel, WebFetch for video page description when accessible.

**Phase 2 investigation plan:**
1. Test `youtubetranscript.com` and similar services via WebFetch
2. Test YouTube's `timedtext` API endpoint (sometimes works without auth)
3. If no free method works, fall back to: title + description + top comments via WebFetch
4. Document working method in playbook

### Rate Limiting & Safety

- Maximum 5 research cycles per invocation (`--max-cycles`)
- 2-second delay between external API calls
- Maximum 10 web fetches per cycle (`--max-fetches`)
- Caches fetched content to avoid redundant requests within a session
- Research mode is read-only — no code changes during research
- Only the final report is committed to git

---

## Mode 2: Study Mode (`/bunn-learn-study <project>`)

*Phase 3 — built after research loop is proven*

### Purpose

Deep-read a project's codebase and produce a structured knowledge profile stored in memory. Updated incrementally on subsequent runs.

### What It Analyzes

- **Architecture**: Monolith vs. modular, routing patterns, middleware chains
- **Key patterns**: Error handling, state management, data flow, auth
- **Tech stack**: Libraries used, why (inferred from usage patterns + package.json)
- **Test coverage**: What's tested, what's not, test patterns used
- **Code quality signals**: Complexity hotspots, dead code, inconsistent patterns
- **Git history insights**: Most-changed files, recent focus areas, contributor patterns

### Cross-Project Comparisons

After studying 2+ projects, the skill maintains `cross-project-patterns.md`:

- Same problem, different solutions across projects
- Shared utilities that could be extracted
- Inconsistencies that may indicate tech debt in one project
- Patterns that work well in one project and could benefit others

### Output

Per-project profile in `project-profiles/<project>.md` + updated cross-project file.

---

## Mode 3: Evolve Mode (`/bunn-learn-evolve`)

*Phase 4 — built after study mode*

### Purpose

Meta-learning: review past research and study sessions to improve future performance.

### What It Reviews

From `research-log.jsonl`:
- Which source types consistently scored highest across topics?
- Which sources were tried but rarely produced valuable info?
- Which topics had low scores — and what source *would have* helped?
- Were any new sources discovered accidentally during research?
- Are there patterns in what makes research actionable vs. abstract?

### Output

Updated `research-playbook.md` with:
- Incremented version number (e.g., v1.0 → v1.1)
- Re-ranked source registry with updated effectiveness scores based on actual data
- New sources discovered and added (starting at 5/10)
- Deprecated sources moved to "low value" tier (effectiveness < 3/10)
- Strategy notes: "For infrastructure topics, GitHub issues outperform blog posts"
- Research anti-patterns to avoid
- Updated calibration examples if better ones were found

### Playbook Versioning

The playbook includes version metadata:

```markdown
---
version: "1.0"
last_updated: "2026-04-07"
total_research_sessions: 0
---
```

Each research-log.jsonl entry records which playbook version was used. This enables:
- Tracking whether playbook changes improve or degrade research quality
- Reverting to a previous version if evolve mode causes regression
- Measuring evolve mode's actual impact over time

### Self-Expanding Source Discovery

The evolve mode actively looks for new source types by:
1. Reviewing research reports for mentions of sources not in the registry
2. Searching for "best resources for <topic-category>" to find new platforms
3. Testing new sources on previously-researched topics to measure improvement
4. Promoting sources that improve scores (effectiveness += 1), demoting those that don't (effectiveness -= 1)

---

## Phase 5: Code Optimization Loop (Future)

*Built on top of all three modes*

Once research, study, and evolve are proven, the same pattern extends to code:

- `/bunn-learn-optimize <metric>` — autonomous code improvement loop
- Uses study mode's project knowledge to make informed changes
- Uses research mode to find better approaches before implementing
- Uses evolve mode to learn which optimization strategies work best
- Metrics: test coverage, response time, bundle size, security score, code complexity
- Protected files list defined per project (`.env`, migrations, production configs)

---

## Build Phases

### Phase 1: Research Loop Engine (START HERE)
- Build `/bunn-learn-research.md` skill file
- Count-based rubric with calibration examples
- Source registry with effectiveness scores and concrete tool chains
- Iteration loop with plateau detection (1.0 threshold, 3 consecutive cycles)
- JSONL research log
- Mandatory wip/ file writes for context management
- Initial research-playbook.md (v1.0) with versioning
- YouTube metadata only (transcripts deferred to Phase 2)
- Error handling for all source failure scenarios

### Phase 2: Hone the Research Loop
- Run on 5-10 real topics across different domains
- Review results manually, tune rubric counts
- Identify which sources actually produce value vs. initial estimates
- Fix issues found during real usage
- Validate plateau detection
- Investigate and implement YouTube transcript extraction

### Phase 3: Study Mode
- Build `/bunn-learn-study.md` skill
- Run against each project
- Build project profiles
- Implement cross-project comparison

### Phase 4: Evolve Mode
- Build `/bunn-learn-evolve.md` skill
- Implement research log analysis
- Implement playbook updates with versioning
- Test source discovery mechanism

### Phase 5: Code Optimization
- Build `/bunn-learn-optimize.md` skill
- Integrate with study mode for context
- Integrate with research mode for finding better approaches
- Full autonomous improvement loop with git-based keep/revert
- Define protected files list per project

---

## Success Criteria

- Research loop produces consistently higher-quality reports than ad-hoc Claude research (measured by count-based rubric)
- Scores improve across cycles within a single research session
- Study mode accurately describes project architecture (verified by Joey)
- Evolve mode discovers at least 2 new useful source types within first month
- Playbook effectiveness scores diverge from initial estimates based on real data (tracked via versioning)
- Code optimization (Phase 5) produces real, mergeable improvements overnight

## Non-Goals

- No web dashboard for v1 (git log + JSONL is sufficient)
- No scheduled/cron runs for v1 (manual invocation only)
- No multi-user support (this is Joey's personal tool)
- No integration with external project management (Linear, Jira, etc.)
- No topic-specific rubric weights for v1 (equal weighting; evolve mode may add this later)
