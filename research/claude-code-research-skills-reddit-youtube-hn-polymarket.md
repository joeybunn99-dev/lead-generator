# Research: Claude Code Skills & Plugins for Multi-Platform Research (Reddit, X, YouTube, HN, Polymarket, Web Synthesis)

**Date:** 2026-04-07
**Cycles:** 3
**Final Score:** 8.6/10
**Playbook Version:** 1.2

## Executive Summary

The Claude Code ecosystem has rapidly matured a research-agent layer in March-April 2026. The standout tool is **last30days-skill** (19.7K GitHub stars), which searches Reddit, X, YouTube, TikTok, HN, Polymarket, and 6+ other platforms simultaneously, scores results by engagement, and synthesizes grounded summaries with citations. Two complementary tools fill gaps: **opencli-skill** (16 platforms via browser session reuse, zero API keys) and **polymarket-skills** (6 composable trading skills with paper-trading-first security). Anthropic's own multi-agent research architecture achieves 90.2% improvement over single-agent approaches. The plugin marketplace infrastructure is production-ready with version pinning, enterprise policies, and cross-agent SKILL.md compatibility across 5 editors.

## Detailed Findings

### The last30days Skill — The Primary Research Tool

**What it is:** An AI agent skill that researches any topic across 12+ platforms from the last 30 days, then synthesizes a grounded summary ranked by real engagement metrics rather than SEO algorithms.

**Supported platforms (free vs. paid):**

| Platform | Requirements | Cost |
|----------|-------------|------|
| Reddit (with comments) | None | Free |
| Hacker News | None (Algolia API) | Free |
| Polymarket | None (Gamma API) | Free |
| GitHub | None | Free |
| X/Twitter | Browser cookies (AUTH_TOKEN/CT0) | Free |
| YouTube | yt-dlp installed | Free |
| Bluesky | App password | Free |
| TikTok, Instagram, Threads, Pinterest | ScrapeCreators API key | 10K calls free |
| Perplexity Sonar | OpenRouter key | Pay-per-use |
| Web search | Brave Search key | 2K queries/month free |

**v3 Engine Architecture (the non-obvious parts):**

1. **Pre-research entity resolution** — Before any search runs, the engine resolves relevant accounts, subreddits, hashtags, GitHub repos, YouTube channels, TikTok creators, and Instagram creators. Typing "OpenClaw" automatically finds @steipete, r/openclaw, and related communities. This is Steps 0.5-0.55 in the SKILL.md.

2. **Handle resolution pipeline:**
   - X/Twitter: primary handle + related/company handles + 1-2 commentator accounts, verifying verified profiles
   - GitHub user mode: resolves username, switches to author-scoped queries showing PR velocity and ship rate
   - GitHub repo mode: resolves owner/repo for product-mode search

3. **Source weighting in synthesis:**
   - X replies: 0.8 (direct commentary, highest signal)
   - Reddit top comments: 0.7 (community-curated)
   - YouTube/TikTok: 0.6 (trends/broad sentiment)
   - WebSearch: 0.5 (supplementary, often older)

4. **Scoring system:** Text relevance 35%, engagement velocity 25%, source authority 20%, cross-platform convergence bonus 10%, recency decay at 0.98/day for 10%. Accuracy improved from 3.73/5.0 to 4.38/5.0 (~17%) in v2.5.

5. **Entry modes:**
   - `/last30days {topic}` — standard interactive (2-8 minutes)
   - `/last30days --quick` — fewer sources, faster
   - `/last30days --deep-research` — exhaustive 50+ citation reports
   - `/last30days --agent` — fully automated, no user interaction, auto-save

**Installation:**
```bash
# Claude Code plugin marketplace
/plugin marketplace add mvanhorn/last30days-skill
/plugin install last30days@last30days-skill

# Manual
git clone https://github.com/mvanhorn/last30days-skill.git ~/.claude/skills/last30days
```

**Configuration:** `~/.config/last30days/.env`
```bash
SCRAPECREATORS_API_KEY=sc_xxxxxxxxxxxxxxxxxxxx
# Optional
AUTH_TOKEN=xxx  # X cookies
CT0=xxx
BSKY_HANDLE=xxx
BSKY_APP_PASSWORD=xxx
```

**Gotchas:**
- X cookie credentials expire, requiring periodic renewal
- ScrapeCreators key format errors cause "few Reddit posts" despite active discussions
- Polymarket coverage depends on keyword matching; some topics lack active markets
- HN returns limited results for non-tech subjects
- Full searches take 2-8 minutes; niche topics may exceed 10 minutes

### opencli-skill — Browser Session Reuse (Zero API Keys)

