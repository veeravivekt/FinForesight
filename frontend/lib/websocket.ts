import { io, Socket } from "socket.io-client";

const NOTIFICATION_SERVICE_URL = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || "http://localhost:3004";

let socket: Socket | null = null;

export function connectWebSocket(userId: string, token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(NOTIFICATION_SERVICE_URL, {
    auth: {
      token,
      userId,
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("WebSocket connected");
  });

  socket.on("disconnect", () => {
    console.log("WebSocket disconnected");
  });

  socket.on("connect_error", (error) => {
    console.error("WebSocket connection error:", error);
  });

  return socket;
}

export function disconnectWebSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

