# BunnLearn: Autonomous Research & Learning Skill for Claude Code

**Date**: 2026-04-07
**Author**: Joey Bunn + Claude
**Status**: Draft

## Problem

Claude Code's research capabilities are ad-hoc. Every conversation starts from scratch — no accumulated knowledge about what sources work best, no self-assessment of research quality, no memory of which approaches yielded the best results. Research quality varies wildly between sessions.

Meanwhile, Joey's projects (Joshua, Lead Generator, AdForge, OptiVoice, Princeville Connect) share patterns and architecture decisions that Claude re-discovers every time instead of knowing deeply.

## Solution

A Claude Code skill called `bunn-learn` that applies the autoresearch pattern (atomic iteration + mechanical scoring + keep/revert) to three domains:

1. **Research quality** — autonomous loop that researches a topic, scores itself, identifies gaps, and iterates until quality plateaus
2. **Codebase comprehension** — deep study of project architecture, patterns, and cross-project comparisons
3. **Meta-learning** — reviews past research sessions to discover which sources and methods work best, evolving its own playbook

## Design Principles

- **Measurable over subjective**: Every improvement scored against a rubric with numeric metrics
- **Atomic iterations**: One change per cycle, scored independently
- **Git as memory**: All experiments committed, failures preserved in history for learning
- **Self-expanding**: The system discovers new research sources and methods on its own
- **Safe by default**: Never touches production branches, protected files list, rate limits on external APIs
- **Build in layers**: Research loop first, then study mode, then meta-learning, then code optimization

## Architecture

### Skill Structure

```
.claude/commands/bunn-learn/
  research.md          # Mode 1: autonomous research loop
  study.md             # Mode 2: codebase comprehension (Phase 3)
  evolve.md            # Mode 3: meta-learning (Phase 4)
```

### Persistent State

```
.claude/projects/<project>/memory/
  research-playbook.md       # Ranked source registry + strategies (evolves over time)
  research-log.tsv           # Experiment log: topic, sources, scores, timestamps
  project-profiles/          # Per-project knowledge files from study mode
    joshua.md
    lead-generator.md
    adforge.md
    ...
  cross-project-patterns.md  # Patterns that appear across multiple projects
```

---

## Mode 1: Research Loop (`/bunn-learn research <topic>`)

### Purpose

Run an autonomous, self-improving research loop on any topic. Instead of one search and a summary, the skill iterates: research, score, diagnose gaps, research again — until quality plateaus or hits threshold.

### The Rubric

Every research output is scored 1-10 on five dimensions:

| Dimension | 1 (Poor) | 5 (Adequate) | 10 (Excellent) |
|-----------|----------|---------------|-----------------|
| **Depth** | Surface-level summaries only | Some primary sources, moderate detail | Primary sources, implementation details, edge cases covered |
| **Source Diversity** | Single source type (e.g., only web search) | 3+ source types consulted | 5+ source types, each contributing unique information |
| **Accuracy** | Claims not verified | Some cross-referencing | All key claims verified across multiple independent sources |
| **Actionability** | Abstract knowledge only | Some concrete steps or code | Specific, implementable guidance with examples |
| **Novelty** | Only obvious/well-known info | Some non-obvious findings | Surprising insights, hidden connections, or contrarian evidence |

**Composite score** = average of all five dimensions.
**Target threshold** = 8.0 (configurable).
**Plateau detection** = if score doesn't improve by 0.5+ for 2 consecutive cycles, stop.

### Source Registry (Initial)

The research playbook starts with these source types, ranked by typical value:

1. **Official documentation** — via Context7 MCP or direct fetch
2. **GitHub repositories** — READMEs, source code, issues, discussions
3. **YouTube transcripts** — via transcript extraction APIs/services
4. **Web search** — general web results via WebSearch tool
5. **Medium / Dev.to articles** — developer-focused long-form content
6. **Reddit / Hacker News threads** — community discussions, real-world experience
7. **Stack Overflow** — specific technical Q&A
8. **Academic papers / blogs** — for deeper technical topics
9. **Podcast transcripts** — emerging source, when available
10. **Discord / Slack archives** — public community channels (when indexable)

New sources discovered during research or evolve cycles get added to the playbook with an initial "untested" rank.

### One Research Cycle

```
1. READ PLAYBOOK    — Load research-playbook.md for source rankings + strategies
2. READ HISTORY     — Check research-log.tsv for past research on this/similar topics
3. PLAN             — Select top sources for this topic, decide search queries
4. GATHER           — Hit each source:
                       - WebSearch for web results
                       - WebFetch for specific URLs, YouTube transcripts, articles
                       - Context7 for library documentation
                       - GitHub search for repos, code examples, discussions
                       - Firecrawl for deeper page scraping when needed
5. SYNTHESIZE       — Combine findings:
                       - Merge overlapping info
                       - Flag contradictions between sources
                       - Note information gaps
                       - Highlight surprising/novel findings
6. SELF-SCORE       — Rate output against rubric (all 5 dimensions, 1-10 each)
7. DIAGNOSE         — Identify lowest-scoring dimensions and why:
                       "Depth: 5 — only found overview docs, no implementation examples"
                       "Source diversity: 4 — didn't check YouTube or GitHub discussions"
8. DECIDE           — If composite >= 8.0 OR plateau detected: STOP and write report
                       Otherwise: plan next cycle targeting weakest dimensions
9. LOG              — Append to research-log.tsv:
                       timestamp | topic | cycle# | sources_used | scores | composite | notes
10. ITERATE         — Go to step 3 with updated plan
```

