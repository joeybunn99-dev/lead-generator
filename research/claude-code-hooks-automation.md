# Research: Claude Code Hooks Automation

**Date:** 2026-04-07
**Cycles:** 2
**Final Score:** 8.6/10
**Playbook Version:** 1.2

## Executive Summary

Claude Code hooks provide deterministic, event-driven automation at 26 lifecycle points with 4 handler types (command, http, prompt, agent). They convert advisory CLAUDE.md guidance into enforced policy gates that cannot be bypassed -- even `bypassPermissions` mode cannot override a PreToolUse deny hook. The ecosystem spans CLI shell hooks (settings.json), Agent SDK programmatic callbacks (Python/TypeScript), and community TypeScript frameworks. Critical production gotchas include exit code 2 vs 1 confusion (the #1 mistake), formatter context window costs, and session snapshot locking that causes hooks to silently not fire.

## Detailed Findings

### Complete Event Taxonomy (26 Events)

Claude Code hooks fire at 26 distinct lifecycle points, organized by phase:

**Session lifecycle:**
- `SessionStart` (matchers: startup, resume, clear, compact)
- `SessionEnd` (matchers: clear, resume, logout, prompt_input_exit, bypass_permissions_disabled, other)

**User interaction:**
- `UserPromptSubmit` — fires when user submits prompt, before Claude processes it. Can block (exit 2) or inject context (stdout/additionalContext). No matchers.

**Tool execution (the core 4):**
- `PreToolUse` — fires BEFORE tool executes. Can block, modify input, auto-approve, or defer. Matchers: tool names (Bash, Edit, Write, Read, Glob, Grep, Agent, WebFetch, WebSearch, AskUserQuestion, ExitPlanMode, MCP tools via `mcp__<server>__<tool>`).
- `PostToolUse` — fires AFTER tool succeeds. CANNOT block (tool already ran). Can inject context. Matchers: tool names.
- `PostToolUseFailure` — fires after tool fails. Cannot block. Matchers: tool names.
- `PermissionRequest` — fires when permission dialog would appear. Can auto-approve or deny. Matchers: tool names.
- `PermissionDenied` — fires when auto mode denies a tool. Return `{retry: true}` to allow retry. Matchers: tool names.

**Agent/subagent:**
- `SubagentStart` / `SubagentStop` — matchers: agent type (Bash, Explore, Plan, custom names)
- `TeammateIdle` — when agent team teammate goes idle

**Task management:**
- `TaskCreated` / `TaskCompleted` — can block task creation/completion

**Completion:**
- `Stop` — fires when Claude finishes responding (NOT only at task completion). Does NOT fire on user interrupts. Can BLOCK stopping (forces Claude to continue). No matchers.
- `StopFailure` — fires on API errors. Output/exit code IGNORED. Matchers: rate_limit, authentication_failed, billing_error, invalid_request, server_error, max_output_tokens, unknown.

**Configuration:**
- `InstructionsLoaded` — when CLAUDE.md loaded. Matchers: session_start, nested_traversal, path_glob_match, include, compact.
- `ConfigChange` — when config files change. Matchers: user_settings, project_settings, local_settings, policy_settings, skills.
- `CwdChanged` — on directory change. Can use CLAUDE_ENV_FILE.
- `FileChanged` — when watched files change. Matcher = filename basename.

**Worktree:**
- `WorktreeCreate` / `WorktreeRemove`

**Compaction:**
- `PreCompact` / `PostCompact` — matchers: manual, auto

**MCP elicitation:**
- `Elicitation` / `ElicitationResult` — matchers: MCP server name

### 4 Handler Types

| Type | Use Case | Default Timeout | Decision Capable |
|------|----------|----------------|-----------------|
| `command` | Shell scripts, deterministic checks | 600s | Yes (exit codes + JSON) |
| `http` | External service integration, webhooks | 30s | Yes (JSON response) |
| `prompt` | Single-turn LLM evaluation (Haiku default) | 30s | Yes (ok/reason JSON) |
| `agent` | Multi-turn subagent with tool access | 60s | Yes (ok/reason JSON) |

**Prompt hook example (Stop event):**
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "prompt",
        "prompt": "Check if all tasks are complete. If not, respond with {\"ok\": false, \"reason\": \"what remains\"}."
      }]
    }]
  }
}
```

**Agent hook example (Stop event with test verification):**
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "agent",
        "prompt": "Verify that all unit tests pass. Run the test suite and check results. $ARGUMENTS",
        "timeout": 120
      }]
    }]
  }
}
```

