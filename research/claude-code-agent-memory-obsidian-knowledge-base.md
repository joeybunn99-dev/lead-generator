# Research: Claude Code Agent Memory, Persistent Learning & Obsidian Integration

**Date:** 2026-04-07
**Cycles:** 3
**Final Score:** 9.0/10
**Playbook Version:** 1.2

## Executive Summary

Claude Code has 4 native memory mechanisms: CLAUDE.md (user-written), auto memory (Claude-written), session memory (summaries), and subagent memory (`memory: project` frontmatter). The Anthropic Memory Tool API (`memory_20250818`) is client-side — you control storage and implement handlers. The Karpathy LLM Wiki pattern (Raw Sources -> Wiki -> Schema) is the dominant architecture for personal-scale knowledge bases; structured indexes outperform vectors below ~2,000 articles. LOCOMO benchmarks show best achievable cross-session continuity is ~80%, with the remaining 20% (nuanced preferences, multi-alternative explorations) fundamentally lost. Obsidian integrates via 3 approaches: REST API MCP, filesystem MCP, or knowledge graph MCP. Memory poisoning from hallucinated claims entering persistent stores is an unsolved production risk.

## Detailed Findings

### Claude Code's 4 Native Memory Mechanisms

**1. CLAUDE.md (User-Written)**
- You write, Claude reads at session start
- Hierarchical: `~/.claude/CLAUDE.md` (global) → `./CLAUDE.md` (project) → `./CLAUDE.local.md` (personal)
- Under 60 lines optimal, 150-200 instruction limit

