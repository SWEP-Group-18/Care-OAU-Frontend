import { APP_CONFIG } from "./config.js";

const socketOrigin = APP_CONFIG.API_BASE_URL.startsWith("/")
    ? window.location.origin
    : new URL(APP_CONFIG.API_BASE_URL).origin;

export const socket = window.io(socketOrigin, {
    withCredentials: true,
});

socket.on("connect", () => {
    console.log("[Socket] Connected:", socket.id);
    console.log("[Socket] Transport:", socket.io.engine.transport.name);

    socket.io.engine.on("upgrade", (transport) => {
        console.log("[Socket] Upgraded to:", transport.name);
    });
});

socket.on("connect_error", (error) => {
    console.error("[Socket] Connection failed:", error.message);
});

socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
});