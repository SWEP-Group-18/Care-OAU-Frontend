import { APP_CONFIG } from "./config.js";

const hostname = window.location.hostname;

const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

const socketOrigin = new URL(
    APP_CONFIG.API_BASE_URL,
    window.location.origin
).origin;

export const socket = window.io(socketOrigin, {
    withCredentials: true,

    transports: ["polling"],
    upgrade: isLocal,

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
