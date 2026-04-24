# Current agent system (pre–Agent V2 cutover) — reference

| Layer | Role |
|-------|------|
| [agent/index.ts](../agent/index.ts) | `runAgent` / `confirmTool`; chat resolution, concurrency guard, SSE via transport |
| [agent/transport/stream.ts](../agent/transport/stream.ts) | `run({ stream: true })`, map SDK events → SSE (`text_delta`, `tool_*`, `reasoning`, `confirmation`, `meta`, `done`) |
| [agent-runs.ts](../agent-runs.ts) | `AgentRun` DB, `run.status` / `run.step` / `run.awaiting_confirmation` via [event-bus](../services/event-bus.ts) |
| [pending-tool-confirmation.ts](../pending-tool-confirmation.ts) | Serialized `RunState` + tool metadata; `takePendingConfirmation` user-scoped |
| [workspace-auth.ts](../workspace-auth.ts) | `requireWorkspaceAccess` |
| [agent-settings.ts](../agent-settings.ts) + [auto-approve-tools.ts](../agent/auto-approve-tools.ts) | Merge stored + request auto-approve; server allowlist in normalizer |
| [chat-llm/index.svelte](../../components/chat-llm/index.svelte) | `POST` `/brain/ask` + `/brain/ask/confirm`, `parseAgentSseEvent` |

Collaboration: one non-terminal `AgentRun` per `chatId` (workspace-wide). Regenerate: last user message author or admin.

V2 extends this with explicit envelopes, optional run-event persistence for replay, and [workspace-context.ts](workspace-context.ts) when `workspacesEnabled` is false.

## V2 HTTP surface (alias of brain; same body)

- `POST /api/workspaces/:workspaceId/agent-v2/runs` — same as `POST .../brain/ask`
- `POST /api/workspaces/:workspaceId/agent-v2/approvals/confirm` — same as `POST .../brain/ask/confirm`
- `GET /api/workspaces/:workspaceId/agent-v2/runs/:runId/events?sinceSequence=n` — replay persisted stream rows
- `GET /api/workspaces/:workspaceId/agent-v2/workspace-events` — like `/events` but uses `requireAgentRouteWorkspace` (default workspace when `ENABLE_WORKSPACES=false`)
