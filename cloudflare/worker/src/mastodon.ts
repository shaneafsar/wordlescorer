export interface MastoClient {
  url: string;
  accessToken: string;
}

interface MastoStatus {
  id: string;
  content: string;
  url: string | null;
  created_at: string;
  in_reply_to_id: string | null;
  account: {
    id: string;
    acct: string;
    avatar: string;
  };
  media_attachments: Array<{
    description: string | null;
  }>;
}

interface MastoNotification {
  id: string;
  type: string;
  account: {
    id: string;
    acct: string;
    avatar: string;
  };
  status?: MastoStatus;
}

interface MastoRelationship {
  id: string;
  followedBy: boolean;
}

interface MastoContext {
  ancestors: MastoStatus[];
  descendants: MastoStatus[];
}

export type { MastoStatus, MastoNotification, MastoRelationship, MastoContext };

export function createMastoClient(url: string, accessToken: string): MastoClient {
  return { url: url.replace(/\/$/, ''), accessToken };
}

async function mastoFetch<T>(client: MastoClient, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${client.url}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${client.accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mastodon API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchNotifications(
  client: MastoClient, sinceId?: string, limit: number = 100
): Promise<MastoNotification[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (sinceId) params.set('since_id', sinceId);
  return mastoFetch<MastoNotification[]>(client, `/api/v1/notifications?${params}`);
}

export async function fetchRelationships(
  client: MastoClient, accountIds: string[]
): Promise<MastoRelationship[]> {
  const params = new URLSearchParams();
  for (const id of accountIds) {
    params.append('id[]', id);
  }
  return mastoFetch<MastoRelationship[]>(client, `/api/v1/accounts/relationships?${params}`);
}

export async function postStatus(
  client: MastoClient, status: string, inReplyToId?: string
): Promise<MastoStatus> {
  const body: Record<string, string> = { status };
  if (inReplyToId) body.in_reply_to_id = inReplyToId;
  return mastoFetch<MastoStatus>(client, '/api/v1/statuses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchContext(
  client: MastoClient, statusId: string
): Promise<MastoContext> {
  return mastoFetch<MastoContext>(client, `/api/v1/statuses/${statusId}/context`);
}

export async function followAccount(
  client: MastoClient, accountId: string
): Promise<void> {
  await mastoFetch(client, `/api/v1/accounts/${accountId}/follow`, {
    method: 'POST',
    body: JSON.stringify({ reblogs: false }),
  });
}

export async function fetchHashtagTimeline(
  client: MastoClient, tag: string, sinceId?: string, limit: number = 40
): Promise<MastoStatus[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (sinceId) params.set('since_id', sinceId);
  return mastoFetch<MastoStatus[]>(client, `/api/v1/timelines/tag/${encodeURIComponent(tag)}?${params}`);
}
