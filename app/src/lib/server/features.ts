import { env } from '$env/dynamic/private';

/**
 * Whether the workspaces feature is enabled.
 *
 * When false, workspace management UI and API are hidden entirely.
 * Workspace-dependent functional features (chats, agents, files, search)
 * continue to work silently behind a hidden default workspace.
 *
 * Set via ENABLE_WORKSPACES env var (default: true).
 */
export const workspacesEnabled: boolean = env.ENABLE_WORKSPACES !== 'false';

/**
 * When true (default), the OpenAI Agents SDK run uses the Agent V2 transport
 * (versioned SSE envelopes, optional run-event replay).
 * Set `USE_AGENT_V2=false` to use the legacy stream (not recommended).
 */
export const useAgentV2: boolean = env.USE_AGENT_V2 !== 'false';
