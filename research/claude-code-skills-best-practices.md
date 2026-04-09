# Research: Claude Code Skills Best Practices

**Date:** 2026-04-09
**Cycles:** 2
**Final Score:** 8.2/10
**Playbook Version:** 1.2

## Executive Summary

Claude Code skills are composable, folder-based instruction packages that teach Claude specialized workflows. The description field is the single most critical element -- community testing shows activation rates ranging from 20% (vague descriptions) to 84% (with forced eval hooks). Skills follow a three-level progressive disclosure pattern where only metadata loads at startup (~100 tokens), the full SKILL.md loads on invocation (<500 lines), and bundled reference files load as-needed. Production-grade skills require evaluation-driven development, configuration hardening against platform changes, and an evolving "gotchas section" that captures real failure modes over time.

## Detailed Findings

### SKILL.md Structure & Frontmatter

Every skill requires a `SKILL.md` file with YAML frontmatter and markdown content. The directory structure supports bundled resources:

```
my-skill/
├── SKILL.md           # Main instructions (required, <500 lines)
├── reference.md       # Detailed docs (loaded as-needed)
├── examples/          # Example outputs
└── scripts/           # Executable utilities (run, not loaded into context)
```

**Frontmatter fields (all optional except description which is recommended):**

| Field | Purpose |
|---|---|
| `name` | Display name, max 64 chars, lowercase + hyphens only |
| `description` | What it does + when to use it, max 1024 chars, front-load key use case (truncated at 250 chars in listing) |
| `disable-model-invocation` | `true` = only user can invoke (for side-effect workflows like deploy) |
| `user-invocable` | `false` = only Claude can invoke (for background knowledge) |
| `allowed-tools` | Pre-approve tools without per-use prompts |
| `context` | `fork` = run in isolated subagent |
| `agent` | Subagent type: `Explore`, `Plan`, `general-purpose`, or custom |
| `effort` | Override session effort: `low`, `medium`, `high`, `max` |
| `paths` | Glob patterns limiting when skill activates |
| `hooks` | Hooks scoped to skill lifecycle |
| `model` | Override model for this skill |
| `shell` | `bash` (default) or `powershell` |
| `argument-hint` | Autocomplete hint, e.g., `[issue-number]` |

**String substitutions:** `$ARGUMENTS`, `$ARGUMENTS[N]` / `$N`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}`

### Description: The Most Critical Field

Claude uses **pure LLM reasoning** (not embeddings or keyword matching) to route skill activation. This makes semantic specificity more valuable than exact phrase matching.

**Rules for effective descriptions:**
1. Write in **third person** always -- inconsistent POV breaks system prompt injection
2. Include both **what** it does and **when** to use it
3. Embed **3-5 natural trigger phrases** users would actually say
4. Front-load the key use case (truncated at 250 chars)
5. Be specific about file types and capabilities

**Community-measured activation rates:**
- No optimization: ~20% activation
- Optimized descriptions: ~50%
- LLM pre-eval hooks: ~80%
- Forced eval hooks: ~84%

**Good:** "Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction."

**Bad:** "Helps with documents" (20% activation)

### Progressive Disclosure Architecture

Three levels minimize token overhead:

1. **Metadata** (~100 tokens): name + description always in context. Budget: 1% of context window (fallback 8,000 chars). Adjustable via `SLASH_COMMAND_TOOL_CHAR_BUDGET`.
2. **SKILL.md body** (<500 lines): loaded only when triggered. Enters conversation as single message, stays for session.
3. **Bundled resources** (unlimited): loaded as-needed via filesystem reads. Scripts executed without loading content into context.

**Post-compaction behavior:** After auto-compaction, skills are re-attached with first 5,000 tokens each, combined budget of 25,000 tokens, most-recently-invoked first. Older skills can be dropped entirely if many were invoked. Re-invoke a skill after compaction to restore full content.

**Critical:** Keep references one level deep from SKILL.md. Avoid `SKILL.md -> advanced.md -> details.md` chains -- Claude may use `head -100` to preview deeply nested files, resulting in incomplete information.

### Content Design: Degrees of Freedom

Match specificity to task fragility:

| Freedom Level | When to Use | Example |
|---|---|---|
| **High** (text guidelines) | Multiple valid approaches, context-dependent | Code review checklists |
| **Medium** (pseudocode/parameters) | Preferred pattern exists, some variation OK | Report generation templates |
| **Low** (exact scripts) | Fragile operations, consistency critical | Database migrations, deployments |

**Key principle:** "Only add context Claude doesn't already have." Challenge each paragraph: does it justify its token cost?

### Advanced Patterns

**Dynamic context injection:** `` !`command` `` syntax runs shell commands BEFORE content is sent to Claude. The output replaces the placeholder. For multi-line commands, use ` ```! ` fenced blocks.

