import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
    "http://localhost:5173",
    "http://192.168.1.5:5173",
    "http://172.20.10.4:5173"
        ],
        credentials: true, // Allow cookies to be sent with requests
    },
});

const userSocketMap = {};

export function getReceiverSocketId(userId) {
    console.log(`Looking up socket ID for user ${userId}:`, userSocketMap[userId] || "Not found"); // Debug: Confirm mapping
    return userSocketMap[userId];
}

io.on("connection", (Socket) => {
    const userId = Socket.handshake.query.userId;
    console.log("A user connected:", userId, Socket.id); // Debug: Log userId and socketId

    if (userId) {
        userSocketMap[userId] = Socket.id;
        console.log("Current userSocketMap:", userSocketMap); // Debug: Log entire map
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }

    Socket.on("reconnectUser", (reconnectedUserId) => {
        console.log("User reconnected:", reconnectedUserId, Socket.id); // Debug: Confirm reconnection
        userSocketMap[reconnectedUserId] = Socket.id;
        console.log("Updated userSocketMap after reconnect:", userSocketMap); // Debug
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });

    Socket.on("disconnect", () => {
        console.log("A user disconnected:", userId, Socket.id); // Debug: Log userId and socketId
        if (userId) {
            delete userSocketMap[userId];
            console.log("Updated userSocketMap after disconnect:", userSocketMap); // Debug
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
        }
    });
});

export { io, app, server };