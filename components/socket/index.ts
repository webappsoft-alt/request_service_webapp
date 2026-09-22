"use client";

export { SocketProvider, useSocket, useSocketContext, emitWithAck } from "./SocketProvider";
export {
  SOCKET_AUTH_EVENT,
  bindSharedSocket,
  getSocket,
  getRealtimeSocket,
  connectSocket,
  connectRealtime,
  disconnectSocket,
  disconnectRealtime,
  joinChatThread,
  leaveChatThread,
  emitChatTyping,
  emitChatMarkRead,
  queryPresence,
  onSocketEvent,
  onRealtime,
  emitLeadStatusChange,
  type RealtimeEvents,
  type SocketAuthDetail,
} from "./socket-api";