**What it is:** Wraps the opencli CLI tool to control 16 platforms using existing Chrome login sessions — no API keys required.

**Key innovation:** Reuses your Chrome browser sessions via a Playwright MCP bridge. Log in once in Chrome; Claude reuses that session.

**Platforms:** Bilibili, Zhihu, Weibo, X/Twitter, YouTube, Xiaohongshu, Reddit, HackerNews, V2EX, Xueqiu, BOSS, BBC, Reuters, Yahoo Finance, Ctrip, and more.

**55+ commands** covering read, search, and write operations. Write operations require user confirmation.

**Install:** `npx skills add joeseesun/opencli-skill`

**Risks:** Platform bot-detection may trigger CAPTCHAs; published content cannot be recalled; rapid repeated operations discouraged.

### polymarket-skills — Prediction Market Trading

**What it is:** 6 composable skills for Polymarket prediction market trading with paper-trading-first security.

**Skills:** scanner (browse markets), analyzer (edge detection), monitor (alerts), paper-trader (simulated), strategy-advisor (recommendations), live-executor (real trades with human approval).

**Security model:** 4 layers — paper-trading-first validation, `POLYMARKET_CONFIRM=true` gating, human-in-the-loop for every trade, hard position caps. 14 security audit findings resolved.

**Graduation system (non-obvious):** Must complete 20+ paper trades, >55% win rate, Sharpe >0.5, <15% drawdown before live trading unlocks. Capital tiers from $25 to $2,000+.

**Install:** `npx skills add mjunaidca/polymarket-skills`

### Hacker News MCP Servers (5+ options)

| Server | Features | API Keys |
|--------|----------|----------|
| hn-mcp (karanb192) | Browse, search, comments, user analysis | None |
| devfeed-mcp (UpGPT-ai) | Personalized reader, reply notifications, Who is Hiring | None |
| hn-pulse (AnkamAndy) | Research agent, arcade-mcp | None |
| mcp-hacker-news (paabloLC) | Official HN API bridge | None |
| mcp-claude-hackernews (imprvhub) | 5 specialized tools | None |

### Reddit MCP Server

**reddit-mcp-buddy** (karanb192): Browse posts, search content, analyze users. No API keys required. LLM-optimized output.

### Skills vs MCP: Token Economics (Critical Insight)

MCP servers load ALL tool definitions upfront before any conversation starts. A typical multi-server setup consumes **50K+ tokens before you ask anything**. Skills use progressive disclosure: only names and descriptions load at startup (~30-50 tokens each), full instructions load on activation, reference files load on-demand.

**Practical impact:** You can have dozens of skills with minimal overhead. A SKILL.md with comprehensive API-calling instructions functions as an equivalent to an MCP API wrapper, but with dramatically lower context cost.

**Mental model:** Skills = the manual (domain knowledge + workflow). MCP = the hands (tool execution). Use MCP when you need persistent connections or real-time data streams. Use skills for procedural knowledge and research workflows.

### Anthropic's Multi-Agent Research Architecture

Anthropic's own Research feature uses an orchestrator-worker pattern:

1. **LeadResearcher** analyzes query, develops research strategy, saves plan to Memory
2. Spawns **3-5 specialized Subagents** simultaneously
3. Each subagent executes **3+ tools in parallel**
4. **CitationAgent** processes documents for attribution
5. Lead synthesizes findings, determines if more research needed

**Performance data:**
- 90.2% improvement over single-agent Claude Opus 4 on breadth-first research
- 15x more tokens than standard chat interactions
- Token usage explains 80% of performance variance (BrowseComp evaluation)
- Up to 90% time reduction through parallel tool execution
- Tool description quality improvements = 40% task completion improvement

**Design insight:** Early systems favored SEO-optimized content farms over authoritative sources. Fixed by adding source quality heuristics to prompts.

### Claude Code Ecosystem Status (March-April 2026)

**Scale:** 340 plugins + 1,367 agent skills in the largest marketplace. awesome-claude-plugins tracks 10,913 repositories.

**Key recent features (from changelog):**
- Skills hot-reload (no restart needed)
- `disableSkillShellExecution` setting for security
- Plugins can ship executables under `bin/`
- MCP result persistence up to 500K characters
- `effort` frontmatter for skills (low/medium/high)
- `${CLAUDE_SKILL_DIR}` variable for self-referencing
- `${CLAUDE_PLUGIN_DATA}` for persistent state
- MCP elicitation: servers can request structured input mid-task
- Conditional `if` field for hooks
- `/loop` and cron scheduling for recurring research

