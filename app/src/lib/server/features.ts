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
