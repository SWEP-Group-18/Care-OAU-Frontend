import { APP_CONFIG } from "./config.js";

const socketOrigin = APP_CONFIG.API_BASE_URL.startsWith("/")
    ? window.location.origin
    : new URL(APP_CONFIG.API_BASE_URL).origin;

export const socket = window.io(socketOrigin, {
    withCredentials: true,

    transports: ["websocket", "polling"],
    upgrade: true,

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    timeout: 20000
});

socket.on("connect", () => {
    console.log("[Socket] Connected:", socket.id);
    console.log("[Socket] Transport:", socket.io.engine.transport.name);
});

socket.on("connect_error", (error) => {
    console.error("[Socket] Connection failed:", error.message);
});

socket.on("disconnect", (reason) => {
    console.warn("[Socket] Disconnected:", reason);
});

socket.io.on("reconnect", (attempt) => {
    console.log("[Socket] Reconnected after attempts:", attempt);
});