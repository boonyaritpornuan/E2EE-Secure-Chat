export interface KeyPair {
  publicKey: CryptoKey; // Web Crypto API native key object
  privateKey: CryptoKey; // Web Crypto API native key object
}

export enum MessageType {
  TEXT = 'TEXT',
  FILE_INFO = 'FILE_INFO',
  SYSTEM = 'SYSTEM',
  // Signaling types (handled via Socket.io now, but good to keep for reference or fallback)
  PUBLIC_KEY_SHARE = 'PUBLIC_KEY_SHARE',
  SDP_OFFER = 'SDP_OFFER',
  SDP_ANSWER = 'SDP_ANSWER',
  ICE_CANDIDATE = 'ICE_CANDIDATE',
}

export interface UserProfile {
  socketId: string;
  username: string;
  publicKey: JsonWebKey;
  avatarColor?: string; // Optional, generated locally
  isOnline?: boolean;
}

export enum SystemMessageType {
  GENERAL = 'GENERAL',
  ERROR = 'ERROR',
  KEY_EXCHANGE = 'KEY_EXCHANGE',
  CRYPTO_STATUS = 'CRYPTO_STATUS', // For Web Crypto specific statuses
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  WEBRTC_STATUS = 'WEBRTC_STATUS',
}


export interface BaseMessage {
  id: string;
  timestamp: number;
  senderPublicKeyJwkString: string; // Stringified JWK of sender's ECDH public key
  type: MessageType;
}

export interface EncryptedTextMessage extends BaseMessage {
  type: MessageType.TEXT;
  encryptedDataB64: string; // Base64 encoded encrypted ArrayBuffer
  ivB64: string; // Base64 encoded IV (Uint8Array)
  isDirect?: boolean; // Added for DM distinction
}

export interface FileInfo {
  name: string;
  size: number;
  fileType: string;
}
export interface EncryptedFileMessage extends BaseMessage {
  type: MessageType.FILE_INFO;
  fileInfo: FileInfo;
  encryptedFileInfoDataB64: string; // Base64 encoded encrypted ArrayBuffer of file info
  ivB64: string; // Base64 encoded IV
}

export interface SystemMessage {
  id: string;
  timestamp: number;
  type: MessageType.SYSTEM;
  systemType: SystemMessageType;
  text: string;
}

export interface PublicKeyShareMessage {
  type: MessageType.PUBLIC_KEY_SHARE;
  publicKeyJwk: JsonWebKey; // Public key in JWK format
}

export interface SdpSignalMessage {
  type: MessageType.SDP_OFFER | MessageType.SDP_ANSWER;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidateSignalMessage {
  type: MessageType.ICE_CANDIDATE;
  candidate: RTCIceCandidateInit;
}

export type ChatMessageContent = EncryptedTextMessage | EncryptedFileMessage | SystemMessage;

export interface DecryptedMessage {
  id: string;
  timestamp: number;
  senderIsSelf: boolean;
  senderName?: string; // Added for UI display
  senderSocketId?: string; // Added for DM filtering
  targetSocketId?: string; // Added for DM filtering
  isDirect?: boolean;      // Added for DM distinction
  text?: string;
  fileInfo?: FileInfo;
  isSystem?: boolean;
  systemType?: SystemMessageType;
}

export interface BroadcastChannelMessage {
  type: MessageType;
  payload: any;
  senderId: string; // Unique ID for the sender instance (tab/window)
}