# Research: Mobile Interface for Claude Code Remote Access (iPhone, Push Notifications, Expo)

**Date:** 2026-04-07
**Cycles:** 2
**Final Score:** 7.8/10
**Playbook Version:** 1.2

## Executive Summary

Building a mobile interface for Claude Code remote access from iPhone with push notifications and two-way communication is a solved problem architecturally, with multiple open-source implementations and official SDK support. The recommended architecture is a **relay server running the Claude Agent SDK** (TypeScript) that bridges between your Expo mobile app and Claude Code's full toolset. Push notifications are the #1 gap in Anthropic's official mobile tooling (26-upvote open feature request), making a custom solution genuinely valuable. The Vercel AI SDK provides a complete Expo integration with streaming chat via `useChat` hook and `expo/fetch`, while Expo's `expo-notifications` handles push delivery. Critical constraint: iOS limits silent/background push to 2-3 per hour, so use visible notifications for reliability.

## Detailed Findings

### 1. The Official Landscape (What Anthropic Provides)

Anthropic offers three official mobile access methods as of April 2026:

**Remote Control** (Feb 25, 2026): Run `claude remote-control` or `claude --rc` in terminal. CLI makes outbound HTTPS to Anthropic API and polls for work. Mobile/web at claude.ai/code is a "window" into the local session. Supports QR code pairing, up to 32 concurrent sessions (`--capacity`), git worktree isolation (`--spawn worktree`), and automatic reconnection on sleep/network drops. Available on Pro/Max/Team/Enterprise plans. **No push notifications** -- users must actively check the app.

**Dispatch** (via Cowork): Send tasks from phone, Claude Desktop processes them on your machine. Marketed with push notifications ("you'll get a push notification when task is done"), but practitioner testing reveals **no actual push notification when work finishes** -- users must manually check the app. ~50% success rate on complex multi-step tasks. Single-threaded.

**Channels**: Forward Telegram, Discord, or iMessage into a Claude Code session. Event-driven, runs on your machine. Most flexible for custom notification routing but requires channel plugin setup.

### 2. The Third-Party Ecosystem

Five notable open-source projects fill the official gaps:

| Project | Stack | Push Notifications | Two-Way | Encryption |
|---------|-------|-------------------|---------|------------|
| **Happy** (slopus) | Expo + TS monorepo | Yes (permission requests, errors, completion) | Yes (device switching) | E2E |
| **claude-remote** (jamierpond) | React + Vite PWA | Yes (via PWA) | Yes (WebSocket + Cloudflare Tunnel) | ECDH P-256 + AES-256-GCM |
| **Claude-Code-Remote** (JessyTsui) | Node.js + messaging platforms | Email/Telegram/LINE | Yes (reply-to-inject) | Platform-dependent |
| **CloudCLI** (siteboon) | Web UI | Limited | Yes | Unknown |
| **247-claude-code-remote** (QuivrHQ) | Web terminal + Tailscale | Limited | Yes | Tailscale mesh |

**Happy** is the most relevant reference implementation -- it's an Expo-based monorepo with four components (App, CLI wrapper, Agent, Server) and 1,788+ commits. It wraps `claude` and `codex` CLI commands, intercepts session events, and routes them to the mobile client with push notifications.

### 3. Recommended Architecture for a Custom Expo App

```
iPhone (Expo App)                    Your Server (VPS/Cloud)              Your Dev Machine
+------------------+                +------------------------+           +------------------+
| Expo Router      |  WebSocket/    | Express + WebSocket    |  Agent    | Claude Agent SDK |
| useChat hook     | <-----------> | Relay Server           | <-------> | (subprocess)     |
| expo-notifications|  SSE stream   |                        |  SDK      |                  |
| Push token mgmt  |                | expo-server-sdk-node   |  query()  | Local filesystem |
+------------------+                | (sends push notifs)    |           | MCP servers      |
                                    +------------------------+           | Git repos        |
                                                                         +------------------+
```

**Option A -- Collocated (simpler):** Server and Claude Agent SDK on the same machine (your dev machine or VPS). Server runs Express + WebSocket, spawns Claude Agent SDK queries, streams responses to mobile client.

**Option B -- Split (production):** Relay server in cloud (e.g., Fly.io), connects to Claude Agent SDK running on your dev machine via secure tunnel (Cloudflare Tunnel or Tailscale). Better uptime for the relay/push notification server.

### 4. Implementation Guide

#### 4a. Expo Mobile Client

**Dependencies:**
```bash
npx create-expo-app@latest claude-mobile --template tabs
cd claude-mobile
npx expo install expo-notifications expo-device expo-constants expo-task-manager
pnpm add ai @ai-sdk/react zod
```

