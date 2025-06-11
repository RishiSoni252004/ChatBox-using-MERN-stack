import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error fetching users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      console.log("Fetched messages:", res.data); // Debug: Check initial messages
      // Ensure messages is always an array
      const fetchedMessages = Array.isArray(res.data) ? res.data : [];
      set({ messages: fetchedMessages });
      const authUser = useAuthStore.getState().authUser;
      if (authUser) {
        const unseenMessages = fetchedMessages.filter(
          (msg) => msg.receiverId === authUser._id && !msg.seen
        );
        if (unseenMessages.length > 0) {
          try {
            await axiosInstance.post("/messages/mark-seen", {
              messageIds: unseenMessages.map((msg) => msg._id),
            });
            set((state) => {
              const currentMessages = Array.isArray(state.messages) ? state.messages : [];
              return {
                messages: currentMessages.map((msg) =>
                  unseenMessages.some((um) => um._id === msg._id)
                    ? { ...msg, seen: true, seenAt: new Date() }
                    : msg
                ),
              };
            });
          } catch (error) {
            console.warn("Mark-seen endpoint not found, using local state:", error.message);
            set((state) => {
              const currentMessages = Array.isArray(state.messages) ? state.messages : [];
              return {
                messages: currentMessages.map((msg) =>
                  unseenMessages.some((um) => um._id === msg._id)
                    ? { ...msg, seen: true, seenAt: new Date() }
                    : msg
                ),
              };
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error.response?.data || error.message);
      toast.error(error.response?.data?.message || "Error fetching messages");
      set({ messages: [] }); // Fallback to empty array on error
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, {
        ...messageData,
        seen: false,
      });
      console.log("Sent message:", res.data); // Debug: Check sent message
      const currentMessages = Array.isArray(messages) ? messages : [];
      set({ messages: [...currentMessages, res.data] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error sending message");
    }
  },

  sendDocument: async (documentFile) => {
    const { selectedUser, messages } = get();
    if (!selectedUser) {
      toast.error("No user selected");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!allowedTypes.includes(documentFile.type)) {
      toast.error("Only PDF, Word, TXT, Excel, and PowerPoint files are allowed");
      return;
    }

    set({ isMessagesLoading: true });
    try {
      const formData = new FormData();
      formData.append("document", documentFile);

      const res = await axiosInstance.post(`/messages/send-document/${selectedUser._id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const originalFilename = res.data.originalFilename || documentFile.name;
      const currentMessages = Array.isArray(messages) ? messages : [];
      set({ messages: [...currentMessages, { ...res.data, document: { ...res.data.document, originalFilename } }] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error sending document");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

 subscribeToMessages: () => {
  const { selectedUser } = get();
  if (!selectedUser) return;

  const socket = useAuthStore.getState().socket;
  const authUser = useAuthStore.getState().authUser;

  if (!socket || !authUser) {
    console.error("Socket or authUser not available");
    return;
  }

  console.log(`Subscribing to messages for user ${authUser._id}, socket ID: ${socket.id}, connected: ${socket.connected}`);

  socket.on("newMessage", (newMessage) => {
    console.log("Received newMessage event:", newMessage);
    const isMessageForCurrentChat =
      newMessage.senderId === selectedUser._id ||
      newMessage.receiverId === selectedUser._id;

    if (isMessageForCurrentChat) {
      set((state) => {
        const currentMessages = Array.isArray(state.messages) ? state.messages : [];
        return { messages: [...currentMessages, newMessage] };
      });

      if (newMessage.receiverId === authUser._id && !newMessage.seen) {
        axiosInstance
          .post("/messages/mark-seen", { messageIds: [newMessage._id] })
          .then(() => {
            set((state) => {
              const currentMessages = Array.isArray(state.messages) ? state.messages : [];
              return {
                messages: currentMessages.map((msg) =>
                  msg._id === newMessage._id
                    ? { ...msg, seen: true, seenAt: new Date() }
                    : msg
                ),
              };
            });
            // Removed: socket.emit("messageSeen", ...), as backend already handles this
          })
          .catch((error) => {
            console.warn("Mark-seen endpoint not found, using local state:", error.message);
            set((state) => {
              const currentMessages = Array.isArray(state.messages) ? state.messages : [];
              return {
                messages: currentMessages.map((msg) =>
                  msg._id === newMessage._id
                    ? { ...msg, seen: true, seenAt: new Date() }
                    : msg
                ),
              };
            });
          });
      }
    }
  });

  socket.on("messageSeen", (updatedMessage) => {
    console.log("Received messageSeen event:", updatedMessage);
    if (!updatedMessage.seenAt) {
      console.warn("seenAt is missing in updatedMessage:", updatedMessage);
    }
    set((state) => {
      const currentMessages = Array.isArray(state.messages) ? state.messages : [];
      const updatedMessages = currentMessages.map((msg) => {
        const msgId = msg._id.toString();
        const updatedMsgId = updatedMessage._id.toString();
        console.log(`Comparing IDs: msg._id=${msgId}, updatedMessage._id=${updatedMsgId}`);
        if (msgId === updatedMsgId) {
          console.log("Updating message with:", updatedMessage);
          return { ...msg, seen: updatedMessage.seen, seenAt: updatedMessage.seenAt };
        }
        return msg;
      });
      console.log("Updated messages state:", updatedMessages);
      return { messages: updatedMessages };
    });
  });

  return () => {
    console.log("Unsubscribing from messages");
    socket.off("newMessage");
    socket.off("messageSeen");
  };
},

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("messageSeen");
    }
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),

  setMessages: (newMessages) => {
    const messagesToSet = Array.isArray(newMessages) ? newMessages : [];
    console.log("Setting messages:", messagesToSet); // Debug: Check what is being set
    set({ messages: messagesToSet });
  },
}));