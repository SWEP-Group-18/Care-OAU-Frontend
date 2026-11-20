import { APP_CONFIG } from "./config.js";

const socketOrigin = APP_CONFIG.API_BASE_URL.startsWith("/")
    ? "https://care-oau-api.onrender.com"
    : new URL(APP_CONFIG.API_BASE_URL).origin;

export const socket = window.io(socketOrigin, {
    withCredentials: true,
});

socket.on("connect", ()=> {
    console.log(`[Socket] Connnected:`, socket.id)
});

socket.on("connect_error", (error) => {
    console.error("[Socket] Connection failed:", error.message);
});

socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
});