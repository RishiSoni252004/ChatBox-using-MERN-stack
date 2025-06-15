import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import fs from "fs";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const LAN_IP = process.env.LAN_IP || "localhost";
const _dirname = path.resolve();

// ✅ CORS for LAN access and credentials (cookies)
app.use(cors({
  origin: [
    "http://localhost:5173",
    `http://${LAN_IP}:5173`
  ],
  credentials: true,
}));

// ✅ Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// ✅ Serve uploaded files
app.use("/uploads", express.static(path.join(_dirname, "uploads")));

// ✅ Attach socket server instance to every request
app.use((req, res, next) => {
  req.io = server;
  next();
});

// ✅ Test route for connectivity
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "Backend is reachable!" });
});

// ✅ Auth cookie check route
app.get("/api/check-auth", (req, res) => {
  const token = req.cookies.token;
  res.json({ token, msg: token ? "Token received" : "No token" });
});

// ✅ Ping route (quick health check)
app.get("/ping", (req, res) => res.send("pong"));

// ✅ Document download route
app.get("/download/document/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(_dirname, "uploads", filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Document not found");
  }

  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// ✅ Serve frontend build in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(_dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(_dirname, "../frontend/dist", "index.html"));
  });
}

// ✅ Start server on LAN
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://${LAN_IP}:${PORT}`);
  connectDB();
});
