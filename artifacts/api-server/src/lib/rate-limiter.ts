const ipConversationCounts = new Map<string, { count: number; resetAt: number }>();

const MAX_CONVERSATIONS_PER_DAY = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = ipConversationCounts.get(ip);

  if (!record || now > record.resetAt) {
    ipConversationCounts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_CONVERSATIONS_PER_DAY };
  }

  if (record.count >= MAX_CONVERSATIONS_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: MAX_CONVERSATIONS_PER_DAY - record.count };
}

export function incrementRateLimit(ip: string): void {
  const now = Date.now();
  const record = ipConversationCounts.get(ip);

  if (!record || now > record.resetAt) {
    ipConversationCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    record.count += 1;
  }
}