**Cross-agent compatibility:** The same SKILL.md file works across Claude Code, Cursor, Gemini CLI, Codex CLI, and Antigravity IDE.

### Competitive Landscape: Deep Research Tools

| Tool | Speed | Accuracy | Strength |
|------|-------|----------|----------|
| Perplexity Sonar | <3 min | 34% (highest measured) | Cited factual research |
| Grok Deep Search | 10x faster than ChatGPT | Not published | Real-time X/social intelligence |
| ChatGPT Deep Research | Up to 30 min | Not published | Long-form synthesis |
| Claude Research (multi-agent) | Varies | 90.2% improvement vs single-agent | Breadth-first parallel research |
| last30days skill | 2-8 min | 4.38/5.0 scoring accuracy | Social platform engagement data |

**No single tool dominates all research tasks.** Claude + last30days excels at engagement-weighted social synthesis. Perplexity excels at sourced factual claims. Grok excels at real-time X intelligence.

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| GitHub repos (READMEs, SKILL.md) | 6 | 6 | high |
| Anthropic official docs | 3 | 3 | high |
| Anthropic engineering blog | 1 | 1 | high |
| Anthropic changelog | 1 | 1 | high |
| Web search (general) | 6 | 4 | medium |
| Dev.to / Substack | 2 | 1 | medium |
| HN discussion | 2 | 1 | medium |
| Blog reviews | 2 | 1 | low |
| YouTube search | 1 | 0 | none |

## Contradictions & Open Questions

- **No contradictions found** — sources were consistent across all major claims.
- **Open question:** How does last30days scoring accuracy (4.38/5.0) compare to Perplexity's 34% on the same benchmarks? Different metrics make direct comparison impossible.
- **Open question:** What is the actual token cost per last30days research run? No data published.
- **Open question:** Does opencli's browser session approach trigger rate limiting at scale? Only anecdotal CAPTCHA warnings, no hard data.
- **Ecosystem maturity concern:** HN discussion revealed top curated skill directories are dominated by meta-collections (skills about finding skills) rather than practical tools. Signal-to-noise ratio in skill marketplaces may be worse than it appears.

## Actionable Next Steps

1. **Install last30days** for immediate multi-platform research:
   ```bash
   /plugin marketplace add mvanhorn/last30days-skill
   /plugin install last30days@last30days-skill
   ```
   Then configure `~/.config/last30days/.env` with at minimum `SCRAPECREATORS_API_KEY`.

2. **Use --agent mode** for automated research in CI/CD or scheduled tasks:
   ```bash
   /last30days "topic here" --agent
   ```
   Outputs complete report with no user interaction, auto-saves to ~/Documents/Last30Days/.

3. **Install opencli-skill** for zero-API-key platform access via Chrome sessions — especially useful for platforms where you already have accounts.

4. **Install polymarket-skills** if prediction market data is relevant to your research, starting with the scanner and analyzer (zero-risk, read-only).

5. **Set up an HN MCP server** (recommend hn-mcp or devfeed-mcp) for persistent Hacker News access without last30days overhead.

6. **Build custom research subagents** using Claude Code's subagent architecture for domain-specific research workflows. Use `~/.claude/agents/` for user-level, `.claude/agents/` for project-level.

7. **Use effort frontmatter** in research skills to control reasoning depth: `effort: high` for thorough research, `effort: low` for quick lookups.

8. **Monitor the changelog** at code.claude.com/docs/en/changelog — the platform ships skill/plugin improvements 2-3x per week.

9. **Prefer skills over MCP for research workflows** to avoid the 50K+ token upfront cost of MCP server tool definitions.

10. **Customize source weights** if needed: fork last30days and modify `scripts/lib/score.py` to adjust platform authority rankings for your domain.

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 6 | 6 | 7 | 7 | 6.6 |
| 2 | 8 | 8 | 8 | 8 | 8 | 8.0 |
| 3 | 9 | 8 | 8 | 9 | 9 | 8.6 |

## Meta: What the Loop Learned

- **Most valuable source this session:** GitHub repos (last30days SKILL.md and README). The actual skill definition file contained architecture details not available anywhere else — the 5-step handle resolution pipeline, source weighting formula, and --deep-research mode were only documented in the SKILL.md itself.
- **Least valuable source this session:** YouTube search. No relevant video content found for this topic despite multiple query variations.
- **Surprising discovery:** The skill ecosystem's noise-to-signal problem. HN discussion revealed that curated skill directories (60K filtered to 1K) are still dominated by meta-collections — skills about finding skills — rather than practical implementations. This suggests the "1,367 skills" marketplace number overstates practical utility significantly.
