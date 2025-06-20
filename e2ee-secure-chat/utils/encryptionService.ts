import { KeyPair } from '../types';

// --- Base64 Helpers for ArrayBuffer/Uint8Array ---

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

export const uint8ArrayToBase64 = (arr: Uint8Array): string => {
  return arrayBufferToBase64(arr.buffer);
};

export const base64ToUint8Array = (base64: string): Uint8Array => {
  return new Uint8Array(base64ToArrayBuffer(base64));
};

// --- Web Crypto API Functions ---

export const generateAppKeyPair = async (): Promise<KeyPair> => {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // Can be exported (own private key needs to be exportable if you ever wanted to store it, though not used here)
      ['deriveKey'] // Usage for private key
    );
    // Ensure the generated keys are indeed CryptoKey for publicKey and privateKey
    if (!keyPair.publicKey || !keyPair.privateKey) {
        throw new Error("Generated key pair is invalid.");
    }
    return keyPair as KeyPair; // Cast to our KeyPair type
  } catch (error) {
    console.error("Error generating ECDH key pair:", error);
    throw new Error(`Key generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const exportPublicKeyJwk = async (publicKey: CryptoKey): Promise<JsonWebKey> => {
  try {
    return await crypto.subtle.exportKey('jwk', publicKey);
  } catch (error) {
    console.error("Error exporting public key to JWK:", error);
    throw new Error(`Key export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const importPublicKeyJwk = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  try {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false, // Imported public keys are generally not meant to be extractable.
      [] // Public key usage for ECDH derivation is typically empty.
    );
  } catch (error) {
    console.error("Error importing public key from JWK:", error);
    throw new Error(`Key import failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const deriveSharedSecret = async (ownPrivateKey: CryptoKey, peerPublicKey: CryptoKey): Promise<CryptoKey> => {
  try {
    return await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey, // Peer's public CryptoKey object
      },
      ownPrivateKey, // Your private CryptoKey object
      {
        name: 'AES-GCM', // Algorithm for the derived key
        length: 256,    // Key length for AES-256
      },
      false, // Derived key should NOT be extractable for security
      ['encrypt', 'decrypt'] // Usages for the derived AES key
    );
  } catch (error) {
    console.error("Error deriving shared secret:", error);
    throw new Error(`Shared secret derivation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const encryptText = async (
  text: string,
  aesKey: CryptoKey
): Promise<{ encryptedDataB64: string; ivB64: string } | null> => {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV for AES-GCM is standard
    const encodedText = new TextEncoder().encode(text);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      encodedText
    );

    return {
      encryptedDataB64: arrayBufferToBase64(encryptedBuffer),
      ivB64: uint8ArrayToBase64(iv),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
};

export const decryptText = async (
  encryptedDataB64: string,
  ivB64: string,
  aesKey: CryptoKey
): Promise<string | null> => {
  try {
    const iv = base64ToUint8Array(ivB64);
    const encryptedData = base64ToArrayBuffer(encryptedDataB64);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      encryptedData
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error)
 {
    // console.error('Decryption failed:', error); // Common if key is wrong or data corrupt
    return null;
  }
};