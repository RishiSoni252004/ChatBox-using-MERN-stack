import { io } from "socket.io-client";

// Use your LAN IP and backend port for socket connection
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://172.20.10.4:5001";

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  transports: ["websocket"],
  // Pass userId as query if needed:
  // query: { userId: <your_user_id> }
});

export default socket;
