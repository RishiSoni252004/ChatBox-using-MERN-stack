import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "", // Allow empty text for messages with only files
    },
  
    document: {
      type: {
        url: { type: String },
        filename: { type: String },
        mimetype: { type: String },
      },
      default: null, // Allow null for messages without documents
    },
    seen: {
      type: Boolean,
      default: false, // Default to false (unseen, single tick)
    },
    seenAt: {
      type: Date,
      default: null, // Default to null until the message is seen
    },
  },
  { timestamps: true } // Keep createdAt and updatedAt
);

const Message = mongoose.model("Message", messageSchema);

export default Message;