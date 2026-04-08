# Research: Claude Code Skill Testing Evaluation Validation Techniques

**Date:** 2026-04-08
**Cycles:** 3
**Final Score:** 8.2/10
**Playbook Version:** 1.1

## Executive Summary

Testing Claude Code skills requires two distinct eval types: **quality evals** (does the skill produce good output?) and **trigger evals** (does Claude activate it correctly?). The most compelling data shows skills improve task completion from 9% to 82% — but only when properly tested and tuned. Critical pitfalls include the **contamination problem** (Claude reads eval files during testing, inflating results) and **skill staleness** (base model improvements can make skills actively harmful). The recommended quick start is 3 evals in 5 minutes (positive, negative, edge case), scaling to automated iteration loops with 40% holdout to prevent overfitting.

## Detailed Findings

### Two Eval Types (Both Required)

**1. Quality Evals — "Does it produce good output?"**

Use promptfoo with llm-rubric assertions:

```yaml
tests:
  - description: "Gives opinionated button design advice"
    vars:
      message: "How should I style my primary CTA button?"
    assert:
      - type: llm-rubric
        value: "Gives specific, opinionated CSS or design direction"
```

Test each promise the skill makes. Run: `npx promptfoo@latest eval`

**2. Trigger Evals — "Does it activate correctly?"**

Use JSON with should_trigger flags:

```json
[
  {"query": "Design a card component for a music app", "should_trigger": true, "note": "core use case"},
  {"query": "Help me write a Node.js REST API", "should_trigger": false, "note": "backend, no design intent"}
]
```

Minimum: 8+ positive, 5+ negative cases. Measures precision + recall on routing. Run: `python run_eval.py --eval-set agents/eval-set.json --skill-path ./skills/<name>`

### Quick Start: 3 Evals in 5 Minutes

1. **Positive case:** Skill should activate and perform well
2. **Negative case:** Skill should NOT activate
3. **Edge case:** Ambiguous — tests the boundary

Save as `evals/evals.json`. This is the minimum viable testing.

### Automated Iteration Loop

```bash
python run_loop.py \
  --eval-set agents/eval-set.json \
  --skill-path ./skills/frontend-design \
  --max-iterations 5 \
  --holdout 0.4
```

The `--holdout 0.4` reserves 40% of test data to prevent overfitting the description to memorized queries. Automatically rewrites description, re-tests, iterates.

### Six Key Metrics to Track

1. **Activation rate:** Was the skill invoked when relevant?
2. **Precision:** Was the skill NOT invoked when irrelevant?
3. **Task completion:** Did the agent accomplish the task? (Track steps, not just pass/fail)
4. **Efficiency:** How many turns to complete?
5. **Token usage:** Cost per invocation
6. **Elapsed time:** Speed per invocation

### A/B Testing with Confidence

Compare two skill versions or skill vs. baseline using blind judging:
- Confidence > 0.9 = robust result
- 0.8–0.9 = suggestive, validate with more examples
- < 0.8 = inconclusive

Multi-agent parallel execution: independent agents run evals in clean contexts with separate metrics.

### Critical Edge Cases

**The Contamination Problem:**
Claude accessed the filesystem during testing and found the evaluation rubric itself. Results were artificially inflated. **Fix:** Isolate eval files from the skill's working directory. Use Docker containers.

**Skill Staleness / Model Improvement:**
A skill running perfectly for 6 weeks was deleted because the base model improved — the skill was "actively making outputs worse by overriding behavior the model had already learned." **Fix:** Re-evaluate even successful skills after model updates.

**Docker Isolation:**
"Coding agents are sensitive to starting conditions." Without Docker, results vary based on filesystem state. Use containers for reproducible eval runs.

**Failure Rate Threshold:**
"Consistent failure rates above 2-3% warrant investigation before relying on the skill in production."

### Test Dataset Design

- **Diversity > volume** — 20 varied inputs beat 50 identical ones
- Include messy inputs: typos, missing info, unexpected formats
- Constrained tasks (bug fixes) work better than open-ended tasks for evals
- Track step-level completion: "helped separate 'total failure' from 'almost worked'"

### Validation vs. Judging (Use Both)

| Approach | Strength | Weakness |
|----------|----------|----------|
| Validation (scripts) | Deterministic, repeatable | Limited to coded checks |
| Judging (LLM-based) | Holistic, nuanced | Non-deterministic |

