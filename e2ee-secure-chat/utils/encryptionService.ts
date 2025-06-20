import { KeyPair } from '../types';

// Libsodium will be available globally from the script tag in index.html
declare const sodium: any;

export const generateAppKeyPair = async (): Promise<KeyPair> => {
  if (typeof sodium === 'undefined' || typeof sodium.ready === 'undefined') {
    throw new Error('Libsodium (sodium) is not loaded.');
  }
  await sodium.ready; // Ensure libsodium is ready
  const keyPair = sodium.crypto_box_keypair();
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey, // Libsodium uses privateKey
  };
};

export const encodeBase64 = (data: Uint8Array): string => {
  if (typeof sodium === 'undefined' || typeof sodium.ready === 'undefined') {
    console.error('Libsodium (sodium) is not loaded for encoding.');
    return ''; // Or throw error
  }
  // Assuming sodium is ready as this is a utility called after main init
  return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
};

export const decodeBase64 = (base64String: string): Uint8Array => {
  if (typeof sodium === 'undefined' || typeof sodium.ready === 'undefined') {
    console.error('Libsodium (sodium) is not loaded for decoding.');
    return new Uint8Array(0); // Or throw error
  }
  // Assuming sodium is ready
  return sodium.from_base64(base64String, sodium.base64_variants.ORIGINAL);
};

export const encryptText = async (
  text: string,
  ownPrivateKey: Uint8Array, // Changed from secretKey
  peerPublicKey: Uint8Array
): Promise<{ encryptedTextBase64: string; nonceBase64: string } | null> => {
  if (typeof sodium === 'undefined' || typeof sodium.ready === 'undefined') {
    console.error('Libsodium (sodium) is not loaded for encryption.');
    return null;
  }
  await sodium.ready;
  try {
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const messageUint8 = sodium.from_string(text);
    const encryptedMessage = sodium.crypto_box_easy(messageUint8, nonce, peerPublicKey, ownPrivateKey);

    return {
      encryptedTextBase64: encodeBase64(encryptedMessage),
      nonceBase64: encodeBase64(nonce),
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    return null;
  }
};

export const decryptText = async (
  encryptedTextBase64: string,
  nonceBase64: string,
  ownPrivateKey: Uint8Array, // Changed from secretKey
  peerPublicKey: Uint8Array
): Promise<string | null> => {
  if (typeof sodium === 'undefined' || typeof sodium.ready === 'undefined') {
    console.error('Libsodium (sodium) is not loaded for decryption.');
    return null;
  }
  await sodium.ready;
  try {
    const nonce = decodeBase64(nonceBase64);
    const encryptedText = decodeBase64(encryptedTextBase64);
    const decryptedMessage = sodium.crypto_box_open_easy(encryptedText, nonce, peerPublicKey, ownPrivateKey);

    if (decryptedMessage) {
      return sodium.to_string(decryptedMessage);
    }
    return null; // Decryption failed
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
};