**Push notification registration** (from Expo SDK docs):
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (!Device.isDevice) return undefined;
  
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return undefined;
  
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId 
    ?? Constants?.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token; // Send this to your relay server
}
```

**Streaming chat with AI SDK** (from ai-sdk.dev Expo guide):
```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch'; // Required for streaming in Expo 52+

const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    api: 'https://your-relay-server.com/api/chat',
  }),
});
```

**Background notification handler:**
```typescript
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BACKGROUND_TASK = 'CLAUDE-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_TASK, ({ data, error }) => {
  // Handle: permission request, task completion, error alert
  const { type, sessionId, message } = data as any;
  if (type === 'permission_needed') {
    // Present local notification with action buttons
    Notifications.scheduleNotificationAsync({
      content: { title: 'Claude needs approval', body: message, data: { sessionId } },
      trigger: null, // Immediate
    });
  }
});

Notifications.registerTaskAsync(BACKGROUND_TASK);
```

**Deep linking from notification tap** (Expo Router):
```typescript
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

function useNotificationObserver() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const { sessionId } = response.notification.request.content.data;
      if (sessionId) router.push(`/session/${sessionId}`);
    });
    return () => sub.remove();
  }, []);
}
```

#### 4b. Relay Server (Node.js/Express)

**Core server with Claude Agent SDK + push notifications:**
```typescript
import express from 'express';
import { WebSocketServer } from 'ws';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Expo } from 'expo-server-sdk';

const app = express();
const expo = new Expo();
const pushTokens = new Map<string, string>(); // userId -> expoPushToken

// Register push token from mobile client
app.post('/api/register-push', (req, res) => {
  const { userId, pushToken } = req.body;
  pushTokens.set(userId, pushToken);
  res.json({ ok: true });
});

// WebSocket for real-time streaming
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  ws.on('message', async (data) => {
    const { prompt, sessionId, userId } = JSON.parse(data.toString());
    
    // Stream Claude Agent SDK responses to mobile client
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        resume: sessionId || undefined, // Resume existing session
      },
    })) {
      ws.send(JSON.stringify(message));
      
      // Send push notification for permission requests
      if (message.type === 'tool_use' && message.requires_approval) {
        const token = pushTokens.get(userId);
        if (token) {
          await expo.sendPushNotificationsAsync([{
            to: token,
            title: 'Claude needs approval',
            body: `Approve: ${message.tool_name} on ${message.tool_input?.file_path || 'unknown'}`,
            data: { sessionId: message.session_id, toolUseId: message.id },
          }]);
        }
      }
    }
  });
});
```

#### 4c. Claude Agent SDK Session Management

The Agent SDK supports session persistence -- critical for mobile where connections drop:

```typescript
// Capture session ID on first query
let sessionId: string | undefined;

for await (const message of query({
  prompt: userPrompt,
  options: { allowedTools: ['Read', 'Glob', 'Grep'] },
})) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id; // Store this for the mobile client
  }
}

