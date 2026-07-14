/**
 * Copyable prompts that teach a user's own AI agent (Claude Code, Cursor, …)
 * to bridge their tracker to this room over the plain-HTTP API. The tracker
 * pick is remembered per device.
 */

const TRACKER_KEY = 'sp:tracker';
const SCOPE_KEY = (id: string) => `sp:tracker-scope:${id}`;

export interface Tracker {
	id: string;
	label: string;
	/** how the agent should gather stories (no scope given) */
	gather: string;
	/** how a user-provided scope is phrased into the prompt */
	scoped: (scope: string) => string;
	/** placeholder for the loosely-structured scope input */
	scopePlaceholder: string;
	/** how the agent should write estimates back */
	writeBack: string;
}

export const TRACKERS: Tracker[] = [
	{
		id: 'linear',
		label: 'Linear',
		gather: 'using my Linear MCP tool, list the issues in my current cycle (identifier + title)',
		// Linear's API/MCP filters by project/cycle/team/label/search — custom
		// views are UI-only (use their ⋯ → Export issues as CSV instead).
		scoped: (s) => `using my Linear MCP tool, list the issues in “${s}” (a project, cycle, team, label, or search — identifier + title). Note: custom views aren’t API-accessible; if that’s what this is, ask me for an equivalent filter or a CSV export instead`,
		scopePlaceholder: 'project / cycle / team / label / search',
		writeBack: 'set each matching Linear issue’s estimate',
	},
	{
		id: 'jira',
		label: 'Jira',
		gather: 'using my Jira MCP tool or `jira` CLI, list the issues in my current sprint (summary + key)',
		scoped: (s) => `using my Jira MCP tool or \`jira\` CLI, list the issues matching “${s}” (JQL, board, or sprint — summary + key)`,
		scopePlaceholder: 'JQL, board, or sprint',
		writeBack: 'set the Story Points field on each matching Jira issue',
	},
	{
		id: 'github',
		label: 'GitHub',
		gather: 'using `gh issue list`, list the open issues in this repo’s current milestone (title + number)',
		scoped: (s) => `using \`gh\`, list the open issues matching “${s}” (a repo, milestone, label, or search — title + number)`,
		scopePlaceholder: 'repo, milestone, label, or search',
		writeBack: 'label or comment each matching GitHub issue with its estimate',
	},
	{
		id: 'other',
		label: 'Other',
		gather: 'from wherever I track work (ask me if unsure), gather the stories we plan to estimate',
		scoped: (s) => `gather the stories we plan to estimate from “${s}”`,
		scopePlaceholder: 'where should the agent look?',
		writeBack: 'write the estimates back to my tracker using my local tooling',
	},
];

export function getTracker(): string {
	return localStorage.getItem(TRACKER_KEY) ?? 'linear';
}

export function setTracker(id: string): void {
	localStorage.setItem(TRACKER_KEY, id);
}

/** Last-used scope, remembered per tracker per device. */
export function getScope(trackerId: string): string {
	return localStorage.getItem(SCOPE_KEY(trackerId)) ?? '';
}

export function setScope(trackerId: string, scope: string): void {
	if (scope.trim()) localStorage.setItem(SCOPE_KEY(trackerId), scope.trim());
	else localStorage.removeItem(SCOPE_KEY(trackerId));
}

const SETUP = (origin: string) => `Fetch ${origin}/agent-setup/prompt.md and follow it.`;

/** "Fill the queue from my tracker" — paste into any agent. */
export function importPrompt(trackerId: string, roomUrl: string, scope = ''): string {
	const t = TRACKERS.find((x) => x.id === trackerId) ?? TRACKERS[TRACKERS.length - 1];
	const origin = new URL(roomUrl).origin;
	const gather = scope.trim() ? t.scoped(scope.trim()) : t.gather;
	return `${SETUP(origin)}
Then, ${gather}, and import them into the estimation queue for ${roomUrl} \
(one story per line; include the ticket id in the line). \
Confirm by telling me how many are queued.`;
}

/** "Write the results back" — paste into any agent after the session. */
export function writebackPrompt(trackerId: string, roomUrl: string): string {
	const t = TRACKERS.find((x) => x.id === trackerId) ?? TRACKERS[TRACKERS.length - 1];
	const origin = new URL(roomUrl).origin;
	return `${SETUP(origin)}
Then fetch the session export for ${roomUrl} and show me a story → points \
summary table. After I confirm, ${t.writeBack}. \
Story Points holds no tracker credentials — use my local tooling.`;
}
