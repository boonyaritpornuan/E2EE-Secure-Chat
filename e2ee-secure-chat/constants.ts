
export const APP_NAME = "benull.";
export const MAX_ROOM_ID_LENGTH = 12;
export const LOCAL_STORAGE_KEY_PREFIX = "e2eeChat_";
export const MESSAGE_EXPIRY_TIMER_OPTIONS = [
  { value: 0, label: "Never Delete" },
  { value: 300000, label: "5 Minutes" }, // 5 * 60 * 1000
  { value: 3600000, label: "1 Hour" },   // 60 * 60 * 1000
  { value: 86400000, label: "1 Day" },   // 24 * 60 * 60 * 1000
];
export const DEFAULT_MESSAGE_EXPIRY_MS = 0; // Never delete by default
export const APP_VERSION = "1.0.1";
