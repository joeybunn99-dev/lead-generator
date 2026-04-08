# Research: Modern Node.js Project Setup & Organization Best Practices 2026

**Date:** 2026-04-07
**Cycles:** 3
**Final Score:** 8.6/10
**Playbook Version:** 1.2

## Executive Summary

Modern Node.js full-stack project setup in 2026 converges on a clear stack: **pnpm workspaces + Turborepo + TypeScript** for monorepos, **trunk-based development** for git workflow, and **hierarchical CLAUDE.md** for AI-assisted development. The monorepo approach dominates for teams of 1-50 engineers building tightly coupled full-stack applications. Key non-obvious findings include: a 30-line CLAUDE.md outperforms a 200-line one, pnpm's "catalog" protocol eliminates merge conflicts in package.json files, the "virtual monorepo" pattern gives AI assistants cross-repo context without actual migration, and Turborepo remote caching delivers 50% task reduction but only on well-modularized repos. DORA research confirms elite teams are 2.3x more likely to use trunk-based development.

## Detailed Findings

### 1. Monorepo vs Polyrepo Decision

**Choose monorepo when:**
- Solo developer or small team (1-50 engineers)
- Tightly coupled packages sharing TypeScript types and dependencies
- Need atomic cross-cutting changes in a single PR
- Full-stack Node.js with shared types between frontend and backend
- Synchronized release cycles requiring compatible versions

**Choose polyrepo when:**
- Autonomous teams owning separate, loosely coupled services
- Services communicate via well-defined APIs only
- Strict per-repo access control requirements
- 100+ developers on truly independent services

**Hybrid approach (most common in practice):** Monorepo for tightly coupled frontend + shared libraries; separate repos for infrastructure, data pipelines, and mobile apps with different toolchains.

**Team size sweet spot for monorepo:** 5-50 engineers. Below 5, the tooling overhead may not pay off. Above 50, access control and CI complexity increase significantly.

### 2. Recommended Monorepo Structure

```
my-project/
├── package.json              # workspace root, "private": true
├── pnpm-workspace.yaml       # workspace + catalog definitions
├── pnpm-lock.yaml            # single lockfile
├── tsconfig.base.json        # shared compiler options (no include)
├── turbo.json                # task pipeline definitions
├── CLAUDE.md                 # AI assistant context (< 60 lines)
├── .claude/
│   └── skills/               # project-specific AI skills
├── apps/
│   ├── api/                  # Express/Fastify backend
│   │   ├── CLAUDE.md         # API-specific rules
│   │   └── package.json
│   ├── web/                  # frontend (Next.js/React)
│   │   └── CLAUDE.md         # frontend-specific rules
│   ├── worker/               # background job processor
│   └── admin/                # internal dashboard
├── packages/
│   ├── types/                # shared TypeScript types
│   ├── utils/                # utility functions
│   ├── db/                   # database client + models (Prisma/Drizzle)
│   └── config/               # config validation (Zod schemas)
└── tooling/
    ├── eslint/               # shared ESLint config
    └── tsconfig/             # shared tsconfig presets
```

**Architectural rule:** `apps/` depends on `packages/`, `packages/` depends on other `packages/`, nothing flows backward. Apps never import from other apps.

### 3. Package Manager: pnpm (2026 Standard)

**Why pnpm over npm:**
- **70% less disk space** via content-addressable store + hard links
- **73% faster CI installs** (Vercel: 45s with Yarn Classic to 12s with pnpm)
- **Strict dependency resolution** eliminates phantom dependencies (Vercel fixed 23 intermittent build failures by switching)
- `--filter` flag runs commands only on changed packages and dependents
- `workspace:` protocol for local package linking

**When to stay on npm:** Existing project with no specific pain point. Migration cost isn't always justified, and pnpm's symlinking breaks some legacy packages.

