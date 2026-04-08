# Research: Claude Code context:fork Subagent Isolation Patterns

**Date:** 2026-04-08
**Cycles:** 3
**Final Score:** 8.0/10
**Playbook Version:** 1.1

## Executive Summary

Claude Code offers three isolation modes for skills and tasks: **inline** (shared context, no overhead), **context:fork** (skill runs in isolated subagent, less overhead than full subagent), and **custom subagent** (full isolation with own context, model, tools, and persistent memory). The decision hinges on whether the task's working context benefits the main conversation. Subagents receive exactly 4 things (prompt, system prompt, environment, skills) and inherit nothing from the parent — "front-load everything needed." Token economics: Haiku subagents cost ~5K tokens, Sonnet 30-50K, MCP servers add 10-20K each. The `context:fork` feature is newer and actively evolving (GitHub issues #14661, #17283). The safety pattern `disable-model-invocation: true` + `context: fork` prevents dangerous auto-triggering while keeping isolation benefits.

## Detailed Findings

### Three Isolation Modes

**1. Inline (No Isolation)**
```yaml
---
name: my-skill
description: Does something in the main conversation
---
```
- Runs in main conversation context
- Full access to conversation history
- No token overhead
- **Use when:** Output directly informs current work, you need transparency, task is small/quick

**2. context:fork (Skill-Level Isolation)**
```yaml
---
name: deep-analysis
description: Comprehensive codebase analysis
context: fork
agent: Explore  # Optional: route to specific agent type
---
```
- Skill content injected into a forked agent
- Separate conversation history from parent
- Parent permissions stay clean
- Batch approval: all permissions declared upfront
- **Use when:** Multi-step workflows that should execute as a transaction, verbose skills that would clutter main context

**3. Custom Subagent (Full Isolation)**
```yaml
# ~/.claude/agents/researcher.md
---
name: researcher
description: Research agent for documentation and codebase exploration
tools: Read, Grep, Glob, WebFetch, WebSearch
model: haiku
memory: project
background: true
color: blue
---

You are a research specialist. Explore thoroughly, return concise summaries.
```
- Own context window, system prompt, tool access, permissions
- Can specify model (haiku/sonnet/opus)
- Persistent memory across conversations
- Can run in background, in git worktrees
- **Use when:** Reusable specialist patterns, research tasks, parallel work, cost control

### Decision Framework

| Question | Inline | Fork | Subagent |
|----------|--------|------|----------|
| Does the output inform the current conversation? | Yes | No | No |
| Is the task generating verbose output? | No | Yes | Yes |
| Do you need to reuse this pattern? | No | Maybe | Yes |
| Do you want cost control (model routing)? | No | No | Yes |
| Is this a one-off transactional workflow? | No | Yes | No |
| Do you need persistent memory? | No | No | Yes |
| Should it run in the background? | No | No | Yes |

**Core principle:** "If a worker only needs to return a result, use a subagent. If workers need to talk to each other during execution, use agent teams."

**Strong signals for subagents:** Tasks exploring 10+ files or involving 3+ independent work pieces.

### context:fork vs skills-in-subagent (Key Distinction)

These are **inverses** of each other:

| Approach | Who controls behavior? | How skill content loads |
|----------|----------------------|----------------------|
| `context: fork` on a skill | Skill defines behavior | Skill content injected into forked agent |
| `skills:` field on a subagent | Subagent defines behavior | Skill content preloaded as knowledge |

### Subagent Architecture

**What subagents receive (exactly 4 things):**
1. Prompt string (only communication from parent)
2. System prompt (from agent markdown body)
3. Environment details (working directory, platform, shell)
4. Specified skills (only those listed in frontmatter)

**What they do NOT receive:** Parent conversation history, prior tool calls, other subagents' outputs. Zero inheritance.

**Communication protocol:** Single round-trip. Prompt in → autonomous execution → final message returns. No streaming, no mid-execution interrupts.

**Results format:** Unstructured text, JSON, or file-based handoff (one agent writes `REVIEW.md`, next reads it).

### Token Economics

| Component | Approximate Cost |
|-----------|-----------------|
| Explore subagent (Haiku) | ~5K tokens |
| General-purpose (Sonnet) | 30-50K tokens |
| Each MCP server (tool descriptions) | 10-20K tokens |
| Inline MCP scoped to subagent | Saves 10-20K from main |

**Context savings formula:**
- N tasks inline = (input + working + answer) × N in main window
- N tasks via subagent = only answer × N in main window

### Complete Subagent Frontmatter (15 Fields)

| Field | Required | Description |
|-------|----------|-------------|
| name | Yes | Unique identifier, lowercase + hyphens |
| description | Yes | When to delegate to this subagent |
| tools | No | Allowlist of tools (inherits all if omitted) |
| disallowedTools | No | Denylist (removed from inherited pool) |
| model | No | sonnet, opus, haiku, full ID, or inherit |
| permissionMode | No | default, acceptEdits, auto, dontAsk, bypassPermissions, plan |
| maxTurns | No | Maximum agentic turns before stop |
| skills | No | Skills preloaded into context at startup |
| mcpServers | No | MCP servers (inline or reference) |
| hooks | No | Lifecycle hooks scoped to subagent |
| memory | No | user, project, or local |
| background | No | true = runs as background task |
| effort | No | low, medium, high, max |
| isolation | No | worktree = own git worktree |
| color | No | UI color: red, blue, green, yellow, purple, orange, pink, cyan |
| initialPrompt | No | Auto-submitted first user turn |