**Subagent execution:** `context: fork` runs the skill in isolation. The skill content becomes the subagent's task. Only makes sense for skills with explicit instructions (not just guidelines). Use `agent: Explore` for read-only research, `agent: Plan` for planning.

**Visual output:** Bundle scripts that generate HTML files. The script does heavy lifting; Claude handles orchestration. Pattern works for dependency graphs, test coverage, schema visualizations.

**Skill-scoped hooks:** Attach hooks to skill lifecycle events for deterministic enforcement when prompt-based instructions aren't reliable enough.

**Extended thinking:** Include "ultrathink" anywhere in skill content to enable extended thinking mode.

### Evaluation-Driven Development

The recommended workflow from Anthropic's own skill-creator:

1. **Run baseline** without skill -- document specific failures
2. **Create 3+ test scenarios** covering the gaps
3. **Measure with/without** performance delta
4. **Iterate** on weakest areas

**Three testing tiers:**
- **Triggering tests:** Loads on relevant requests, paraphrases, AND doesn't activate on unrelated topics
- **Functional validation:** Correct outputs, successful API calls, error handling
- **Comparative benchmarking:** Token consumption, message count, execution reliability

**Description optimization loop:**
1. Generate 20 eval queries (8-10 should-trigger, 8-10 should-not-trigger)
2. Run `scripts/run_loop` from skill-creator with `--max-iterations 5`
3. Apply the winning description

**Iterative co-development:** Work with one Claude instance ("Claude A") to design the skill, test with another ("Claude B") on real tasks, observe behavior, bring findings back to Claude A.

### Composition & Multi-Skill Patterns

**Five recurring patterns:**
1. **Sequential orchestration** -- strict ordering (onboarding, project setup)
2. **Multi-MCP coordination** -- phase-gated data flow across services
3. **Iterative refinement** -- validation loops with automated quality checks
4. **Context-aware tool selection** -- same outcome via different tools based on input
5. **Domain-specific intelligence** -- embedded expertise applied before tool execution

**Chaining without new skills:** Multiple skills can run sequentially in a single prompt with conditional logic between them.

**Parallel multi-perspective review:** Spawn separate agents with different persona files to evaluate the same document independently. "If three agents with different lenses all flag the same thing, that's the thing to pay attention to."

### Configuration Hardening & Resilience

In Feb-Mar 2026, three simultaneous platform changes degraded skill output quality:
- Effort default dropped from `high` to `medium` (effort=85) without visibility
- Adaptive thinking lets model under-allocate reasoning budget
- Thinking redaction hides reasoning chains, making fabrications harder to detect

**Result:** 5:1 ratio favoring "simple" solutions over best-practice implementations.

**Hardening practices:**

```bash
# Pin known-good settings
CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1
CLAUDE_CODE_EFFORT_LEVEL=high
showThinkingSummaries: true
```

- Audit settings regularly -- defaults shift with updates
- Read changelogs actively
- Pin configurations to known-good states
- Monitor thinking visibility
- Interrupt early when you see fabricated API versions or package names

### The "Convergence Cliff"

