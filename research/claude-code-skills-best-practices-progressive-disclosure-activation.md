# Research: Claude Code Skills SKILL.md Best Practices Progressive Disclosure Activation

**Date:** 2026-04-08
**Cycles:** 3
**Final Score:** 8.0/10
**Playbook Version:** 1.0

## Executive Summary

Claude Code skills have two distinct reliability problems: **activation failure** (Claude doesn't invoke the skill) and **execution failure** (Claude loads the skill but skips steps). Directive descriptions ("ALWAYS invoke this skill when...") achieve 100% activation in a 650-trial experiment — no hooks needed. Execution failure is solved by forcing visible output at every verification step. Progressive disclosure uses a 3-tier system (metadata ~50 tokens → SKILL.md body <500 lines → referenced files on-demand) that makes skill size effectively unbounded. Anthropic's own production skills (e.g., frontend-design) follow a philosophy-first pattern: decision framework before implementation, anti-patterns given as much space as patterns, emphatic language to push Claude past generic defaults.

## Detailed Findings

### Complete Frontmatter Field Reference

```yaml
---
name: my-skill              # max 64 chars, lowercase/numbers/hyphens, no "anthropic"/"claude"
description: ...             # max 1024 chars, third-person, "what + when to use"
argument-hint: [topic]       # autocomplete hint
disable-model-invocation: true  # only user can invoke
user-invocable: false        # hide from / menu (default: true)
allowed-tools: Read Grep     # tools allowed without permission
model: sonnet                # force specific model
effort: max                  # override session effort (low/medium/high/max)
context: fork                # run in isolated subagent context
agent: my-agent              # subagent type when context: fork
hooks: {}                    # skill lifecycle hooks
---
```

### The Two Reliability Problems

**Problem 1: Activation Failure**

Claude doesn't invoke the skill at all. Fix with directive descriptions:

| Description Style | Activation Rate | Source |
|---|---|---|
| Passive ("Use when creating Dockerfiles") | 77% | 650-trial experiment |
| Directive ("ALWAYS invoke when user asks about Docker") | 100% | 650-trial experiment |
| Optimized + examples in description | 90% | Community testing |
| Hook-based keyword detection | 95%+ | Dev.to article |

**Best description template:**
```yaml
description: "ALWAYS invoke this skill when the user asks to [trigger 1], [trigger 2], or [trigger 3]. Do not [alternative action] directly. Use this skill first."
```

**Problem 2: Execution Failure**

Claude loads the skill but silently skips critical steps — especially verification stages that produce no visible output.

**Fix:** Force every critical step to produce visible output:
```markdown
# Bad — invisible verification (will be skipped)
"Verify that every milestone aligns with scope."

# Good — forced visible output (cannot be skipped undetected)  
"Do not deliver the final output until you have output a verification block
listing each milestone and the in-scope deliverable it maps to."
```

### Progressive Disclosure: The 3-Tier System

**Tier 1 — Metadata (~50-100 tokens per skill, always loaded):**
- Name + description from YAML frontmatter
- Loaded at session start for ALL skills
- 30+ skills = only ~1,500 tokens total
- This is where activation decisions happen

**Tier 2 — SKILL.md body (loaded on trigger, <500 lines):**
- Full instructions, quick-start examples, navigation to references
- Keep under 500 lines for optimal performance
- Only what Claude needs for the core workflow

**Tier 3 — Referenced files (loaded on-demand, unlimited):**
- Detailed guides, API references, examples, domain-specific docs
- Referenced via markdown links: `See [FORMS.md](FORMS.md)`
- Must be ONE level deep (SKILL.md → file.md, never file.md → deeper.md)
- Claude may use `head -100` on deeply nested files, getting incomplete info
- For files >100 lines: add table of contents at top

**Token budget reality:**
- System prompt: ~50 tokens
- CLAUDE.md optimal: 150-200 tokens max
- Skill metadata: 50-100 tokens each
- Once SKILL.md loads, every token competes with conversation history

### SKILL.md Writing Best Practices

**Naming:** Gerund form preferred (processing-pdfs, testing-code, analyzing-data)

**Writing style:** 
- Imperative form: "Review the code", "Run the tests"
- Third person in description: "This skill processes..."
- NEVER second person: "You should..."

**Structure pattern (from Anthropic's own frontend-design skill):**
1. Brief intro restating purpose
2. Decision framework BEFORE implementation ("Design Thinking")
3. Guidelines — what TO do
4. Anti-patterns — what NOT to do (give as much space as patterns)
5. Emphatic language: CRITICAL, NEVER, IMPORTANT, BOLD

**Degrees of freedom:**
- High: text instructions for context-dependent tasks (code review)
- Medium: pseudocode with parameters (report generation)
- Low: exact scripts for fragile operations (database migrations)

**Default assumption:** Claude is already very smart. Only add context Claude doesn't already have. For every line, ask: "Does Claude really need this?"

### Activation Hook Options (When Descriptions Aren't Enough)

**Hook 1: Keyword Detection**
- UserPromptSubmit hook matches prompt keywords against skill-rules.json
- Injects "RECOMMENDED SKILLS" before Claude responds
- User confirms → skill activates

**Hook 2: Forced Evaluation**
- Forces 3-step sequence: evaluate all skills → activate matches → implement
- "CRITICAL: You MUST call Skill() tool in Step 2. Do NOT skip to implementation."
- Nuclear option — guaranteed but adds overhead

### context:fork — Isolated Skill Execution

- `context: fork` runs skill in isolated sub-agent with separate conversation history
- Prevents skill execution from cluttering main thread
- Less overhead than full subagent spawning
- Best for: multi-step privileged workflows
- NOT for: sequential tasks where each step needs prior step's output

### Multi-Skill Orchestration

- Skills = ultra-simple agent framework + orchestration layer
- Writer/Reviewer: separate worktrees, one implements, one reviews
- 3 Amigos: PM + UX + implementation agents
- Sub-agents → teams: transition when parallel agents hit context limits
- Skills only consume context when relevant (unlike rules = always-on)

### Evaluation-Driven Development

1. Run Claude on tasks WITHOUT a skill — document failures
2. Build 3 evaluation scenarios testing those failures
3. Establish baseline performance
4. Write MINIMAL instructions to address gaps
5. Test with Claude A (refiner) and Claude B (fresh tester)
6. Iterate based on Claude B's real behavior, not assumptions

### Official Quality Checklist (18 Items)

**Core:**
- [ ] Description specific, includes key terms
- [ ] Description includes what + when to use
- [ ] SKILL.md body under 500 lines
- [ ] Additional details in separate files
- [ ] No time-sensitive information
- [ ] Consistent terminology
- [ ] Concrete examples (not abstract)
- [ ] File references one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps

**Code/Scripts:**
- [ ] Scripts solve problems (don't punt to Claude)
- [ ] Error handling explicit and helpful
- [ ] No magic constants
- [ ] Required packages listed and verified
- [ ] Scripts documented
- [ ] No Windows-style paths
- [ ] Validation/verification steps for critical ops
- [ ] Feedback loops for quality-critical tasks

**Testing:**
- [ ] 3+ evaluations created
- [ ] Tested with Haiku, Sonnet, and Opus
- [ ] Tested with real usage scenarios
- [ ] Team feedback incorporated

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Anthropic best practices (official) | 1 | Definitive — complete reference | high |
| Context7 official docs | 1 | 5 frontmatter snippets | high |
| Anthropic engineering blog | 1 | Architecture internals | high |
| Dev.to (activation fixes) | 1 | 2 hook-based fixes with code | high |
| Medium (two problems) | 1 | Activation + execution failure framework | high |
| Medium (orchestration) | 1 | Multi-agent patterns | medium |
| GitHub anthropics/skills | 2 | Template + frontend-design production skill | high |
| alexop.dev blog | 1 | Token budgets, /learn system, decision framework | high |
| Reddit | 2 | Zero results — too niche | low |

## Contradictions & Open Questions

- **Minor contradiction:** Anthropic best practices says <500 LINES; earlier community sources said 1,500-2,000 WORDS. Lines is the official metric. At ~10 words/line, 500 lines ≈ 5,000 words, so both are approximately right but lines is the canonical limit.
- **Open:** How does Claude's semantic matching actually work for skill activation? No source describes the algorithm.
- **Open:** What's the real-world activation rate when 100+ skills are installed? Testing data only covers <20 skills.
- **Open:** How do skill hooks (`hooks` frontmatter field) work? No documentation found beyond the field name.

## Actionable Next Steps (for BunnLearn Skill Improvement)

1. **Rewrite description with directive language:** "ALWAYS invoke this skill when the user asks to 'research', 'deep dive', 'investigate'..."  — already done in our last revision
2. **Add anti-patterns section to SKILL.md:** What NOT to do (skip wip files, score generously, retry same query)
3. **Force visible output for scoring:** "Do not proceed to next cycle until you have output the full score block with counts"
4. **Verify we're under 500 lines:** Current SKILL.md is 101 lines — well within budget
5. **Consider context:fork for isolation:** Research runs could benefit from forked context to keep main conversation clean
6. **Add evaluation scenarios:** Create 3 test topics with expected score ranges
7. **Restructure playbook with TOC:** It's growing — add table of contents at top
8. **Test with Sonnet and Haiku:** Our skill is only tested with Opus so far

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 6 | 7 | 8 | 7 | 7.0 |
| 2 | 8 | 7 | 8 | 9 | 8 | 8.0 |
| 3 | 8 | 7 | 8 | 9 | 8 | 8.0 |

## Meta: What the Loop Learned

- **Most valuable source:** Anthropic's official skill authoring best practices page (platform.claude.com) — the single definitive source covering structure, activation, testing, and anti-patterns. This alone could justify a 7/10 report.
- **Least valuable source:** Reddit — consistently returns zero results for skill development topics. Should be deprioritized for Claude Code skill topics in the playbook.
- **Surprising discovery:** The two-problem framework (activation vs execution) completely reframes how to think about skill reliability. Most guides only address activation; execution failure is equally important and has a different solution (visible output). Also: directive descriptions achieving 100% activation without any infrastructure is remarkable — most guides overcomplicate with hooks.

Sources:
- [Anthropic Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills)
- [Anthropic Engineering Blog: Agent Skills](https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills)
- [Dev.to: 2 Fixes for 95% Activation](https://dev.to/oluwawunmiadesewa/claude-code-skills-not-triggering-2-fixes-for-100-activation-3b57)
- [Medium: Two Reliability Problems](https://medium.com/@marc.bara.iniesta/claude-skills-have-two-reliability-problems-not-one-299401842ca8)
- [alexop.dev: Stop Bloating CLAUDE.md](https://alexop.dev/posts/stop-bloating-your-claude-md-progressive-disclosure-ai-coding-tools/)
- [GitHub: anthropics/skills](https://github.com/anthropics/skills)
- [GitHub: frontend-design SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