**pnpm Catalogs (advanced, most developers don't know this):**
```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"

catalog:
  react: ^18.3.1
  typescript: ^5.7.0
  zod: ^3.23.0
```

Then in any package.json: `"react": "catalog:"`. Dependency upgrades require editing one line instead of many. Named catalogs support gradual migrations: `catalog:react17` vs `catalog:react18`.

**Corepack (Node.js 22+):** Add `"packageManager": "pnpm@9.x.x"` to root package.json. Corepack auto-downloads the correct version, eliminating "works on my machine" version mismatches.

### 4. Build Orchestration: Turborepo

**Why Turborepo is the 2026 default:**
- 2M weekly downloads, Vercel-backed, migrating core to Rust
- Zero-config task orchestration with dependency graph awareness
- Setup in an afternoon: add `turbo.json`, define pipeline

**Remote caching results (Mercari engineering data):**
- 50% reduction in Turbo task duration on well-modularized repos
- 30% reduction in total CI job duration
- Cache server startup: ~10 seconds (can negate gains for short tasks)
- Cross-region data transfer: $0.08/GiB

**Critical caveat:** "Effective modularization remains crucial for optimal speed improvements." Poorly modularized repos see minimal or no gains from remote caching.

**When to use Nx instead:** Enterprise teams wanting code generators, framework-specific plugins (Angular, NestJS), and opinionated project structure. 5M weekly downloads.

### 5. TypeScript Configuration

**Inheritance pattern:**
```json
// tsconfig.base.json (root — compilerOptions only, no include)
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

Each package extends with own `rootDir`/`outDir`. Use `module: NodeNext` for explicit file extensions — prevents runtime resolution errors.

**Source-linked internal packages (no build step in dev):**
```json
{
  "name": "@myproject/utils",
  "private": true,
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" }
  }
}
```

Apps reference with `"*"` version: `"@myproject/utils": "*"` (pnpm resolves locally).

### 6. CLAUDE.md Structure

**The 30-Line Rule:** A focused 30-line CLAUDE.md outperforms a comprehensive 200-line one. Fewer instructions = more attention weight per instruction. LLMs can follow ~150-200 instructions consistently; Claude's system prompt uses ~50, leaving only 100-150 slots.

**What to include:**
- Build/test/deploy commands Claude can't guess
- Code style rules that differ from defaults
- Testing instructions and preferred runners
- Branch naming and PR conventions
- Architectural decisions specific to project
- Common gotchas or non-obvious behaviors

**What to exclude:**
- Anything Claude figures out from reading code
- Standard language conventions Claude already knows
- Detailed API docs (link instead)
- Code style formatting (use linters + hooks instead)
- File-by-file codebase descriptions

**5 Compliance Patterns (data-backed):**

1. **Positive > Negative framing:** "Use named exports exclusively" beats "Do NOT use default exports." Flipping 10 negative rules to positive cut violations by ~50%.

2. **Primacy + Recency exploitation:** Duplicate 3 most critical rules at top AND bottom of CLAUDE.md. Models have both primacy and recency bias.

3. **3-strikes-to-hook rule:** If Claude violates a rule 3+ times, move it from CLAUDE.md to an executable hook. Hooks = 100% compliance vs CLAUDE.md's ~70%.

4. **Progressive disclosure:** Use `agent_docs/` folder or `@path/to/import` syntax. Claude loads referenced files only when needed.

5. **Subdirectory scoping:** Package-specific CLAUDE.md files in monorepo subdirectories. Auto-discovered when Claude works in that directory.

**Monorepo CLAUDE.md hierarchy:**
```
~/.claude/CLAUDE.md          # global (all projects)
./CLAUDE.md                   # project root (shared via git, < 60 lines)
./CLAUDE.local.md             # personal (gitignored)
./apps/api/CLAUDE.md          # API-specific rules
./packages/db/CLAUDE.md       # database package rules
```

### 7. Git Workflow: Trunk-Based Development

**DORA research data:**
- Elite performers are **2.3x more likely** to use trunk-based development
- Top performers deploy **~1000x more frequently** than bottom performers
- Best practice: <= 3 active branches, merge at least once daily, no code freezes

**Implementation:**
- Everyone commits to `main` frequently (at least daily)
- Short-lived feature branches lasting hours to days, not weeks
- Feature flags to ship incomplete features safely
- `main` is always deployable

**Conventional Commits:**
```
<type>[optional scope]: <description>

