
import { KeyPair } from '../types';

// Ensure nacl is available (it's loaded globally from CDN)
declare const nacl: any;

export const generateAppKeyPair = (): KeyPair => {
  if (typeof nacl === 'undefined') {
    throw new Error('TweetNaCl (nacl) is not loaded.');
  }
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  };
};

export const encodeBase64 = (data: Uint8Array): string => {
  return btoa(String.fromCharCode.apply(null, Array.from(data)));
};

export const decodeBase64 = (base64String: string): Uint8Array => {
  return Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
};

export const encryptText = (
  text: string,
  ownSecretKey: Uint8Array,
  peerPublicKey: Uint8Array
): { encryptedTextBase64: string; nonceBase64: string } | null => {
  if (typeof nacl === 'undefined') {
    console.error('TweetNaCl (nacl) is not loaded for encryption.');
    return null;
  }
  try {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = nacl.util.decodeUTF8(text);
    const encryptedMessage = nacl.box(messageUint8, nonce, peerPublicKey, ownSecretKey);

    return {
      encryptedTextBase64: encodeBase64(encryptedMessage),
      nonceBase64: encodeBase64(nonce),
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    return null;
  }
};

export const decryptText = (
  encryptedTextBase64: string,
  nonceBase64: string,
  ownSecretKey: Uint8Array,
  peerPublicKey: Uint8Array
): string | null => {
  if (typeof nacl === 'undefined') {
    console.error('TweetNaCl (nacl) is not loaded for decryption.');
    return null;
  }
  try {
    const nonce = decodeBase64(nonceBase64);
    const encryptedText = decodeBase64(encryptedTextBase64);
    const decryptedMessage = nacl.box.open(encryptedText, nonce, peerPublicKey, ownSecretKey);

    if (decryptedMessage) {
      return nacl.util.encodeUTF8(decryptedMessage);
    }
    return null; // Decryption failed (e.g., wrong key, corrupted message)
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
};
