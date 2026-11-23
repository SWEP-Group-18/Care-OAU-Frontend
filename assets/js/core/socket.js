export const socket = window.io(window.location.origin, {
    withCredentials: true,

    transports: ["polling"],
    upgrade: false,

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
