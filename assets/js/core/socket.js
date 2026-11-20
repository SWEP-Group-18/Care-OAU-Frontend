import { APP_CONFIG } from "./config.js";

const socketOrigin = APP_CONFIG.API_BASE_URL.startsWith("/")
    ? "https://care-oau-api.onrender.com"
    : new URL(APP_CONFIG.API_BASE_URL).origin;

export const socket = window.io(socketOrigin, {
    withCredentials: true,
});