Once AI-generated codebases reach sufficient complexity, accumulated errors create cascading failures that no agent can salvage. **Invest in architectural guardrails (typing, linting, design docs) before crossing that threshold.** This applies to skills too -- complex skill chains can amplify errors.

### Security Considerations

- Install skills only from trusted sources
- Audit code and network connections before enabling
- Never put API keys, tokens, or secrets in SKILL.md files
- Use environment variables or secrets managers
- The `disableSkillShellExecution` setting blocks `!`command`` in untrusted skills

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|---|---|---|---|
| Anthropic docs (code.claude.com) | 1 | 15+ | high |
| Anthropic API docs (platform.claude.com) | 1 | 10+ | high |
| Anthropic engineering blog | 1 | 5 | high |
| GitHub skill-creator SKILL.md | 1 | 8 | high |
| GitHub community gists | 2 | 6 | medium |
| Substack articles | 1 | 4 | medium |
| HN discussion | 1 | 3 | medium |
| Dev.to (breaking changes) | 1 | 5 | high |
| awesome-claude-skills repo | 1 | 3 | medium |
| last30days (Reddit) | 1 | 2 | low |

## Contradictions & Open Questions

**Contradictions:**
1. **Skills vs. simpler approaches:** HN commenter achieves "90%+ success" with static docs + per-ticket markdown. Official guidance assumes skills always add value. Reality: skills compound for repeating workflows; simple docs suffice for one-off context.
2. **Activation reliability:** Community measures 20-84% activation. Official docs present activation as reliable with good descriptions. The quantitative gap suggests official guidance is optimistic about out-of-box activation.
3. **Distribution ease:** Official docs present sharing as straightforward (commit to VCS, plugins). HN practitioners identify it as a major pain point ("even small teams end up with config sprawl").
4. **Platform stability:** Official docs don't mention that default settings silently change between releases. Dev.to documents degradation from Feb-Mar 2026 effort default change.

**Open Questions:**
- How to effectively version skills and manage migrations when the platform evolves?
- What is the maximum number of skills before description budget becomes a bottleneck?
- How do skills interact with each other when multiple activate in the same session?
- What are the actual token costs of skill loading vs. the context window savings from progressive disclosure?
- Will the Agent Skills open standard (agentskills.io) achieve real cross-platform adoption beyond Claude?

## Actionable Next Steps

1. **Write descriptions in third person** with 3-5 natural trigger phrases and explicit "Use when..." clauses
2. **Keep SKILL.md under 500 lines** with one-level-deep references to supporting files
3. **Build a gotchas section** in every skill and update it from real failure modes over time
4. **Use evaluation-driven development**: baseline without skill, then measure improvement with 3+ test scenarios
5. **Match degrees of freedom to task fragility**: exact scripts for deploys, text guidelines for code reviews
6. **Pin platform configurations**: set effort level explicitly, disable adaptive thinking if needed
7. **Treat skills as folders**: include scripts for deterministic operations (cheaper in tokens than Claude generating code)
8. **Use `context: fork` for research/exploration** tasks that don't need conversation history
9. **Test with all target models**: what works for Opus may need more detail for Haiku
10. **Audit third-party skills** before installation -- check for network calls, code execution, and dependencies

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 8 | 8 | 7 | 8 | 7 | 7.6 |
| 2 | 8 | 8 | 8 | 9 | 8 | 8.2 |

## Meta: What the Loop Learned

- **Most valuable source this session:** Anthropic's official docs at code.claude.com -- the redirect from docs.anthropic.com to code.claude.com is recent and the content is the most comprehensive single source on skills, covering every frontmatter field, lifecycle detail, and advanced pattern.
- **Least valuable source this session:** Reddit (via last30days) -- surface-level discussion with no deep skill architecture insights. The scaling thread (583pts) discussed worktrees, not skills.
- **Surprising discovery:** The community-measured activation rate data (20% to 84%) is nowhere in official documentation. Anthropic's docs present activation as a description-quality problem, but the quantitative gap suggests even good descriptions only hit ~50% without hooks. This is the single most actionable insight for anyone building skills.