Use different LLM families for judging. Claude self-judging showed "no apparent bias."

### The Practical Trigger Test

Before running formal evals: "Ask Claude to do the thing your skill covers without using the slash command. If it doesn't load automatically, iterate on the description."

### Benchmark Mode (CI Integration)

Runs standardized assessment tracking eval pass rate, elapsed time, and token usage. Can plug into CI pipelines to catch regressions automatically before changes go live.

### The Killer Stat

LangChain testing showed: **"Claude Code with skills completed tasks 82% of the time, but performance dropped to 9% without skills."** This is the strongest data point for skill value — and why proper testing matters.

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Anthropic best practices (official) | 1 | Evaluation-driven dev, checklist, iteration | high |
| Anthropic blog (skill-creator) | 1 | Benchmark mode, A/B, multi-agent eval | high |
| mager.co blog | 1 | Two eval types, promptfoo + trigger JSON, automated loop | high |
| GitHub mcp-builder eval | 1 | XML format, question design, grading criteria | high |
| Dev.to (dbt eval) | 1 | Contamination problem, validation vs judging | high |
| Dev.to (skill-creator v2) | 1 | Iterative improvement, minimum eval counts | medium |
| LangChain blog | 1 | 5-step pipeline, 82% vs 9%, LangSmith | high |
| Neurometric Substack | 1 | Production sessions as test data | medium |
| Web search (failures) | 2 | Failure rates, regression testing, skill deletion | medium |

## Contradictions & Open Questions

- **No major contradictions.** All sources agree on dual eval types and iterative approach.
- **Open:** How to eval skills that produce creative/subjective output (like our research reports)? All examples test deterministic outcomes.
- **Open:** What's the right eval frequency for model updates? No source specifies a schedule.
- **Open:** Can the contamination problem occur during normal skill usage (not just testing)?

## Actionable Next Steps (for BunnLearn)

1. **Create 3 quick evals** for bunn-learn-research: positive (general research topic), negative (code implementation request), edge case (ambiguous "look into this")
2. **Build a trigger eval set** with 10+ queries testing activation precision
3. **Add the practical trigger test:** In a fresh conversation, say "research Expo SDK 54 best practices" without using `/bunn-learn-research` — does it auto-activate?
4. **Baseline without skill:** Run a research topic with ad-hoc prompting (no skill) and compare quality to skill-assisted research
5. **Track step completion:** Add cycle-level pass/fail tracking to research-log.jsonl (did all 9 steps execute? Which were skipped?)
6. **Re-evaluate after model updates:** When Claude updates, re-run evals to check for skill staleness
7. **Consider Docker isolation** for formal eval runs to prevent contamination

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 6 | 6 | 8 | 6 | 6.6 |
| 2 | 8 | 7 | 7 | 9 | 7 | 7.6 |
| 3 | 8 | 8 | 8 | 9 | 8 | 8.2 |

## Meta: What the Loop Learned

- **Most valuable source:** mager.co eval loop blog — provided the dual eval framework (quality + trigger) with exact formats and the automated iteration loop with holdout. This single source raised Actionability from 6 to 8.
- **Least valuable source:** Web search for failures — results were mostly generic AI testing articles, not skill-specific.
- **Surprising discovery:** The contamination problem — Claude reading its own eval rubric during testing — is a fundamental methodological issue that most skill testing guides don't mention. Also surprising: the 82% vs 9% stat from LangChain, proving skills aren't just nice-to-have but transformative.

Sources:
- [Anthropic Skill Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Anthropic: Improving Skill-Creator](https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills)
- [mager.co: Claude Code Eval Loop](https://www.mager.co/blog/2026-03-08-claude-code-eval-loop/)
- [GitHub: MCP Builder Evaluation Guide](https://github.com/anthropics/skills/blob/main/skills/mcp-builder/reference/evaluation.md)
- [Dev.to: Evaluating Claude's dbt Skills](https://dev.to/rmoff/evaluating-claudes-dbt-skills-building-an-eval-from-scratch-30a4)
- [LangChain: Evaluating Skills](https://blog.langchain.com/evaluating-skills/)
- [Neurometric: Coding Sessions as Testing Lab](https://neurometric.substack.com/p/neurometric-for-claude-skills-turn)
- [MindStudio: Skills 2.0 Evaluation](https://www.mindstudio.ai/blog/claude-code-skills-2-evaluation-ab-testing)
