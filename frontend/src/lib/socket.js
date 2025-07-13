import { io } from "socket.io-client";

// Use your LAN IP and backend port for socket connection
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://192.168.1.39:5001";

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  transports: ["websocket"], // helps with some network issues
});

export default socket;
