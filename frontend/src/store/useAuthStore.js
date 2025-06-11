import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

updateProfile: async (data) => {
  set({ isUpdatingProfile: true });
  const authUser = get().authUser;
  if (!authUser) {
    toast.error("No authenticated user found");
    set({ isUpdatingProfile: false });
    return;
  }

  // Optimistic update
  const updatedUser = { ...authUser, profilePic: data.profilePic };
  set({ authUser: updatedUser });
  localStorage.setItem("authUser", JSON.stringify(updatedUser));
  toast.success("Profile updated locally");

  // If offline, queue the update
  if (!navigator.onLine) {
    console.log("User is offline, queuing profile update");
    const pendingUpdates = JSON.parse(localStorage.getItem("pendingProfileUpdates")) || [];
    pendingUpdates.push({ userId: authUser._id, ...data });
    localStorage.setItem("pendingProfileUpdates", JSON.stringify(pendingUpdates));
    set({ isUpdatingProfile: false });
    return;
  }

  // If online, sync immediately
  try {
    const res = await axiosInstance.put("/auth/update-profile", data);
    const updatedUserFromServer = res.data;
    set({ authUser: updatedUserFromServer });
    localStorage.setItem("authUser", JSON.stringify(updatedUserFromServer));
    toast.success("Profile updated successfully");
  } catch (error) {
    console.log("error in update profile:", error);
    set({ authUser });
    localStorage.setItem("authUser", JSON.stringify(authUser));
    toast.error(error.response?.data?.message || "Failed to update profile");
  } finally {
    set({ isUpdatingProfile: false });
  }
},

syncPendingProfileUpdates: async () => {
  if (!navigator.onLine) {
    console.log("User is still offline, cannot sync pending updates");
    return;
  }

  const pendingUpdates = JSON.parse(localStorage.getItem("pendingProfileUpdates")) || [];
  if (pendingUpdates.length === 0) {
    console.log("No pending profile updates to sync");
    return;
  }

  set({ isUpdatingProfile: true });
  console.log("Syncing pending profile updates:", pendingUpdates);
  const remainingUpdates = [];

  for (const update of pendingUpdates) {
    try {
      const res = await axiosInstance.put("/auth/update-profile", {
        profilePic: update.profilePic,
      });
      const updatedUserFromServer = res.data;
      set({ authUser: updatedUserFromServer });
      localStorage.setItem("authUser", JSON.stringify(updatedUserFromServer));
      toast.success("Synced profile update successfully");
    } catch (error) {
      console.error("Error syncing profile update:", error);
      toast.error(error.response?.data?.message || "Failed to sync profile update");
      remainingUpdates.push(update);
    }
  }

  localStorage.setItem("pendingProfileUpdates", JSON.stringify(remainingUpdates));
  set({ isUpdatingProfile: false });
},

  syncPendingProfileUpdates: async () => {
    if (!navigator.onLine) {
      console.log("User is still offline, cannot sync pending updates");
      return;
    }

    const pendingUpdates = JSON.parse(localStorage.getItem("pendingProfileUpdates")) || [];
    if (pendingUpdates.length === 0) {
      console.log("No pending profile updates to sync");
      return;
    }

    set({ isUpdatingProfile: true });
    console.log("Syncing pending profile updates:", pendingUpdates);
    const remainingUpdates = [];

    for (const update of pendingUpdates) {
      try {
        const res = await axiosInstance.put("/auth/update-profile", {
          profilePic: update.profilePic,
        });
        const updatedUserFromServer = res.data;
        set({ authUser: updatedUserFromServer });
        localStorage.setItem("authUser", JSON.stringify(updatedUserFromServer));
        toast.success("Synced profile update successfully");
      } catch (error) {
        console.error("Error syncing profile update:", error);
        toast.error(error.response?.data?.message || "Failed to sync profile update");
        remainingUpdates.push(update); // Keep failed updates in the queue
      }
    }

    // Update the pending updates queue
    localStorage.setItem("pendingProfileUpdates", JSON.stringify(remainingUpdates));
    set({ isUpdatingProfile: false });
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();

    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // Add listeners for newMessage and messageSeen events
    socket.on("newMessage", (newMessage) => {
      console.log("New message received in store:", newMessage);
    });

    socket.on("messageSeen", (updatedMessage) => {
      console.log("Message seen update received in store:", updatedMessage);
    });

    // Debug: Log successful connection
    socket.on("connect", () => {
      console.log("Connected to Socket.IO server:", socket.id);
    });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket?.connected) {
      // Remove event listeners to prevent memory leaks
      socket.off("getOnlineUsers");
      socket.off("newMessage");
      socket.off("messageSeen");
      socket.off("connect");

      socket.disconnect();
      set({ socket: null });
      console.log("Disconnected from Socket.IO server");
    }
  },
}));