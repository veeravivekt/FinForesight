import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";

let socket: Socket | null = null;

export const useWebSocket = () => {
  const { isAuthenticated } = useAuth();
  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (isAuthenticated && token) {
      socket = io(import.meta.env.VITE_NOTIFICATION_URL || "http://localhost:3004", {
        auth: {
          token,
          userId: localStorage.getItem("userId"),
        },
        transports: ["websocket"],
      });

      socket.on("connect", () => {
        console.log("WebSocket connected");
      });

      socket.on("disconnect", () => {
        console.log("WebSocket disconnected");
      });

      return () => {
        if (socket) {
          socket.disconnect();
          socket = null;
        }
      };
    }
  }, [isAuthenticated, token]);

  const emit = (event: string, data: any) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  const on = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
    return () => {
      if (socket) {
        socket.off(event, callback);
      }
    };
  };

  return { socket, emit, on };
};

