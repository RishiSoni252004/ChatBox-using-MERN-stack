import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  getUsersForSidebar,
  sendMesssage,
  markMessagesAsSeen,
  sendMessageWithDocument,
} from "../controllers/message.controller.js";

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure directories exist at the root level
const uploadDir = path.join(__dirname, "../uploads"); // For documents (PDF, Word, TXT, Excel, PPT)

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for document uploads (PDF, Word, TXT, Excel, PPT)
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname;
    let filename = originalName;

    // Check if file already exists and append a number if needed
    let counter = 1;
    while (fs.existsSync(path.join(uploadDir, filename))) {
      const ext = path.extname(originalName);
      const nameWithoutExt = path.basename(originalName, ext);
      filename = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
    }

    cb(null, filename); // Use the adjusted filename
  },
});

const documentUpload = multer({
  storage: documentStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf", // PDF
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "text/plain", // .txt
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-powerpoint", // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Word, TXT, Excel, and PowerPoint files are allowed"), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Configure multer for image uploads (removed as per previous requests)

// Routes
router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMesssage);
router.post("/mark-seen", protectRoute, markMessagesAsSeen);
router.post("/send-document/:id", protectRoute, documentUpload.single("document"), sendMessageWithDocument);

export default router;