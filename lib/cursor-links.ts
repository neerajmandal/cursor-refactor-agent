export function cursorWebUrl(agentId: string): string {
  return `https://cursor.com/agents/${agentId}`;
}

export function cursorDesktopUrl(agentId: string): string {
  return `cursor://anysphere.cursor-deeplink/background-agent?bcId=${agentId}`;
}

export function formatCursorChatIdea(input: {
  prompt: string;
  envName?: string;
  legacyRepo?: string;
  targetRepo?: string;
}): string {
  const parts: string[] = [];
  const title = input.envName?.trim();
  if (title) parts.push(title, "");
  parts.push(input.prompt.trim());
  const legacy = input.legacyRepo?.trim();
  const target = input.targetRepo?.trim();
  if (legacy || target) {
    parts.push("");
    if (legacy) parts.push(`Legacy: ${legacy}`);
    if (target) parts.push(`Target: ${target}`);
  }
  return parts.join("\n").trim();
}