### Safety Patterns

**Dangerous skills (deploy, delete, migrate):**
```yaml
---
name: deploy
description: Deploy to production
disable-model-invocation: true  # Only user can trigger
context: fork                    # Runs in isolation
allowed-tools: Bash(git:*), Bash(npm:*)
---
```

**Read-only research:**
```yaml
---
name: researcher
tools: Read, Grep, Glob
permissionMode: plan  # Read-only mode
model: haiku          # Cost-efficient
---
```

### Persistent Memory

| Scope | Location | Use When |
|-------|----------|----------|
| user | `~/.claude/agent-memory/<name>/` | Cross-project knowledge |
| project | `.claude/agent-memory/<name>/` | Project-specific, version controlled |
| local | `.claude/agent-memory-local/<name>/` | Project-specific, not in VCS |

First 200 lines of `MEMORY.md` auto-loaded. Subagent can read/write/edit memory files.

### Critical Gotchas

1. **Subagents cannot spawn subagents** — no nesting
2. **No true concurrency** — subagents queue commands while working; use Agent tool for parallel
3. **Zero inheritance** — must front-load everything needed in the prompt
4. **context:fork is actively evolving** — some behaviors may not be fully documented (GitHub issues #14661, #17283)
5. **bypassPermissions parent overrides** — if parent uses bypassPermissions, child can't restrict
6. **auto mode parent** — subagent inherits auto mode, can't override

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Official subagent docs (code.claude.com) | 1 | Definitive — 15 fields, all patterns | high |
| Anthropic blog (subagents) | 1 | Decision framework, when to use | high |
| morphllm.com guide | 1 | Token economics, 6 patterns, communication protocol | high |
| RichSnapp.com | 1 | Attention dilution, inline vs subagent decision | high |
| Context7 | 1 | Frontmatter fields reference | medium |
| ClaudeWorld tutorial | 1 | Spawning mechanics, model strategy | medium |
| GitHub issues | 3 | Feature evolution, active development | medium |
| Web search | 2 | Various practical guides | medium |

## Contradictions & Open Questions

- **No major contradictions.** All sources agree on the 3-mode model.
- **Open:** How does `context: fork` + `agent:` interact with the `skills:` field? Can a forked skill preload other skills?
- **Open:** What's the actual latency overhead of context:fork vs inline? No benchmark data found.
- **Open:** Will agents eventually be able to decide themselves whether to fork? (José Valim's question)
- **Open:** How does fork interact with the `hooks` frontmatter field for skills?

## Actionable Next Steps (for BunnLearn)

1. **Add `context: fork` to bunn-learn-research SKILL.md** — research is the perfect use case (verbose, doesn't need main context)
2. **Consider `agent: Explore`** for the gather phase (read-only, Haiku = cheap)
3. **Add `memory: user`** so BunnLearn's playbook learnings persist across projects
4. **Test fork overhead** — run same research topic with and without fork, compare context usage
5. **Create a bunn-learn-research subagent** as an alternative to the skill — subagent gives more control (model, tools, memory, background)
6. **Use `disable-model-invocation: true`** if we don't want Claude auto-triggering research on every question

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 5 | 6 | 7 | 7 | 6.4 |
| 2 | 8 | 7 | 8 | 8 | 7 | 7.6 |
| 3 | 8 | 7 | 8 | 9 | 8 | 8.0 |

## Meta: What the Loop Learned

- **Most valuable source:** Official subagent docs (code.claude.com/docs/en/sub-agents) — the single definitive reference with all 15 frontmatter fields, permission models, and patterns. Dense but complete.
- **Least valuable source:** Context7 — returned frontmatter field examples but nothing about context:fork or subagent isolation specifically.
- **Surprising discovery:** context:fork is a newer, actively evolving feature (GitHub issues still being filed). The distinction between fork-on-skill and skills-in-subagent being *inverses* is not explained clearly anywhere except the official docs. Also, the "no true concurrency" gotcha — subagents queue commands, you need the Agent tool for actual parallelism.

Sources:
- [Official Subagent Docs](https://code.claude.com/docs/en/sub-agents)
- [Anthropic Blog: Subagents](https://claude.com/blog/subagents-in-claude-code)
- [morphllm: Complete Subagent Guide](https://www.morphllm.com/claude-subagents)
- [RichSnapp: Context Management](https://www.richsnapp.com/article/2025/10-05-context-management-with-subagents-in-claude-code)
- [GitHub Issue #14661: context:fork for commands](https://github.com/anthropics/claude-code/issues/14661)
- [GitHub Issue #17283: Skill tool honoring fork](https://github.com/anthropics/claude-code/issues/17283)
- [ClaudeWorld: Subagents Tutorial](https://claude-world.com/tutorials/s04-subagents-and-context-isolation/)
