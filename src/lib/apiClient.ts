import { auth } from './firebase';

export interface LiveQuotaSnapshot {
  planTier: 'free' | 'premium';
  usedToday: number;
  dailyLimit: number;
  remainingToday: number;
  extraCredits: number;
  nextResetFormatted: string;
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const authHeaders = await getAuthHeader();
  const headers = new Headers(init?.headers || {});
  for (const [k, v] of Object.entries(authHeaders)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  const quotaHeader = response.headers.get('X-Fabro-Quota');
  if (quotaHeader && typeof window !== 'undefined') {
    try {
      const parsed = JSON.parse(quotaHeader) as LiveQuotaSnapshot;
      window.dispatchEvent(new CustomEvent('fabro:quota-updated', { detail: parsed }));
    } catch {
      // ignore malformed header
    }
  }

  if (response.status === 429 && typeof window !== 'undefined') {
    try {
      const cloned = response.clone();
      const body = (await cloned.json().catch(() => ({}))) as { error?: string; code?: string };
      if (body.code === 'DAILY_LIMIT_REACHED' || body.code === 'MONTHLY_BUDGET_EXHAUSTED') {
        window.dispatchEvent(
          new CustomEvent('fabro:quota-exceeded', {
            detail: { message: body.error || '', code: body.code },
          })
        );
      }
    } catch {
      // ignore
    }
  }

  return response;
}