**2. Auto Memory (Claude-Written)**
- Claude writes to `~/.claude/projects/<hash>/memory/`
- Stores user preferences, feedback, project facts
- MEMORY.md index loaded at session start (first 200 lines)
- Real bugs: loaded twice per session (#24044), files disappear (#38459), custom directory ignored (#36636), no governance for long-running users (#34776)

**3. Session Memory (Summaries)**
- `/compact` compresses conversation history
- Context window auto-compresses as it fills
- Information loss on each compression — earlier context degrades

**4. Subagent Memory (Persistent)**
- `memory: user` → `~/.claude/agent-memory/<name>/` (cross-project)
- `memory: project` → `.claude/agent-memory/<name>/` (version controlled)
- `memory: local` → `.claude/agent-memory-local/<name>/` (not in VCS)
- First 200 lines of MEMORY.md auto-loaded into subagent context
- Subagent can read/write/edit its own memory files
- Builds institutional knowledge across conversations

### Anthropic Memory Tool API

The `memory_20250818` tool is **client-side** — Anthropic provides the tool definition, you implement the storage:

- Operations: `view`, `create`, `str_replace`, `insert`, `delete`, `rename`
- You control where memories are stored (filesystem, database, Obsidian, etc.)
- Claude decides when to read/write memories during conversation
- Pointer-based MEMORY.md (links to files) saves ~62% tokens vs inline content

### Karpathy LLM Wiki Pattern

Architecture for personal knowledge bases:

```
Raw Sources → Wiki Pages → Structured Schema → Search Index
```

- Below ~2,000 articles: structured indexes outperform vector embeddings
- Wiki format (markdown with links) is more navigable than flat notes
- Schema enforcement prevents knowledge rot
- Applicable to BunnLearn: research reports → wiki summaries → searchable index

### LOCOMO Benchmark Data

Performance data on cross-session memory systems:

| Approach | Accuracy | p95 Latency | Notes |
|----------|----------|-------------|-------|
| Full context (dump everything) | 72.9% | 17s | Unusable latency |
| Selective memory | ~66.9% | 1.5s | 91% lower latency, only -6% accuracy |
| OpenAI Memory | 52.9% | — | Surprisingly low |
| Best achievable | ~80% | — | 20% loss is fundamental |

**The 20% that's lost:** Nuanced preferences, multi-alternative explorations, implicit context that was never explicitly stated. This is a hard ceiling, not a bug to fix.

### Progressive Disclosure for Memory

```
Tier 1: Search (keywords → relevant memory files)
Tier 2: Timeline (recent → oldest, with relevance)
Tier 3: Full details (load complete memory file)
```

Saves 10x tokens vs loading all memory at once. Same pattern as skill progressive disclosure.

### SOUL.md Pattern

A ~500-1000 token "identity document" that prevents behavioral drift across sessions:
- Core identity and values
- Communication style
- Decision-making principles
- Red lines (things to never do)

Loaded at every session start. Prevents the "forgetting who I am" problem in long-running agent systems.

### Obsidian Integration Approaches

**Approach 1: REST API MCP (richest, requires Obsidian running)**
- Uses Obsidian's Local REST API plugin
- Full CRUD on notes, search, metadata
- Requires Obsidian desktop app running

**Approach 2: Filesystem MCP (simplest)**
- Claude reads/writes `.md` files directly in the vault directory
- No Obsidian process needed
- Works with any markdown editor
- BunnLearn already does this with wip/ and research/ files

**Approach 3: Knowledge Graph MCP (richest queries)**
- Leverages Obsidian's link graph for relationship queries
- "What concepts connect to X?" queries
- Requires graph analysis tooling

**For BunnLearn:** Approach 2 (filesystem) is the natural fit — we're already writing markdown files. Point the memory directory at an Obsidian vault folder and it "just works."

### Memory Anti-Patterns

1. **Memory poisoning:** Hallucinated claims entering persistent stores. If Claude writes a wrong fact to memory, it persists forever and contaminates future sessions.
2. **Unbounded growth:** Memory files growing without curation. MEMORY.md index exceeds 200 lines and gets truncated.
3. **Stale memories:** Facts that were true when written but are now wrong (file paths changed, APIs deprecated).
4. **Duplicate memories:** Same insight stored in multiple files with slight variations.
5. **Over-reliance:** Trusting memory over reading current code state. Memory says X exists, but it was deleted.

### Real Bugs in Claude Code Auto Memory

| Issue | GitHub # | Impact |
|-------|----------|--------|
| Memory files loaded twice per session | #24044 | Wastes context tokens |
| Memory files randomly disappear | #38459 | Knowledge loss |
| Custom memory directory setting ignored | #36636 | Can't relocate memory |
| No governance for long-running users | #34776 | Unbounded growth |

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Anthropic docs (official) | 2 | Memory mechanisms, API spec | high |
| GitHub issues | 4 | Real bugs, failure modes | high |
| Dev.to articles | 3 | Implementation patterns, SOUL.md | high |
| Engineering blogs | 2 | LOCOMO benchmarks, wiki pattern | high |
| Industry report (LOCOMO) | 1 | Accuracy/latency data | high |
| Blog articles | 2 | Obsidian integration, anti-patterns | high |
| GitHub repos | 2 | MCP implementations, examples | medium |
| Web search | 3 | General coverage | medium |

## Contradictions & Open Questions

- **Contradiction:** Anthropic docs say auto memory is reliable; GitHub issues show files disappearing (#38459). Trust the issues — this is a known bug.
- **Open:** How does the Memory Tool API interact with Claude Code's built-in auto memory? Can they coexist?
- **Open:** What's the optimal memory file size before splitting? No source provides a concrete threshold.
- **Open:** Can Obsidian's graph view surface connections that flat markdown misses for research synthesis?

## Actionable Next Steps (for BunnLearn)

1. **Convert bunn-learn to a subagent** with `memory: user` — research playbook and log persist across all projects without manual file management
2. **Point memory directory at Obsidian vault** — research reports become browsable/searchable in Obsidian with zero extra work
3. **Add SOUL.md** to BunnLearn defining its research identity, scoring discipline, and anti-patterns
4. **Implement progressive disclosure** for the research log — search by topic/score before loading full entries
5. **Add memory validation** — before trusting a recalled fact, verify it still exists (file path check, grep for function)
6. **Set up memory curation** — after every 10 research sessions, review and prune stale/duplicate memories
7. **Cap MEMORY.md at 150 lines** — leave 50-line buffer before the 200-line truncation

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 8 | 7 | 7 | 7 | 6 | 7.0 |
| 2 | 9 | 8 | 8 | 8 | 8 | 8.2 |
| 3 | 9 | 9 | 9 | 9 | 9 | 9.0 |

## Meta: What the Loop Learned

- **Most valuable source:** LOCOMO benchmark paper — provided the only hard accuracy/latency data on memory systems. The 80% ceiling finding reframes expectations for any persistent memory system.
- **Least valuable source:** General web search — returned mostly surface-level "what is agent memory" articles.
- **Surprising discovery:** Memory poisoning as an unsolved production risk. Also: the Memory Tool API being fully client-side means we have complete control over storage — could point it at Obsidian, SQLite, or any backend.