// Later: resume from mobile after reconnection
for await (const message of query({
  prompt: newPrompt,
  options: { resume: sessionId }, // Full context preserved
})) {
  // Continue where you left off
}
```

### 5. iOS Push Notification Constraints

**Critical limitations for this use case:**

- **Silent/background notifications**: Apple limits to 2-3 per hour. iOS does NOT guarantee delivery even when the notification reaches the device. Expo GitHub issues (#13767, #31866, #43104) show persistent problems with background task execution on iOS.
- **Recommendation**: Use **visible push notifications** (with title + body) for all Claude events. These have reliable delivery. Only use silent push for non-critical background sync.
- **Notification actions**: iOS supports interactive notification categories with buttons (e.g., "Approve" / "Deny" for tool permission requests). Configure via `Notifications.setNotificationCategoryAsync()`.
- **Android**: Notification channels required. Background task execution more reliable than iOS.

### 6. Alternative: Hook into Official Remote Control

Instead of building a full custom client, you can **augment** Anthropic's Remote Control with push notifications using Claude's hook system:

```json
// ~/.claude/settings.json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/push-notifier.js completed",
        "timeout": 5
      }]
    }],
    "PreToolUse": [{
      "matcher": "Bash|Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/push-notifier.js permission-needed",
        "timeout": 5
      }]
    }]
  }
}
```

The `push-notifier.js` sends an Expo push notification via `expo-server-sdk-node`. This adds push notifications to ANY Claude Code session without replacing the UI. Use the official Claude iOS app for the interface, get push notifications from your custom hook.

### 7. Security Considerations

All three major open-source implementations independently converge on similar security patterns:

- **E2E encryption**: ECDH P-256 key exchange + AES-256-GCM per message (claude-remote), or custom E2E (Happy)
- **Authentication**: QR code pairing (official), PIN with Argon2 hashing (claude-remote), token-based 24hr validity (Claude-Code-Remote)
- **Transport**: TLS mandatory. Cloudflare Tunnel or Tailscale for exposing local server
- **API keys**: NEVER on the mobile client. Always server-side via relay/proxy pattern

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Anthropic docs (Remote Control, Agent SDK) | 3 | 3 | High |
| GitHub repos (Happy, claude-remote, Claude-Code-Remote) | 3 | 3 | High |
| GitHub issue #29438 | 1 | 1 | High |
| Context7 Expo notifications | 1 | 1 | High |
| Expo push delivery docs | 1 | 1 | High |
| AI SDK Expo guide (ai-sdk.dev) | 1 | 1 | High |
| Anthropic API streaming docs | 1 | 1 | Medium |
| Nimbalyst comparison article | 1 | 1 | Medium |
| React Native AI (Substack) | 1 | 1 | Medium |
| Dev.to Dispatch article | 1 | 1 | Medium |
| codeminer42 blog | 1 | 0 | Failed |

## Contradictions & Open Questions

### Contradictions (Preserved)
1. **Dispatch push notifications**: Anthropic marketing says push notifications work. Practitioner article from productcompass.pm says "There is no push notification when the work finishes. No email. No sound." Both may be partially true -- some notification types may work while task completion does not.
2. **Architecture philosophy**: Two camps -- "Remote Desktop" (mirror terminal to phone, official approach) vs "Purpose-Built Agent Dashboard" (native mobile UX, third-party approach). Happy and Nimbalyst argue native is better; Anthropic's approach is simpler but less capable.
3. **iOS background notification reliability**: Apple documentation says it works with `_contentAvailable: true`. Expo GitHub issues (#13767, #31866, #43104) show it frequently fails, especially in bridgeless mode (SDK 54+). Real-world: unreliable.

### Open Questions
- Will Anthropic add native push notifications to Remote Control? (Issue #29438 is open, no Anthropic response)
- Can the Claude Agent SDK's `AskUserQuestion` tool be routed to a mobile client for interactive approval? (Not documented)
- What is the real-world latency of the relay architecture (mobile -> server -> Agent SDK -> Claude API -> back)?
- Does Happy's Expo push notification implementation work reliably on iOS in production?

## Actionable Next Steps

1. **Fastest path (hours)**: Add push notifications to existing Remote Control via Claude hooks in `~/.claude/settings.json` + a small `push-notifier.js` using `expo-server-sdk-node`. Use the official Claude iOS app for UI.

2. **Medium path (days)**: Build a minimal Expo app with `useChat` from `@ai-sdk/react`, streaming via `expo/fetch`, and push notifications via `expo-notifications`. Relay server uses Express + WebSocket + direct Claude Messages API (not Agent SDK).

3. **Full path (1-2 weeks)**: Build an Expo app with the Claude Agent SDK on a relay server. This gives full Claude Code capabilities (file editing, bash, MCP servers) accessible from your phone with push notifications, session persistence, and E2E encryption.

4. **For push notifications**: Always use visible push (title + body) on iOS. Reserve silent push for non-critical sync. Implement notification categories with action buttons for tool approval.

5. **For session persistence**: Use the Claude Agent SDK's `resume: sessionId` pattern. Store session IDs on the relay server. Mobile client reconnects and resumes where it left off.

6. **For security**: Implement ECDH P-256 key exchange on first pairing (QR code scan). Use AES-256-GCM per message. Never store API keys on mobile. Use Cloudflare Tunnel or Tailscale for server exposure.

7. **For streaming**: Use `expo/fetch` (Expo 52+) with `DefaultChatTransport` from Vercel AI SDK. Fallback: `react-native-sse` for older Expo versions. WebSocket for bidirectional communication (approval responses).

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 8 | 7 | 6 | 6 | 6.8 |
| 2 | 8 | 8 | 8 | 8 | 7 | 7.8 |

## Meta: What the Loop Learned

- **Most valuable source this session**: Claude Agent SDK docs (code.claude.com/docs/en/agent-sdk/overview) -- the discovery that a full programmatic API exists for building custom Claude Code clients completely changed the architecture recommendation. Combined with the AI SDK Expo guide, this provides a production-ready implementation path.
- **Least valuable source this session**: codeminer42 blog -- WebFetch returned only CSS/schema markup, no actual article content. Firecrawl would have been a better fallback.
- **Surprising discovery**: Dispatch's push notification gap. Anthropic's marketing materials and Remote Control docs say push notifications work, but a practitioner running it for 48 hours reports zero push notifications on task completion. This is the exact pain point a custom Expo app solves.
