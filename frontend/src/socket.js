import { io } from "socket.io-client";

const URL = "http://127.0.0.1:3000";

const socket = import.meta.hot?.data.socket ?? io(URL, {
  transports: ["websocket"],
  reconnectionAttempts: 3,
  reconnectionDelay: 2000,
});

// Debug — tell us why it's disconnecting
socket.on("disconnect", (reason) => {
  console.log("DISCONNECTED:", reason);
});

socket.on("connect_error", (err) => {
  console.log("CONNECT ERROR:", err.message);
});

if (import.meta.hot) {
  import.meta.hot.data.socket = socket;
  import.meta.hot.accept();
}

export { socket };