### Exit Code Semantics (Critical)

| Exit Code | Behavior | Common Mistake |
|-----------|----------|---------------|
| 0 | Success, parse JSON stdout | N/A |
| **2** | **BLOCK the action**, stderr = feedback to Claude | Using exit 1 instead -- appears to work but does NOT block |
| 1 / other | Non-blocking error, continues | Thinking exit 1 = block |

**The #1 production mistake:** Using `exit 1` in a security hook instead of `exit 2`. The hook appears to work during testing (warning displays), but the dangerous command still executes. This provides zero enforcement.

### PreToolUse Decision Control

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "Explanation",
    "updatedInput": { "modified_field": "value" },
    "additionalContext": "Context for Claude"
  }
}
```

**Decision precedence (multiple hooks):** deny > defer > ask > allow

**Critical security property:** PreToolUse hooks fire BEFORE any permission-mode check. A hook returning `deny` blocks the tool even in `bypassPermissions` mode or with `--dangerously-skip-permissions`. However, a hook returning `allow` does NOT override deny rules from settings. Hooks can tighten restrictions but never loosen them.

**The `if` field (v2.1.85+):** Filter by tool name AND arguments using permission rule syntax:
```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "if": "Bash(git *)",
    "command": ".claude/hooks/check-git-policy.sh"
  }]
}
```
This fires ONLY for git commands, not all Bash commands. Eliminates unnecessary hook process spawning.

### Production Patterns (12 Ready-to-Use)

#### 1. Security Gate — Block Dangerous Commands (PreToolUse)
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "bash -c 'INPUT=$(cat); CMD=$(echo \"$INPUT\" | jq -r \".tool_input.command\"); if echo \"$CMD\" | grep -qE \"rm\\s+-rf\\s+/|git\\s+push\\s+(-f|--force)\\s+(origin\\s+)?main|git\\s+reset\\s+--hard|DROP\\s+TABLE|:(){ :|:& };:\"; then echo \"BLOCKED: Dangerous command detected\" >&2; exit 2; fi'"
      }]
    }]
  }
}
```

#### 2. Protected Files — Block Edits to Sensitive Files (PreToolUse)
```bash
#!/bin/bash
# .claude/hooks/protect-files.sh
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")
for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done
exit 0
```

#### 3. Slopsquatting Defense — Block Unvetted Dependencies (PreToolUse)
Block production dependency installs without approval. AI tools hallucinate package names that attackers register as malware.
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "if": "Bash(npm install*)",
      "hooks": [{
        "type": "prompt",
        "prompt": "Evaluate if this npm install command is installing known, legitimate packages. Check for suspicious package names that could be typosquatting. $ARGUMENTS"
      }]
    }]
  }
}
```

#### 4. Auto-Format After Edits (PostToolUse)
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
      }]
    }]
  }
}
```
**Warning:** This fires system reminders on every format, eating context window. For long sessions, format on commit (Stop hook) instead.

#### 5. Desktop Notifications (Notification)
```json
{
  "hooks": {
    "Notification": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "powershell.exe -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude Code needs your attention', 'Claude Code')\""
      }]
    }]
  }
}
```

#### 6. Re-inject Context After Compaction (SessionStart)
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "compact",
      "hooks": [{
        "type": "command",
        "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing. Current sprint: auth refactor.'"
      }]
    }]
  }
}
```

#### 7. Completion Guard — Ensure Tests Pass (Stop)
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "agent",
        "prompt": "Verify all unit tests pass. Run the test suite and check results. $ARGUMENTS",
        "timeout": 120
      }]
    }]
  }
}
```
**Critical:** Must check `stop_hook_active` to prevent infinite loops:
```bash
#!/bin/bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Allow Claude to stop
fi
# ... verification logic
```

