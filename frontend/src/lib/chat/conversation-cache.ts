import type { Channel, ChatMessage, ConversationType, DirectMessage } from "@/lib/types/chat";

type ConversationCacheEntry = {
  messages: ChatMessage[];
  channel: Channel | null;
  dm: DirectMessage | null;
  updatedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, ConversationCacheEntry>();

function cacheKey(
  workspaceId: string,
  type: ConversationType,
  id: string
) {
  return `${workspaceId}:${type}:${id}`;
}

export function getConversationCache(
  workspaceId: string,
  type: ConversationType,
  id: string
): ConversationCacheEntry | null {
  const entry = cache.get(cacheKey(workspaceId, type, id));
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > CACHE_TTL_MS) {
    cache.delete(cacheKey(workspaceId, type, id));
    return null;
  }
  return entry;
}

export function setConversationCache(
  workspaceId: string,
  type: ConversationType,
  id: string,
  data: {
    messages?: ChatMessage[];
    channel?: Channel | null;
    dm?: DirectMessage | null;
  }
) {
  const key = cacheKey(workspaceId, type, id);
  const prev = cache.get(key);
  cache.set(key, {
    messages: data.messages ?? prev?.messages ?? [],
    channel: data.channel !== undefined ? data.channel : (prev?.channel ?? null),
    dm: data.dm !== undefined ? data.dm : (prev?.dm ?? null),
    updatedAt: Date.now(),
  });
}

export function clearConversationCache(
  workspaceId: string,
  type: ConversationType,
  id: string
) {
  cache.delete(cacheKey(workspaceId, type, id));
}
