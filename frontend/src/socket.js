import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:3000";

let socket = null;

export function getSocket(token) {
  if (socket) return socket;

  socket = io(URL, {
    transports: ["websocket", "polling"],
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
    auth: { token },
  });

  socket.on("disconnect", (reason) => {
    console.log("DISCONNECTED:", reason);
  });

  socket.on("connect_error", (err) => {
    console.log("CONNECT ERROR:", err.message);
  });

  return socket;
}