### Output

Final research report written to a project-specific location (e.g., `research/<topic>.md`) containing:

- Executive summary (3-5 sentences)
- Detailed findings organized by subtopic
- Source list with quality ratings
- Contradictions or open questions
- Actionable next steps
- Meta section: which sources contributed most, what the loop learned

### YouTube Transcript Handling

YouTube is a critical source that's currently underutilized. The skill handles it by:

1. Search YouTube for the topic via web search (`site:youtube.com <topic>`)
2. Extract video IDs from results
3. Fetch transcripts via:
   - `noembed.com/embed` for metadata (title, channel)
   - Transcript extraction services or APIs for captions
   - Fallback: video description + comments for context
4. Score transcript quality (auto-generated vs. manual captions)
5. Extract key points, timestamps for important sections

### Rate Limiting & Safety

- Maximum 5 research cycles per invocation (configurable)
- 2-second delay between external API calls
- Never makes more than 20 web fetches per cycle
- Caches fetched content to avoid redundant requests within a session
- All research is read-only — no code changes, no commits during research mode

---

## Mode 2: Study Mode (`/bunn-learn study <project>`)

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

Per-project profile in `memory/project-profiles/<project>.md` + updated cross-project file.

---

## Mode 3: Evolve Mode (`/bunn-learn evolve`)

*Phase 4 — built after study mode*

### Purpose

Meta-learning: review past research and study sessions to improve future performance.

### What It Reviews

From `research-log.tsv`:
- Which source types consistently scored highest across topics?
- Which sources were tried but rarely produced valuable info?
- Which topics had low scores — and what source *would have* helped?
- Were any new sources discovered accidentally during research?
- Are there patterns in what makes research actionable vs. abstract?

### Output

Updated `research-playbook.md` with:
- Re-ranked source registry based on actual performance data
- New sources discovered and added
- Deprecated sources moved to "low value" tier
- Strategy notes: "For infrastructure topics, GitHub issues outperform blog posts"
- Research anti-patterns to avoid: "Don't rely on single-source summaries for accuracy"

### Self-Expanding Source Discovery

The evolve mode actively looks for new source types by:
1. Reviewing research reports for mentions of sources not in the registry
2. Searching for "best resources for <topic-category>" to find new platforms
3. Testing new sources on previously-researched topics to measure improvement
4. Promoting sources that improve scores, demoting those that don't

---

## Phase 5: Code Optimization Loop (Future)

*Built on top of all three modes*

Once research, study, and evolve are proven, the same pattern extends to code:

- `/bunn-learn optimize <metric>` — autonomous code improvement loop
- Uses study mode's project knowledge to make informed changes
- Uses research mode to find better approaches before implementing
- Uses evolve mode to learn which optimization strategies work best
- Metrics: test coverage, response time, bundle size, security score, code complexity

This is the original autoresearch vision but built on a foundation of deep project understanding.

---

## Build Phases

### Phase 1: Research Loop Engine (START HERE)
- Build the `/bunn-learn research` skill
- Implement the rubric and self-scoring
- Implement the source registry with initial sources
- Implement the iteration loop with plateau detection
- Implement research-log.tsv logging
- YouTube transcript extraction
- Initial research-playbook.md

### Phase 2: Hone the Research Loop
- Run on 5-10 real topics across different domains
- Review results manually, tune the rubric weights
- Identify which sources actually produce value
- Fix issues found during real usage
- Validate plateau detection works correctly

### Phase 3: Study Mode
- Build `/bunn-learn study` skill
- Run against each project
- Build project profiles
- Implement cross-project comparison

### Phase 4: Evolve Mode
- Build `/bunn-learn evolve` skill
- Implement research log analysis
- Implement playbook updates
- Test source discovery mechanism

### Phase 5: Code Optimization
- Build `/bunn-learn optimize` skill
- Integrate with study mode for context
- Integrate with research mode for finding better approaches
- Full autonomous improvement loop with git-based keep/revert

---

## Success Criteria

- Research loop produces consistently higher-quality reports than ad-hoc Claude research (measured by rubric)
- Study mode accurately describes project architecture (verified by Joey)
- Evolve mode discovers at least 2 new useful source types within first month
- The playbook measurably improves — early research scores should be lower than later scores
- Code optimization (Phase 5) produces real, mergeable improvements overnight

## Non-Goals

- No web dashboard for v1 (git log + TSV is sufficient)
- No scheduled/cron runs for v1 (manual invocation only)
- No multi-user support (this is Joey's personal tool)
- No integration with external project management (Linear, Jira, etc.)
