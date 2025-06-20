
// Ensure nacl is available globally if using the CDN version directly in services
// Typically, you'd use import if it's a module: import nacl from 'tweetnacl';
// For CDN, you might need: declare const nacl: any; if not using a shim or d.ts file for it.
// However, since it's used in encryptionService.ts, it will be fine.

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export enum MessageType {
  TEXT = 'TEXT',
  FILE_INFO = 'FILE_INFO', // Info about a file
  SYSTEM = 'SYSTEM', // For system messages like connection status
  PUBLIC_KEY_SHARE = 'PUBLIC_KEY_SHARE',
  SDP_OFFER = 'SDP_OFFER',
  SDP_ANSWER = 'SDP_ANSWER',
  ICE_CANDIDATE = 'ICE_CANDIDATE',
}

export enum SystemMessageType {
  GENERAL = 'GENERAL',
  ERROR = 'ERROR',
  KEY_EXCHANGE = 'KEY_EXCHANGE',
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  WEBRTC_STATUS = 'WEBRTC_STATUS',
}


export interface BaseMessage {
  id: string;
  timestamp: number;
  senderPublicKeyBase64: string; // Keep track of who sent it for decryption
  type: MessageType;
}

export interface EncryptedTextMessage extends BaseMessage {
  type: MessageType.TEXT;
  encryptedText: string; // Base64 encoded encrypted text
  nonce: string; // Base64 encoded nonce
}

export interface FileInfo {
  name: string;
  size: number;
  fileType: string;
}
export interface EncryptedFileMessage extends BaseMessage {
  type: MessageType.FILE_INFO;
  fileInfo: FileInfo; // Basic info, actual file data would be chunked and sent separately in a real app
  encryptedFileInfoText: string; // Base64 encoded encrypted text of file info
  nonce: string; // Base64 encoded nonce
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
  publicKeyBase64: string;
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

// This is what gets stored in the messages array in context after decryption
export interface DecryptedMessage {
  id: string;
  timestamp: number;
  senderIsSelf: boolean;
  text?: string; // For text messages
  fileInfo?: FileInfo; // For file messages
  isSystem?: boolean; // For system messages
  systemType?: SystemMessageType; // For system messages
}

export interface BroadcastChannelMessage {
  type: MessageType;
  payload: any; 
  senderId: string; // Unique ID for the sender instance
}
