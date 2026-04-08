# Research: Claude Code Custom Slash Commands and Skills Best Practices

**Date:** 2026-04-08
**Cycles:** 2
**Final Score:** 7.2/10
**Playbook Version:** 1.0

## Executive Summary

Claude Code skills are markdown-based instruction sets in `.claude/skills/<name>/SKILL.md` that give Claude reusable procedural knowledge. The most critical finding is that **description quality directly determines whether skills activate** — going from vague to specific descriptions improves activation from 20% to 90%. The second most impactful insight is that **self-verification steps** (telling Claude to check its own work) dramatically improve output quality more than any other single design choice. Skills use a three-tier progressive disclosure system where metadata costs ~30-50 tokens each, making large skill libraries cheap to maintain.

## Detailed Findings

### Skill Structure and File Format

Skills live in directories with a `SKILL.md` file:

```
.claude/skills/my-skill/
├── SKILL.md          # Required — frontmatter + instructions
├── references/       # Optional — detailed docs, patterns
├── examples/         # Optional — runnable examples
└── scripts/          # Optional — executable code (Python, Bash)
```

**Location options:**
- `~/.claude/skills/` — personal, all projects
- `.claude/skills/` — project-specific, version controlled

**SKILL.md frontmatter fields (all optional):**

```yaml
---
name: skill-name
description: "This skill should be used when the user asks to..."
version: 1.0.0
allowed-tools: Read, Bash(git:*)
model: sonnet
argument-hint: [search-term]
disable-model-invocation: true
---
```

**Dynamic content:**
- `$1`, `$2`, `$ARGUMENTS` — positional and full argument access
- `@path/to/file` — include file contents
- `` !`command here` `` — execute bash inline

### The Three Most Common Mistakes

**1. Skill Overload:** Every MCP server adds tool definitions consuming tokens on every request. 20 servers × 5-10 tools = thousands of tokens wasted. Rule: 5-8 tools max per project.

**2. Over-Specification:** Turning Claude into a template filler loses its ability to handle edge cases. Start with minimal instructions + empty gotchas section. Use the skill for a week, add gotchas only when Claude does something wrong.

**3. Broad Skills:** A "development helper" covering code style, testing, and deployment creates confusion. Each skill should be statable in one sentence. Single-purpose beats multi-purpose.

### Description Quality = Activation Rate

This is the single most impactful design decision. Claude "undertriggers" skills by default:

| Description Quality | Activation Rate |
|---|---|
| Vague ("Provides guidance") | ~20% |
| Specific triggers ("This skill should be used when...") | ~50% |
| Specific + examples | ~90% |

**Best practice:** Use third-person, list specific trigger phrases:
```yaml
description: "This skill should be used when the user asks to 'create a hook', 'add a PreToolUse hook', 'validate tool use', or mentions hook events."
```

### Progressive Disclosure (Token Efficiency)

Three-tier loading prevents context bloat:

1. **Metadata** (~30-50 tokens/skill) — always loaded, just name + description
2. **SKILL.md body** — loaded on trigger (<5k words, target 1,500-2,000)
3. **Bundled resources** — loaded on demand (unlimited)

30+ skills = only ~1,500 tokens in metadata. "Claude only loads what it needs, when it needs it."

### Writing Style

- **DO:** Imperative/infinitive form — "Review the code", "Run the tests"
- **DON'T:** Second person — "You should review the code"
- **Description:** Third person — "This skill should be used when..."
- **Body:** 1,500-2,000 words target, <5,000 max, move details to `references/`

### Self-Verification: The Highest-Leverage Design Choice

"Include tests, screenshots, or expected outputs so Claude can check itself. Claude performs dramatically better when it can verify its own work."

This is confirmed as more impactful than any other single skill design pattern. Always include explicit verification steps: "Run the tests", "Verify the migration succeeded", "Check the output matches the template."

### Skills vs. Slash Commands

| Aspect | Skills | Slash Commands |
|--------|--------|----------------|
| Location | `.claude/skills/<name>/SKILL.md` | `.claude/commands/<name>.md` |
| Invocation | Auto-triggered by description match | Manual `/command-name` |
| Best for | Auto-discoverable capabilities | Explicit user-triggered workflows |
| Discovery | Semantic matching at session start | Terminal autocomplete |

Both are now merged — files in either location create `/slash-commands`.

### Context Window Management

- **Context rot:** Model weights recent context more heavily; earlier instructions get "forgotten" in long sessions
- **Mitigation:** Use `/compact`, keep CLAUDE.md short (~1K), use skills for "context on demand"
- **CLAUDE.md signal-to-noise:** "For every line, ask whether Claude would make a mistake without it. Every unnecessary line dilutes the ones that matter."
- **Hidden changes:** Claude may modify code without surfacing it — add explicit verification/confirmation steps

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Official docs (Context7) | 1 | 5 snippets (frontmatter, structure) | high |
| GitHub repos | 3 | Skill-development SKILL.md, awesome-claude-skills, best practices | high |
| Web search | 3 | Tutorials, official docs page, pitfalls | medium |
| Blog/Dev.to | 2 | Specific patterns, subagent insights | medium |
| Substack | 1 | Progressive disclosure mechanics, token math | high |

## Contradictions & Open Questions

- **No major contradictions found.** All sources agree on core patterns.
- **Open:** How does skill composition work when multiple skills trigger simultaneously? No source covered multi-skill orchestration in depth.
- **Open:** What's the actual performance difference between `allowed-tools` restriction vs. unrestricted skills?
- **Open:** How does `disable-model-invocation` interact with description-based auto-triggering?

## Actionable Next Steps

1. **Fix our BunnLearn skill:** Restructure description to use third-person with specific trigger phrases for better activation rate
2. **Add verification steps:** Our skill should explicitly tell Claude to verify JSONL log entries and report scores before proceeding
3. **Consider references/ directory:** Move the rubric and calibration examples to `references/rubric.md` to keep SKILL.md leaner
4. **Add argument-hint:** Add `argument-hint: [topic] [--threshold N] [--max-cycles N]` for autocomplete
5. **Start gotchas section:** Add empty gotchas section, populate after real usage
6. **Review existing skills:** The 4 existing skills in `~/.claude/skills/` should be restructured into `<name>/SKILL.md` directories if not already

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 6 | 6 | 6 | 7 | 5 | 6.0 |
| 2 | 7 | 7 | 7 | 8 | 7 | 7.2 |

## Meta: What the Loop Learned

- **Most valuable source this session:** GitHub (Anthropic's own skill-development SKILL.md) — the authoritative source for structure, writing style, and validation checklist
- **Least valuable source this session:** Stack Overflow — not queried because web search already surfaced better community content from dedicated articles
- **Surprising discovery:** The activation rate data (20% → 90%) — quantified proof that description engineering is the #1 lever for skill effectiveness. Also, skills being model-agnostic was unexpected and suggests a portable standard emerging.

Sources:
- [Claude Code Official Docs](https://code.claude.com/docs/en/skills)
- [Anthropic skill-development SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/skill-development/SKILL.md)
- [awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
- [Dev.to: How to Build Skills That Work](https://dev.to/whoffagents/how-to-build-claude-code-skills-custom-slash-commands-that-actually-work-1nje)
- [alexop.dev Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Tyler Folkman: Skills Solve Context Window](https://tylerfolkman.substack.com/p/the-complete-guide-to-claude-skills)
- [MindStudio: 3 Common Mistakes](https://www.mindstudio.ai/blog/claude-code-skills-common-mistakes-guide)
- [Builder.io: Claude Code Tips](https://www.builder.io/blog/claude-code-tips-best-practices)