#### 8. Quality Gate Before Commit (PreToolUse)
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "if": "Bash(git commit*)",
      "hooks": [{
        "type": "command",
        "command": "bash -c 'if ! LINT_OUTPUT=$(ruff check . --select E,F,W 2>&1); then echo \"LINT FAILED:\" >&2; echo \"$LINT_OUTPUT\" >&2; exit 2; fi'"
      }]
    }]
  }
}
```

#### 9. Sandbox Redirection (PreToolUse — Agent SDK)
```python
async def redirect_to_sandbox(input_data, tool_use_id, context):
    if input_data["tool_name"] == "Write":
        original_path = input_data["tool_input"].get("file_path", "")
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "allow",
                "updatedInput": {
                    **input_data["tool_input"],
                    "file_path": f"/sandbox{original_path}",
                },
            }
        }
    return {}
```

#### 10. Auto-Approve Read-Only Tools (PreToolUse)
```json
{
  "hooks": {
    "PermissionRequest": [{
      "matcher": "ExitPlanMode",
      "hooks": [{
        "type": "command",
        "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"PermissionRequest\", \"decision\": {\"behavior\": \"allow\"}}}'"
      }]
    }]
  }
}
```

#### 11. Audit Configuration Changes (ConfigChange)
```json
{
  "hooks": {
    "ConfigChange": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "jq -c '{timestamp: now | todate, source: .source, file: .file_path}' >> ~/claude-config-audit.log"
      }]
    }]
  }
}
```

#### 12. Bash Command Logging (PostToolUse)
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.command' >> ~/.claude/command-log.txt"
      }]
    }]
  }
}
```

### Agent SDK Programmatic Hooks

The Claude Agent SDK (Python + TypeScript) supports hooks as async callback functions, not shell commands. This enables type-safe, testable hook logic with full language capabilities.

**Python SDK:**
```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, HookMatcher

async def protect_env_files(input_data, tool_use_id, context):
    file_path = input_data["tool_input"].get("file_path", "")
    if file_path.split("/")[-1] == ".env":
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "deny",
                "permissionDecisionReason": "Cannot modify .env files",
            }
        }
    return {}

options = ClaudeAgentOptions(
    hooks={"PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[protect_env_files])]}
)
```

**TypeScript SDK:**
```typescript
import { query, HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const protectEnvFiles: HookCallback = async (input, toolUseID, { signal }) => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;
  const filePath = toolInput?.file_path as string;
  if (filePath?.split("/").pop() === ".env") {
    return {
      hookSpecificOutput: {
        hookEventName: preInput.hook_event_name,
        permissionDecision: "deny",
        permissionDecisionReason: "Cannot modify .env files"
      }
    };
  }
  return {};
};
```

**SDK event availability gap:** Python SDK lacks SessionStart, SessionEnd, TeammateIdle, TaskCompleted, ConfigChange, WorktreeCreate/Remove. Use `settingSources: ["project"]` to load shell hooks from settings.json for these events.

**Async SDK hooks:** Return `{async_: True, asyncTimeout: 30000}` (Python) for fire-and-forget side effects (logging, webhooks). Agent continues without waiting.

### Configuration Locations & Scope

| Location | Scope | Shareable | Notes |
|----------|-------|-----------|-------|
| `~/.claude/settings.json` | All projects | No | Personal global hooks |
| `.claude/settings.json` | Single project | Yes (commit to repo) | Team-wide standards |
| `.claude/settings.local.json` | Single project | No (gitignored) | Local overrides |
| Managed policy settings | Organization-wide | Admin-controlled | Highest precedence |
| Plugin `hooks/hooks.json` | When plugin enabled | Yes | Bundled with plugin |
| Skill/Agent frontmatter | Component lifetime | Yes | Temporary hooks |

**Settings precedence:** Managed > Project > User. Project hooks override user defaults.

### Environment Variables