[optional body — explains WHY, not WHAT]
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`
- 50/72 rule: subject < 50 chars, body wrap at 72
- Enables automated versioning with `semantic-release`

**PR practices:**
- Keep PRs < 400 lines (reviewers stop reading carefully beyond that)
- Use PR templates (`.github/pull_request_template.md`)
- Link issues: "Fixes #234"
- Open draft PRs early for complex changes
- Use review prefixes: `[BLOCKING]`, `[NIT]`, `[Q]`

**Git hooks (enforced via husky):**
- `pre-commit`: lint + secrets check
- `commit-msg`: validate conventional commits (commitlint)
- `pre-push`: full test suite

**Feature flag pitfalls:**
- Each flag doubles code paths to test — testing matrix explodes
- Flags create technical debt if not removed. **A feature is NOT finished when released; it's finished when the flag is removed.**
- Budget for a flag lifecycle management service (LaunchDarkly, Unleash, DevCycle)

### 8. The Virtual Monorepo Pattern (for Polyrepo Shops)

For teams that can't or won't migrate to a real monorepo, this pattern gives AI assistants cross-service context:

1. Create a workspace directory with a `.repos` script (organized git clones by domain)
2. Write a `CLAUDE.md` documenting service relationships using `@path/to/service` notation
3. Draft a `README.md` with architecture decisions and data flow narratives

**Key insight:** "Context beats structure for AI effectiveness." This encodes "knowledge that usually lives in heads of senior engineers" — preventing knowledge loss during transitions.

**Tradeoffs:** Disk space for cloned repos, maintenance friction when repos are added/renamed, context noise for very large systems. But zero migration overhead and existing CI/CD stays untouched.

### 9. Common Pitfalls to Avoid

1. **Phantom dependencies:** npm hoists dependencies, making undeclared packages importable. Use pnpm's strict mode or `eslint-plugin-import` with `no-extraneous-dependencies`.
2. **Relative imports across packages:** Always use package names (`@myproject/utils`), never relative paths (`../../packages/utils`).
3. **Missing `"private": true`:** On internal packages and workspace root. Prevents accidental npm publish.
4. **Running `npm install` inside workspaces:** Creates nested `node_modules` shadowing workspace-hoisted dependencies. Always install at root.
5. **Config fragmentation:** Each package needs its own tsconfig, ESLint, Jest configs. Extract shared configs into `tooling/` packages.
6. **Scope uncertainty:** "It's hard to clearly figure out the final scope of each package in the beginning. Just start with your best try." Extract shared `common-utils` first, then split further.
7. **Over-specified CLAUDE.md:** Bloated files cause Claude to ignore important rules. If Claude does something correctly without the instruction, delete it.
8. **Rebuilding everything in CI:** Use affected-package detection. Any shared package change triggers all app tests, but app changes only trigger that app's tests.

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Anthropic official docs | 1 | 5 | high |
| Engineering blogs (Mercari, ranthebuilder) | 3 | 6 | high |
| Dev.to articles | 4 | 7 | high |
| Blog articles (HumanLayer, Dometrain, stackdevlife) | 3 | 8 | high |
| pnpm official docs | 1 | 3 | high |
| GitHub repos/templates | 2 | 3 | medium |
| Web search (general) | 6 | 5 | medium |
| Medium articles | 3 | 4 | medium |
| DORA research | 1 | 2 | medium |
| Reddit | 1 | 0 | low |

## Contradictions & Open Questions

**Contradictions:**
- npm vs pnpm: Not a true contradiction — pnpm is technically superior, but npm is "good enough" for existing projects. Migration cost must be weighed against benefits.
- CLAUDE.md size: Anthropic says < 300 lines, HumanLayer says < 60 lines, Dev.to author says ~30 lines. All agree shorter is better; the ideal depends on project complexity.

**Open Questions:**
- How do pnpm catalogs interact with Dependabot/Renovate for automated dependency updates?
- What's the optimal Turborepo remote cache self-hosted setup for small teams (cost vs benefit)?
- How does the virtual monorepo pattern scale beyond 35 repos?
- What specific CLAUDE.md patterns work best for Node.js API projects vs frontend projects?

## Actionable Next Steps

1. **For new full-stack Node.js projects:** Use pnpm workspaces + Turborepo + TypeScript. Start with the `apps/` + `packages/` + `tooling/` structure.
2. **For existing single-repo projects:** Extract shared code into `packages/` first, add Turborepo, then split apps.
3. **For CLAUDE.md:** Start with < 60 lines. Use positive framing, duplicate critical rules at top/bottom, move violated rules to hooks after 3 strikes.
4. **For git workflow:** Adopt trunk-based development with conventional commits. Install husky + commitlint + lint-staged.
5. **For polyrepo teams wanting AI context:** Implement the virtual monorepo pattern with a `.repos` script and system-map CLAUDE.md.
6. **For CI optimization:** Add Turborepo remote caching. Self-host if cross-region costs are prohibitive.
7. **For dependency management:** Use pnpm catalogs to centralize versions. Add Corepack `packageManager` field.
8. **For monorepo CLAUDE.md:** Create hierarchy — root file with `@imports`, subdirectory files per package, `.claude/skills/` for domain knowledge.

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 7 | 7 | 8 | 6 | 7.0 |
| 2 | 8 | 8 | 8 | 9 | 7 | 8.0 |
| 3 | 9 | 8 | 8 | 9 | 9 | 8.6 |

## Meta: What the Loop Learned

- **Most valuable source this session:** Dev.to "5 Patterns That Make Claude Code Actually Follow Your Rules" — provided the only data-backed compliance rates for CLAUDE.md patterns (50% violation reduction from positive framing)
- **Least valuable source this session:** Reddit — returned zero results for this topic category, confirming the playbook's guidance to skip Reddit for niche technical topics
- **Surprising discovery:** The "virtual monorepo" pattern from Medium — a completely different approach to the monorepo/polyrepo debate that sidesteps the migration entirely by focusing on context visibility rather than repository structure. This reframes the question from "how should I organize repos?" to "how do I give AI assistants the context they need?"
