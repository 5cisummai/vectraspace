# Agent Chat API Contract (Multi-Client)

This document defines the current chat/agent API contract so web, mobile, and CLI clients can use the same backend behavior.

## Base Rules

- All endpoints require authenticated user context.
- Workspace-scoped endpoints require membership in that workspace.
- All IDs are CUID strings.
- Chat/agent runs are workspace-scoped under `/api/workspaces/:workspaceId/*`.
- Workspace chats are shared transcripts: any workspace member can read them, but edit/regenerate is limited to the author of the originating prompt (or a workspace admin).
- Only one active agent run is allowed per chat at a time. Concurrent asks on the same chat return `409`.

## Core Endpoints

### List chats

- `GET /api/workspaces/:workspaceId/chats`
- Response: chat list with status metadata.

### Create chat

- `POST /api/workspaces/:workspaceId/chats`
- Body: `{ "title"?: string }`
- Response: created chat.

### Get transcript

- `GET /api/workspaces/:workspaceId/chats/:chatId`
- Response: `{ chat, messages[] }`.
- `messages[]` now include author metadata for user messages: `authorUserId?`, `authorDisplayName?`, `authorUsername?`.

### Delete chat

- `DELETE /api/workspaces/:workspaceId/chats/:chatId`

### Truncate chat (edit/regenerate support)

- `POST /api/workspaces/:workspaceId/chats/:chatId/truncate`
- Body: `{ "fromMessageId": "<cuid>" }`

### Ask agent (SSE stream)

- `POST /api/workspaces/:workspaceId/brain/ask`
- Body:
  - `question: string` (required unless `regenerate=true`)
  - `chatId?: string`
  - `filters?: { mediaType?, rootIndex?, fileIds?, limit?, minScore? }`
  - `regenerate?: boolean`
  - `maxHistoryMessages?: number`
  - `autoApproveToolNames?: string[]`
- Response: `text/event-stream`.

### Confirm tool approval (SSE stream)

- `POST /api/workspaces/:workspaceId/brain/ask/confirm`
- Body:
  - `pendingId: string`
  - `approved: boolean`
  - `chatId?: string`
  - `autoApproveToolNames?: string[]`
- Response: `text/event-stream`.
- Pending confirmations remain tied to the user who initiated the run.

### Active run snapshot

- `GET /api/workspaces/:workspaceId/runs/active?chatId=:chatId`
- Used for clients that reconnect without an attached SSE stream.

### Agent preferences

- `GET /api/workspaces/:workspaceId/agent/settings`
- `PUT /api/workspaces/:workspaceId/agent/settings`
- Request body for `PUT`: `{ "autoApproveToolNames"?: string[] }`
- Response: `{ "autoApproveToolNames": string[] }`

## SSE Event Protocol

The ask/confirm endpoints stream these events:

- `run_started`
  - Payload: `{ runId, chatId, userMessageId? }`
  - Use to sync server-generated IDs and bind stream to chat.
- `text_delta`
  - Payload: `{ delta }`
  - Append tokens to in-progress assistant text.
- `reasoning`
  - Payload: `{ text }`
  - Optional reasoning text preceding tool calls.
- `tool_start`
  - Payload: `{ tool, args }`
- `tool_done`
  - Payload: `{ tool, result }`
- `confirmation`
  - Payload: `{ pendingId, tool, args, chatId, requestedByUserId? }`
  - Stream pauses until confirmation endpoint resumes.
- `meta`
  - Payload: `{ chatId, messageId, sources, toolCalls, model, iterations }`
  - Final metadata for the assistant message saved to DB.
- `error`
  - Payload: `{ message }`
- `done`
  - Payload: `{}`

## Event Ordering and Idempotency

- A successful run emits `run_started` first.
- `text_delta`, `reasoning`, `tool_start`, `tool_done` may interleave.
- `meta` appears only for completed runs (no pending confirmation interruption).
- `confirmation` indicates paused execution; no final assistant message is committed yet.
- `done` is always sent at stream termination, including failure paths.
- Clients should treat duplicate reconnect fetches as idempotent by using `messageId` and transcript refresh as source of truth.

## Client Integration Notes

- Preferred flow:
  1. Start with `ask` SSE stream.
  2. If disconnected, query `runs/active`.
  3. If run is done, refresh transcript endpoint.
  4. If awaiting confirmation, call confirm endpoint with `pendingId`.
- Store `autoApproveToolNames` via `/agent/settings` for cross-device/workspace parity.
- Keep rendering and UX state local to each client; treat transcript + SSE events as backend truth.
- For collaborative UIs, subscribe to workspace events and refresh the active transcript on `chat.message`, `chat.truncated`, `chat.deleted`, and `run.awaiting_confirmation`.