| Variable | Availability | Purpose |
|----------|-------------|---------|
| `CLAUDE_PROJECT_DIR` | All hooks | Project root path |
| `CLAUDE_PLUGIN_ROOT` | Plugin hooks | Plugin installation directory |
| `CLAUDE_PLUGIN_DATA` | Plugin hooks | Plugin persistent data directory |
| `CLAUDE_ENV_FILE` | SessionStart, CwdChanged, FileChanged | Write environment exports here |
| `CLAUDE_CODE_REMOTE` | All hooks | "true" in remote environments |

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Anthropic official docs (hooks reference) | 1 | 26 events, complete schemas | High |
| Anthropic hooks guide | 1 | 7 recipes, troubleshooting | High |
| Anthropic Agent SDK docs | 1 | Programmatic hooks, Python/TS | High |
| GitHub repos (disler, anthropics, johnlindquist) | 4 | Production patterns, type safety | High |
| GitHub issues | 1 | Critical bug (hooks not firing) | High |
| Dev.to articles | 2 | Security/format/test patterns | Medium |
| Blog articles (blakecrosley, pixelmojo, aiorg.dev) | 3 | CI/CD, production tips | Medium |
| YouTube | 1 | Nothing found | Low |
| Stack Overflow | 1 | Nothing found | Low |
| Web search (general) | 3 | Pointed to good sources | Medium |

## Contradictions & Open Questions

### Contradictions

1. **Hooks not firing (GitHub #6305):** 7+ developers report PreToolUse/PostToolUse hooks never fire, contradicting all other sources showing them working. Root cause: session snapshot locking -- hooks loaded at startup, changes during session not always picked up. **Resolution:** Configure hooks BEFORE starting session, verify with `/hooks`, restart session after changes.

2. **Formatter timing trade-off:** Dev.to/blog articles recommend PostToolUse formatters after every edit. aiorg.dev/Pixelmojo warn this eats context window (system reminders on every format). **Resolution:** Both valid -- PostToolUse for short tasks, Stop/commit hook for long sessions.

### Open Questions

- What is the actual execution overhead (ms) of hooks per tool call?
- How do hooks interact with `--dangerously-skip-permissions` in the Agent SDK?
- Can prompt/agent hooks access the full conversation transcript?
- What happens when multiple PreToolUse hooks return different `updatedInput` values? (Docs say "last one to finish wins" -- non-deterministic since hooks run in parallel)
- Is there a way to order hook execution for deterministic `updatedInput` resolution?

## Actionable Next Steps

1. **Start with these 3 high-value hooks** in `.claude/settings.json`:
   - PostToolUse auto-formatter (Edit|Write matcher)
   - PreToolUse security gate (Bash matcher, exit 2 for dangerous commands)
   - Notification desktop alert (permission_prompt matcher)

2. **Add the `if` field** (v2.1.85+) to narrow hook firing and reduce overhead:
   - `"if": "Bash(git *)"` for git-only hooks
   - `"if": "Bash(npm install*)"` for dependency-only hooks

3. **Protect sensitive files** with a PreToolUse script blocking .env, .git/, lock files

4. **Add a Stop hook guard** for task completion -- either prompt-based (quick) or agent-based (thorough). Always check `stop_hook_active` to prevent infinite loops.

5. **For long sessions**, move formatting from PostToolUse to Stop/commit to save context window

6. **For Agent SDK users**, implement programmatic hooks in Python/TypeScript for type safety and testability. Use `async_: True` for logging/webhook side effects.

7. **Verify hooks are active** after any config change using `/hooks` menu or by restarting the session

8. **Never use exit 1 for blocking** -- only exit 2 blocks. This is the most common production mistake.

9. **Consider slopsquatting defense** with a prompt hook on npm/pip install commands

10. **Use layered hook architecture** for complex workflows: command (fast, deterministic) -> prompt (LLM judgment) -> agent (multi-step verification)

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 8 | 7 | 8 | 8 | 7 | 7.6 |
| 2 | 9 | 8 | 8 | 9 | 9 | 8.6 |

## Meta: What the Loop Learned

- **Most valuable source this session:** Anthropic official docs (code.claude.com/docs/en/hooks) -- the definitive reference with 26 events and complete JSON schemas. Agent SDK docs (code.claude.com/docs/en/agent-sdk/hooks) were the highest-value cycle 2 addition, opening an entirely new dimension of programmatic hooks.
- **Least valuable source this session:** YouTube (0 results) and Stack Overflow (0 results) -- this topic is too new/niche for these platforms.
- **Surprising discovery:** The `if` field for argument-level filtering was buried in the guide but not prominent in the reference docs. Also, the context window cost of PostToolUse formatters is a real production concern that most tutorial articles ignore.
