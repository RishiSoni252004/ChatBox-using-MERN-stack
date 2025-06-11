import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMesssage = async (req, res) => {
  try {
    const { text } = req.body; // Text is optional
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // Create new message with text only
    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "", // Allow empty text
      seen: false,
    }); 

    await newMessage.save();

    // Emit the new message to the receiver and sender via socket
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMesssage: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsSeen = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const authUserId = req.user._id;

    console.log("Marking messages as seen for user:", authUserId, "Message IDs:", messageIds); // Debug

    const updatedMessages = await Message.updateMany(
      { _id: { $in: messageIds }, receiverId: authUserId, seen: false },
      { $set: { seen: true, seenAt: new Date() } }
    );

    console.log("Updated messages count:", updatedMessages.modifiedCount); // Debug: Confirm update

    if (updatedMessages.modifiedCount > 0) {
      const messages = await Message.find({ _id: { $in: messageIds } });
      console.log("Messages to emit:", messages); // Debug: Confirm message data

      messages.forEach((msg) => {
        const receiverSocketId = getReceiverSocketId(msg.receiverId);
        if (receiverSocketId) {
          console.log("Emitting messageSeen to receiver:", msg.receiverId, receiverSocketId); // Debug
          io.to(receiverSocketId).emit("messageSeen", msg);
        }
        const senderSocketId = getReceiverSocketId(msg.senderId);
        if (senderSocketId) {
          console.log("Emitting messageSeen to sender:", msg.senderId, senderSocketId); // Debug
          io.to(senderSocketId).emit("messageSeen", msg);
        } else {
          console.log("Sender not connected:", msg.senderId); // Debug: Confirm sender is not mapped
        }
      });
    } else {
      console.log("No messages updated for marking as seen"); // Debug
    }

    res.status(200).json({
      success: true,
      updatedCount: updatedMessages.modifiedCount,
    });
  } catch (error) {
    console.error("Error in markMessagesAsSeen: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessageWithDocument = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const documentFile = req.file;

    if (!documentFile) {
      return res.status(400).json({ message: "No document file uploaded" });
    }

    // Validate MIME type
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!allowedMimeTypes.includes(documentFile.mimetype)) {
      return res.status(400).json({
        message: "Invalid file type. Only PDF, Word, TXT, Excel, and PowerPoint files are allowed",
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    console.log("Uploaded document path:", documentFile.path);
    console.log("Uploaded document filename:", documentFile.filename);
    console.log("Uploaded document mimetype:", documentFile.mimetype);

    const documentUrl = `/download/document/${documentFile.filename}`; // Matches /download/document/ in index.js

    const newMessage = new Message({
      senderId,
      receiverId,
      document: {
        url: documentUrl,
        originalFilename: documentFile.originalname, // Add original filename
        filename: documentFile.filename, // Stored filename
        mimetype: documentFile.mimetype,
      },
      seen: false,
    });

    await newMessage.save();

    // Emit the new message to the receiver and sender via socket
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessageWithDocument:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

