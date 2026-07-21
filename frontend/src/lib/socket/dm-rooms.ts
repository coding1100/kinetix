import type { Socket } from "socket.io-client";

let socketRef: Socket | null = null;

export function registerDmRoomsSocket(socket: Socket | null) {
  socketRef = socket;
}

export function joinDmRoom(workspaceId: string, conversationId: string) {
  if (!workspaceId || !conversationId) return;
  socketRef?.emit("dm:join", { workspaceId, conversationId });
}
