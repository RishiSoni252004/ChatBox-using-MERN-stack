import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { FileText, FileSpreadsheet, FileBarChart } from "lucide-react";
import axios from "axios";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    setMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    if (selectedUser) {
      console.log(`Fetching messages for user ${selectedUser._id}`); // Debug: Confirm fetch
      getMessages(selectedUser._id);
      subscribeToMessages();
    }
    return () => unsubscribeFromMessages();
  }, [selectedUser, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    console.log("Messages state in ChatContainer:", messages); // Debug: Check messages state
    if (messageEndRef.current && Array.isArray(messages)) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Polling fallback to ensure message updates
  useEffect(() => {
    if (!selectedUser) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/messages/${selectedUser._id}`, {
          headers: { Authorization: `Bearer ${authUser.token}` },
        });
        console.log("Polled messages:", res.data); // Debug: Check polled messages
        setMessages(res.data);
      } catch (error) {
        console.error("Error polling messages:", error.response?.data || error.message);
        setMessages([]); // Fallback to empty array on error
      }
    }, 9000000); 

    return () => clearInterval(interval);
  }, [selectedUser, authUser, setMessages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  const BASE_URL = "http://localhost:5001";

  const getFileIcon = (mimetype) => {
    switch (mimetype) {
      case "application/pdf":
        return <FileText size={20} className="text-blue-500" />;
      case "application/msword":
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return <FileText size={20} className="text-blue-600" />;
      case "text/plain":
        return <FileText size={20} className="text-gray-500" />;
      case "application/vnd.ms-excel":
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return <FileSpreadsheet size={20} className="text-green-500" />;
      case "application/vnd.ms-powerpoint":
      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        return <FileBarChart size={20} className="text-orange-500" />;
      default:
        return <FileText size={20} className="text-blue-500" />;
    }
  };

  // Ensure messages is an array before rendering
  const renderMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderMessages.length === 0 ? (
          <p className="text-center text-gray-500">No messages yet. Start the conversation!</p>
        ) : (
          renderMessages.map((message) => {
            console.log(`Rendering message ${message._id}:`, {
              seen: message.seen,
              seenAt: message.seenAt,
              formattedSeenAt: message.seenAt ? formatMessageTime(message.seenAt) : "Not seen yet",
            }); // Enhanced debug
            return (
              <div
                key={message._id}
                className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
              >
                <div className="chat-image avatar">
                  <div className="size-10 rounded-full border">
                    <img
                      src={
                        message.senderId === authUser._id
                          ? authUser.profilePic || "/avatar.png"
                          : selectedUser.profilePic || "/avatar.png"
                      }
                      alt="profile pic"
                    />
                  </div>
                </div>
                <div className="chat-header mb-1">
                  <time className="text-xs opacity-50 ml-1">
                    {formatMessageTime(message.createdAt)}
                  </time>
                </div>
                <div className="chat-bubble flex flex-col">
                  {message.text && <p>{message.text}</p>}
                  {message.document && (
                    <div className="flex items-center gap-2 mt-2">
                      {getFileIcon(message.document.mimetype)}
                      <a
                        href={`${BASE_URL}${message.document.url}`}
                        download={message.document.originalFilename || message.document.filename}
                        className="text-blue-500 hover:underline"
                      >
                        {message.document.originalFilename || message.document.filename}
                      </a>
                    </div>
                  )}
                  {message.senderId === authUser._id && (
                    <div className="self-end text-xs mt-1">
                      {message.seen ? (
                        <span className="text-blue-500">✓✓</span>
                      ) : (
                        <span className="text-gray-500">✓</span>
                      )}
                      {message.seen && message.seenAt && (
                        <span className="ml-2 text-gray-500">
                          Seen at {formatMessageTime(message.seenAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;