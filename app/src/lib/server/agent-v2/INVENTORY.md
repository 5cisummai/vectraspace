# Agent system — reference

| Layer | Role |
|-------|------|
| [entry.ts](entry.ts) | `runAgentV2` / `confirmToolV2`; `prepareAgentRun`, SDK `run`, HITL resume |
| [transport-sse.ts](transport-sse.ts) | `run({ stream: true })`, versioned SSE + `AgentV2StreamEvent` persistence |
| [run-prepare.ts](run-prepare.ts) | Shared chat resolution, concurrency guard, history for ask/regenerate |
| [agent-runs.ts](../agent-runs.ts) | `AgentRun` DB, `run.status` / `run.step` / `run.awaiting_confirmation` via [event-bus](../services/event-bus.ts) |
| [pending-tool-confirmation.ts](../pending-tool-confirmation.ts) | Serialized `RunState` + tool metadata; `takePendingConfirmation` user-scoped |
| [workspace-auth.ts](../workspace-auth.ts) | `requireAgentRouteWorkspace` for agent routes (default workspace when workspaces disabled) |
| [agent-settings.ts](../agent-settings.ts) + [auto-approve-tools.ts](auto-approve-tools.ts) | Merge stored + request auto-approve; server allowlist in normalizer |
| [chat-llm/index.svelte](../../components/chat-llm/index.svelte) | `POST` `/agent-v2/runs` + `/agent-v2/approvals/confirm`, `parseAgentSseEvent` |

Collaboration: one non-terminal `AgentRun` per `chatId` (workspace-wide). Regenerate: last user message author or admin.

## V2 HTTP surface

- `POST /api/workspaces/:workspaceId/agent-v2/runs` — start a run
- `POST /api/workspaces/:workspaceId/agent-v2/approvals/confirm` — confirm/deny pending tool action
- `GET /api/workspaces/:workspaceId/agent-v2/runs/:runId/events?sinceSequence=n` — replay persisted stream rows
- `GET /api/workspaces/:workspaceId/agent-v2/workspace-events` — like `/events` but uses `requireAgentRouteWorkspace` (default workspace when `ENABLE_WORKSPACES=false`)
