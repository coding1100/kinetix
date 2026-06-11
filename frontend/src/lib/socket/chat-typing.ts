import type { Socket } from "socket.io-client";
import type { ConversationType } from "@/lib/types/chat";

let socketRef: Socket | null = null;

export function registerChatTypingSocket(socket: Socket | null) {
  socketRef = socket;
}

export function emitTypingStart(
  workspaceId: string,
  kind: ConversationType,
  conversationId: string
) {
  socketRef?.emit("chat:typing:start", {
    workspaceId,
    kind,
    conversationId,
  });
}

export function emitTypingStop(
  workspaceId: string,
  kind: ConversationType,
  conversationId: string
) {
  socketRef?.emit("chat:typing:stop", {
    workspaceId,
    kind,
    conversationId,
  });
}
