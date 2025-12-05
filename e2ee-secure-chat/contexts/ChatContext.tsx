import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { APP_VERSION } from '../constants';
import { KeyPair, DecryptedMessage, MessageType, EncryptedTextMessage, UserProfile, SystemMessageType } from '../types';
import {
  generateAppKeyPair,
  encryptText,
  decryptText,
  exportPublicKeyJwk,
  importPublicKeyJwk,
  deriveSharedSecret,
} from '../utils/encryptionService';
import { generateRandomIdentity, getStoredIdentity, storeIdentity, UserIdentity } from '../utils/userManager';

const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'https://e2ee-secure-chat-njzy.onrender.com';

import { FileTransferManager, FileTransferState } from '../utils/FileTransferManager';
import { getKey, storeKey } from '../utils/keyStorage';

interface ChatContextType {
  roomId: string | null;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;

  userIdentity: UserIdentity | null;
  ownKeyPair: KeyPair | null;
  activeUsers: UserProfile[];

  messages: DecryptedMessage[];
  directMessages: Record<string, DecryptedMessage[]>;
  sendMessage: (text: string) => Promise<void>;

  // File Sharing (Legacy Offer/Accept)
  sendFileOffer: (file: File, targetSocketId: string) => void;
  acceptFileOffer: (senderSocketId: string) => void;
  declineFileOffer: (senderSocketId: string) => void;
  fileOffers: Array<{ senderSocketId: string, fileMetadata: any }>;

  // New Chunk-based File Transfer
  activeTransfers: Record<string, FileTransferState>;
  startFileTransfer: (file: File, targetSocketId: string) => Promise<void>;
  acceptFileTransfer: (transferId: string) => void;
  declineFileTransfer: (transferId: string) => void;
  cancelTransfer: (transferId: string) => void;

  cryptoStatusMessage: string | null;
  activeChatTarget: string | 'ROOM';
  setActiveChatTarget: (target: string | 'ROOM', username?: string) => void;
  unreadCounts: Record<string, number>;
  setPendingTargetUser: (username: string | null) => void;
  findUser: (username: string) => Promise<UserProfile | null>;
  chatRequests: Array<{ senderSocketId: string, senderUsername: string }>;
  startDirectChat: (targetUsername: string) => Promise<void>;
  acceptDirectChat: (targetSocketId: string, targetUsername: string) => Promise<void>;
  closeDirectChat: (targetSocketId: string) => void;
  getSafetyNumber: (targetSocketId: string) => Promise<string | null>;
  fetchServerStats: () => Promise<any>;
  typingUsers: string[];
  sendTyping: (isTyping: boolean) => void;
  updateRequired: boolean;
  updateAvailable: boolean;
  checkUserOnline: (username: string) => Promise<boolean>;
  refreshActiveUsers: () => void;
  chatEnded: boolean;
  resetChatEnded: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);
  const [ownKeyPair, setOwnKeyPair] = useState<KeyPair | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);

  // Separate Message Stores
  const [roomMessages, setRoomMessages] = useState<DecryptedMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<Record<string, DecryptedMessage[]>>({}); // Key: Username

  const [cryptoStatusMessage, setCryptoStatusMessage] = useState<string | null>("Initializing...");
  const [activeChatTarget, setActiveChatTarget] = useState<string | 'ROOM'>('ROOM');
  const [activeChatUsername, setActiveChatUsername] = useState<string | null>(null);

  // Computed messages property for consumers
  const messages = activeChatTarget === 'ROOM'
    ? roomMessages
    : (activeChatUsername ? (directMessages[activeChatUsername] || []) : []);

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [pendingTargetUser, setPendingTargetUser] = useState<string | null>(null);
  const [chatRequests, setChatRequests] = useState<Array<{ senderSocketId: string, senderUsername: string }>>([]);

  const [fileOffers, setFileOffers] = useState<Array<{ senderSocketId: string, fileMetadata: any }>>([]);
  const [activeTransfers, setActiveTransfers] = useState<Record<string, FileTransferState>>({});
  const [chatEnded, setChatEnded] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const sharedSecretsRef = useRef<Map<string, CryptoKey>>(new Map());

  const ownKeyPairRef = useRef<KeyPair | null>(null);
  const activeUsersRef = useRef<UserProfile[]>([]);
  const activeChatTargetRef = useRef<string | 'ROOM'>('ROOM');
  const activeChatUsernameRef = useRef<string | null>(null);
  const pendingTargetUserRef = useRef<string | null>(null);
  const activeTransfersRef = useRef<Record<string, FileTransferState>>({});

  // Track processed transfers to prevent duplicates (Persistent across renders)
  // Track processed transfers to prevent duplicates (Persistent across renders)
  const processedTransferIds = useRef(new Set<string>());

  // Store file chunks outside of React state for performance and stability
  const fileChunksRef = useRef<Map<string, Map<number, ArrayBuffer>>>(new Map());

  useEffect(() => { ownKeyPairRef.current = ownKeyPair; }, [ownKeyPair]);
  useEffect(() => { activeUsersRef.current = activeUsers; }, [activeUsers]);
  useEffect(() => { activeChatTargetRef.current = activeChatTarget; }, [activeChatTarget]);
  useEffect(() => { activeChatUsernameRef.current = activeChatUsername; }, [activeChatUsername]);
  useEffect(() => { pendingTargetUserRef.current = pendingTargetUser; }, [pendingTargetUser]);
  useEffect(() => { activeTransfersRef.current = activeTransfers; }, [activeTransfers]);

  // Define addSystemMessage FIRST to avoid hoisting issues
  const addSystemMessage = useCallback((text: string, systemType: SystemMessageType = SystemMessageType.GENERAL, options?: { isDirect?: boolean, peerId?: string, peerUsername?: string }) => {
    const newMessage = {
      id: `sys-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      text,
      isSystem: true,
      senderIsSelf: false,
      systemType,
      isDirect: options?.isDirect,
      senderSocketId: options?.peerId,
      targetSocketId: options?.peerId
    };

    if (options?.isDirect) {
      // We need a username to store this in directMessages
      let targetUsername = options.peerUsername;

      // Try to find username if not provided
      if (!targetUsername && options.peerId) {
        const user = activeUsersRef.current.find(u => u.socketId === options.peerId);
        if (user) targetUsername = user.username;
      }

      // Fallback: If we still don't have a username, we might be in trouble.
      // But if we are the sender, we might know who we are talking to via activeChatUsernameRef
      if (!targetUsername && activeChatTargetRef.current !== 'ROOM' && activeChatTargetRef.current === options.peerId) {
        targetUsername = activeChatUsernameRef.current || undefined;
      }

      if (targetUsername) {
        setDirectMessages(prev => ({
          ...prev,
          [targetUsername!]: [...(prev[targetUsername!] || []), newMessage]
        }));
      } else {
        console.warn("Could not determine username for direct system message:", text);
        // Fallback to room? Or just drop? Better to drop than leak.
      }
    } else {
      setRoomMessages(prev => [...prev, newMessage]);
    }
  }, []);

  useEffect(() => {
    const initIdentityAndKeys = async () => {
      let identity = getStoredIdentity();
      if (!identity) {
        identity = generateRandomIdentity();
        storeIdentity(identity);
      }
      setUserIdentity(identity);

      setCryptoStatusMessage("Loading identity keys...");

      try {
        // Try to load existing keys from IndexedDB
        const storedPublicKey = await getKey('publicKey');
        const storedPrivateKey = await getKey('privateKey');

        if (storedPublicKey && storedPrivateKey) {

          setOwnKeyPair({ publicKey: storedPublicKey, privateKey: storedPrivateKey });
          setCryptoStatusMessage("Ready (Restored).");
        } else {
          // Generate new keys if not found

          setCryptoStatusMessage("Generating identity keys...");
          const keys = await generateAppKeyPair();

          // Store new keys
          await storeKey('publicKey', keys.publicKey);
          await storeKey('privateKey', keys.privateKey);

          setOwnKeyPair(keys);
          setCryptoStatusMessage("Ready (New).");
        }
      } catch (err) {
        console.error("Failed to load/save keys:", err);
        setCryptoStatusMessage("Key Error. Check Console.");
      }
    };
    initIdentityAndKeys();
  }, []);

  const refreshActiveUsers = useCallback(() => {
    if (socketRef.current && roomId && roomId !== 'Direct Chat') {
      socketRef.current.emit('get-room-users');
    }
  }, [roomId]);

  // Periodic Refresh (Pulse)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshActiveUsers();
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [refreshActiveUsers]);

  const handleSetActiveChatTarget = (target: string | 'ROOM', username?: string) => {
    setActiveChatTarget(target);

    if (target === 'ROOM') {
      setActiveChatUsername(null);
    } else {
      if (username) {
        setActiveChatUsername(username);
      } else {
        // Try to find username from activeUsers if not provided
        const user = activeUsersRef.current.find(u => u.socketId === target);
        if (user) setActiveChatUsername(user.username);
      }
    }

    // Clear unread count for this target
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[target];
      return newCounts;
    });
    setChatRequests(prev => prev.filter(req => req.senderSocketId !== target));
  };

  const findUser = async (username: string): Promise<UserProfile | null> => {
    if (!socketRef.current) return null;
    return new Promise((resolve) => {
      socketRef.current?.emit('find-user', username, (response: { found: boolean, user?: UserProfile }) => {
        if (response.found && response.user) {
          resolve(response.user);
        } else {
          resolve(null);
        }
      });
    });
  };

  // Helper to update transfer state safely
  const updateTransferState = (id: string, updates: Partial<FileTransferState>) => {
    setActiveTransfers(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  // Track sending state to prevent double clicks
  const isSendingRef = useRef(false);

  const startFileTransfer = async (file: File, targetSocketId: string) => {
    if (!socketRef.current || isSendingRef.current) return;
    isSendingRef.current = true;

    try {
      // Helper to initiate transfer for a single peer
      const initiateTransfer = async (peerId: string) => {
        const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const transferState: FileTransferState = {
          transferId,
          fileId: transferId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          chunksTotal: totalChunks,
          chunksReceived: 0,
          progress: 0,
          status: 'pending',
          isUpload: true,
          peerSocketId: peerId,
          startTime: Date.now(),
          isDirect: targetSocketId !== 'ROOM',
          peerUsername: targetSocketId !== 'ROOM' ? activeUsers.find(u => u.socketId === targetSocketId)?.username : undefined
        };

        // Store chunks
        if (!(window as any).pendingFileChunks) {
          (window as any).pendingFileChunks = new Map();
        }
        (window as any).pendingFileChunks.set(transferId, chunks);

        // Update Ref IMMEDIATELY (Critical for consistency)
        activeTransfersRef.current[transferId] = transferState;

        // Update State
        setActiveTransfers(prev => ({ ...prev, [transferId]: transferState }));

        socketRef.current?.emit('file-offer', {
          targetSocketId: peerId,
          metadata: {
            transferId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            totalChunks,
            isDirect: targetSocketId !== 'ROOM'
          }
        });
      };

      // Slice file once
      const chunks = await FileTransferManager.sliceFile(file);
      const totalChunks = chunks.length;

      if (targetSocketId === 'ROOM') {
        // Broadcast to all users in room (excluding self)
        // Deduplicate peers based on socketId to prevent double sending
        const uniquePeersMap = new Map<string, UserProfile>();
        activeUsers.forEach(u => {
          if (u.socketId !== socketRef.current?.id && u.isOnline) {
            uniquePeersMap.set(u.socketId, u);
          }
        });
        const peers = Array.from(uniquePeersMap.values());


        if (peers.length === 0) {
          addSystemMessage("No other users in room to send file to.", SystemMessageType.ERROR);
          return;
        }

        addSystemMessage(`Broadcasting file ${file.name} to ${peers.length} users...`, SystemMessageType.GENERAL);

        for (const peer of peers) {
          await initiateTransfer(peer.socketId);
        }
      } else {
        // Direct Transfer
        // Validate target is still online
        const targetUser = activeUsers.find(u => u.socketId === targetSocketId);
        if (!targetUser) {
          addSystemMessage(`Cannot send file. User is offline.`, SystemMessageType.ERROR);
          return;
        }

        await initiateTransfer(targetSocketId);
        addSystemMessage(`Sent file offer: ${file.name} to user.`, SystemMessageType.GENERAL, { isDirect: true, peerId: targetSocketId, peerUsername: targetUser.username });
      }
    } finally {
      // Release lock after a short delay to prevent accidental double-clicks
      setTimeout(() => {
        isSendingRef.current = false;
      }, 1000);
    }
  };

  const acceptFileTransfer = (transferId: string) => {
    const transfer = activeTransfers[transferId];
    if (!transfer || !socketRef.current) return;

    // Send acceptance to sender
    socketRef.current.emit('file-accept', {
      targetSocketId: transfer.peerSocketId,
      transferId
    });

    // Update status to transferring
    updateTransferState(transferId, { status: 'transferring' });
    addSystemMessage(`Accepting file: ${transfer.fileName}`, SystemMessageType.GENERAL, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
  };

  const declineFileTransfer = (transferId: string) => {
    const transfer = activeTransfers[transferId];
    if (!transfer || !socketRef.current) return;

    // Send decline to sender
    socketRef.current.emit('file-decline', {
      targetSocketId: transfer.peerSocketId,
      transferId
    });

    // Remove from active transfers
    const newTransfers = { ...activeTransfers };
    delete newTransfers[transferId];
    setActiveTransfers(newTransfers);

    addSystemMessage(`Declined file: ${transfer.fileName}`, SystemMessageType.GENERAL, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
  };

  const sendChunks = async (transferId: string, targetSocketId: string, chunks: ArrayBuffer[]) => {
    for (let i = 0; i < chunks.length; i++) {
      // Check if cancelled
      if (!activeTransfersRef.current[transferId]) return;

      const chunk = chunks[i];
      socketRef.current?.emit('file-chunk', {
        targetSocketId,
        transferId,
        chunkId: i,
        data: chunk
      });

      // Update progress locally (Throttle to every 1%)
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      const prevProgress = Math.round((i / chunks.length) * 100);

      if (progress > prevProgress) {
        updateTransferState(transferId, {
          chunksReceived: i + 1,
          progress
        });
      }

      // Yield to main thread every 20 chunks to prevent UI freeze
      if (i % 20 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    socketRef.current?.emit('file-complete', { targetSocketId, transferId });

    // Get transfer info for message
    const transfer = activeTransfersRef.current[transferId];
    if (transfer) {
      updateTransferState(transferId, { status: 'completed', progress: 100 });
      addSystemMessage(`✅ File sent: ${transfer.fileName} (${(transfer.fileSize / 1024).toFixed(1)} KB)`, SystemMessageType.WEBRTC_STATUS, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });

      // Auto-remove after 2 seconds
      setTimeout(() => {
        setActiveTransfers(current => {
          const newTransfers = { ...current };
          delete newTransfers[transferId];
          return newTransfers;
        });
      }, 2000);
    }
  };

  const cancelTransfer = (transferId: string) => {
    const transfer = activeTransfers[transferId];
    if (!transfer || !socketRef.current) return;

    // Notify peer about cancellation
    socketRef.current.emit('file-cancel', {
      targetSocketId: transfer.peerSocketId,
      transferId
    });

    // Remove from active transfers
    const newTransfers = { ...activeTransfers };
    delete newTransfers[transferId];
    setActiveTransfers(newTransfers);

    const action = transfer.isUpload ? 'sending' : 'receiving';
    addSystemMessage(`❌ Cancelled ${action} ${transfer.fileName}`, SystemMessageType.ERROR, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
  };

  // Sync Ref with State (Must be at top level)
  useEffect(() => {
    activeTransfersRef.current = activeTransfers;
  }, [activeTransfers]);

  // Consolidated Socket Connection and Event Listeners
  useEffect(() => {
    if (!userIdentity) return;
    if (!ownKeyPair) return; // Wait for keys

    // Prevent multiple connections
    if (socketRef.current) return;


    const socket = io(SIGNALING_SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      query: { version: APP_VERSION }
    });
    socketRef.current = socket;

    socket.on('connect', () => {

      setCryptoStatusMessage("Online");

      // Register User Globally
      if (userIdentity && ownKeyPairRef.current) {
        exportPublicKeyJwk(ownKeyPairRef.current.publicKey).then(jwk => {
          socket.emit('register-user', {
            username: userIdentity.username,
            publicKey: jwk
          });
        });
      }

      // Auto-rejoin if we have state
      if (roomId && roomId !== 'Direct Chat' && userIdentity && ownKeyPairRef.current) {
        exportPublicKeyJwk(ownKeyPairRef.current.publicKey).then(jwk => {
          socket.emit('join-room', {
            roomId,
            username: userIdentity.username,
            publicKey: jwk
          });
        });
      }
    });

    // --- File Transfer Listeners ---

    // Cleanup previous listeners to prevent duplicates
    socket.off('file-offer');
    socket.off('file-accept');
    socket.off('file-decline');
    socket.off('file-chunk');
    socket.off('file-complete');
    socket.off('file-cancel');

    socket.on('file-offer', ({ senderSocketId, metadata, fileMetadata }: { senderSocketId: string, metadata: any, fileMetadata: any }) => {
      const data = metadata || fileMetadata;


      const transferState: FileTransferState = {
        transferId: data.transferId,
        fileId: data.transferId,
        fileName: data.fileName || data.name || `unknown_file_${Date.now()}`,
        fileSize: data.fileSize || data.size,
        fileType: data.fileType || data.type,
        chunksTotal: data.totalChunks || data.chunksTotal,
        chunksReceived: 0,
        progress: 0,
        status: 'pending',
        isUpload: false,
        peerSocketId: senderSocketId,
        // chunks: new Map(), // Don't store chunks in state
        startTime: Date.now(),
        isDirect: data.isDirect,
        peerUsername: data.isDirect ? activeUsersRef.current.find(u => u.socketId === senderSocketId)?.username : undefined
      };

      // Initialize chunks storage
      fileChunksRef.current.set(data.transferId, new Map());

      // Update Ref IMMEDIATELY to ensure fileName is available for completion handler
      activeTransfersRef.current[data.transferId] = transferState;

      setActiveTransfers(prev => ({ ...prev, [data.transferId]: transferState }));
      addSystemMessage(`📎 File offer: ${transferState.fileName} (${(transferState.fileSize / 1024).toFixed(1)} KB)`, SystemMessageType.WEBRTC_STATUS, { isDirect: transferState.isDirect, peerId: transferState.peerSocketId, peerUsername: transferState.peerUsername });
    });

    socket.on('file-accept', async ({ transferId }: { transferId: string }) => {
      const transfer = activeTransfersRef.current[transferId];
      if (!transfer || !transfer.isUpload) return;

      addSystemMessage(`File accepted! Sending ${transfer.fileName}...`, SystemMessageType.GENERAL, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });

      const chunks = (window as any).pendingFileChunks?.get(transferId);
      if (chunks) {
        updateTransferState(transferId, {
          status: 'transferring',
          chunksTotal: chunks.length
        });
        await sendChunks(transferId, transfer.peerSocketId, chunks);
        (window as any).pendingFileChunks?.delete(transferId);
      } else {
        console.error('No pending chunks found for transfer:', transferId);
        addSystemMessage(`Error: File data not found`, SystemMessageType.ERROR);
      }
    });

    socket.on('file-decline', ({ transferId }: { transferId: string }) => {
      // Need to find transfer to know context, but it might be deleted?
      // Actually we don't have the transfer object here if we don't look it up before deleting?
      // Wait, the listener doesn't have the transfer object.
      // We need to look it up from activeTransfersRef
      const transfer = activeTransfersRef.current[transferId];
      if (transfer) {
        addSystemMessage(`File transfer declined.`, SystemMessageType.ERROR, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
      } else {
        addSystemMessage(`File transfer declined.`, SystemMessageType.ERROR);
      }
      setActiveTransfers(prev => {
        const newTransfers = { ...prev };
        delete newTransfers[transferId];
        return newTransfers;
      });
    });

    socket.on('file-chunk', ({ transferId, chunkId, data }: { transferId: string, chunkId: number, data: ArrayBuffer }) => {
      // 1. Store chunk in Ref (Bypassing State)
      const chunksMap = fileChunksRef.current.get(transferId);
      if (chunksMap) {
        chunksMap.set(chunkId, data);
      } else {
        // Fallback if map missing (shouldn't happen if offer processed)
        const newMap = new Map<number, ArrayBuffer>();
        newMap.set(chunkId, data);
        fileChunksRef.current.set(transferId, newMap);
      }

      // 2. Update State (for UI Progress only) - Throttled
      setActiveTransfers(prev => {
        const transfer = prev[transferId];
        if (!transfer || transfer.status !== 'transferring') return prev;

        // Calculate progress based on Ref size
        const currentChunksMap = fileChunksRef.current.get(transferId);
        const chunksReceived = currentChunksMap ? currentChunksMap.size : 0;
        const progress = Math.round((chunksReceived / transfer.chunksTotal) * 100);

        // Only update if progress changed significantly or finished
        if (progress === transfer.progress && progress < 100) return prev;

        return {
          ...prev,
          [transferId]: {
            ...transfer,
            chunksReceived,
            progress
          }
        };
      });
    });

    socket.on('file-complete', ({ transferId }: { transferId: string }) => {
      // 1. Absolute Guard: Check if already processed
      if (processedTransferIds.current.has(transferId)) {

        return;
      }

      const transfer = activeTransfersRef.current[transferId];

      // 2. State Guard
      if (!transfer || transfer.status === 'completed') return;

      // 3. Mark as processed IMMEDIATELY
      processedTransferIds.current.add(transferId);

      // Update Ref to reflect status (for UI consistency if state lags)
      activeTransfersRef.current[transferId] = { ...transfer, status: 'completed', progress: 100 };



      if (!transfer.isUpload) {
        try {
          const chunks = fileChunksRef.current.get(transferId);
          if (!chunks || chunks.size === 0) {
            console.error(`[File Complete] Error: No chunks found for ${transferId}.`);
            addSystemMessage(`Error: Received empty file.`, SystemMessageType.ERROR, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
            return;
          }



          const blob = FileTransferManager.reassembleFile(chunks, transfer.chunksTotal, transfer.fileType);

          if (blob.size === 0) {
            console.error(`[File Complete] Error: Reassembled blob is 0 bytes.`);
            addSystemMessage(`Error: File corrupted (0 bytes).`, SystemMessageType.ERROR, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
            return;
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;

          // Force Filename
          let safeName = transfer.fileName && transfer.fileName.trim() !== ''
            ? transfer.fileName
            : `received_file_${Date.now()}.bin`;

          // Ensure extension exists if possible
          if (!safeName.includes('.') && transfer.fileType) {
            const ext = transfer.fileType.split('/')[1];
            if (ext) safeName += `.${ext}`;
          }

          a.setAttribute('download', safeName);
          document.body.appendChild(a);


          a.click();

          // Cleanup - Increase timeout to ensure browser has time to save
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            // Remove chunks from memory
            fileChunksRef.current.delete(transferId);

          }, 30000); // 30 seconds wait

          addSystemMessage(`✅ File received: ${safeName}`, SystemMessageType.WEBRTC_STATUS, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
        } catch (err) {
          console.error("Download failed:", err);
          addSystemMessage(`Error saving file: ${err}`, SystemMessageType.ERROR, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
        }
      } else {
        addSystemMessage(`✅ File sent: ${transfer.fileName}`, SystemMessageType.WEBRTC_STATUS, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
      }

      // 3. Update React State (Visuals)
      setActiveTransfers(prev => ({
        ...prev,
        [transferId]: { ...prev[transferId], status: 'completed' as const, progress: 100 }
      }));

      // 4. Cleanup UI
      setTimeout(() => {
        setActiveTransfers(current => {
          const newTransfers = { ...current };
          delete newTransfers[transferId];
          return newTransfers;
        });
      }, 5000);
    });

    socket.on('file-cancel', ({ transferId }: { transferId: string }) => {
      setActiveTransfers(prev => {
        const transfer = prev[transferId];
        if (!transfer) return prev;
        const action = transfer.isUpload ? 'receiving' : 'sending';
        addSystemMessage(`❌ Peer cancelled ${action} ${transfer.fileName}`, SystemMessageType.ERROR, { isDirect: transfer.isDirect, peerId: transfer.peerSocketId, peerUsername: transfer.peerUsername });
        const newTransfers = { ...prev };
        delete newTransfers[transferId];
        return newTransfers;
      });
    });

    // --- Peer Status Listeners ---
    socket.on('peer-ping', ({ senderSocketId }: { senderSocketId: string }) => {
      socket.emit('peer-pong', { targetSocketId: senderSocketId });
    });

    socket.on('peer-pong', ({ senderSocketId }: { senderSocketId: string }) => {
      // Mark user as online/active
      setActiveUsers(prev => prev.map(u =>
        u.socketId === senderSocketId ? { ...u, isOnline: true } : u
      ));
      // We could also update a 'lastSeen' timestamp here if we had one
    });

    // --- Chat Listeners ---

    socket.on('room-users', async (users: UserProfile[]) => {

      setActiveUsers(prev => {
        // 1. Mark incoming users as online
        const incomingUsers = users.map(u => ({ ...u, isOnline: true }));

        // 2. Identify existing DM partners (users we have secrets with or active chat)
        // We use USERNAME as the stable identifier to prevent duplicates if socketId changed
        const existingPartners = prev.filter(u =>
          sharedSecretsRef.current.has(u.socketId) ||
          activeChatTargetRef.current === u.socketId ||
          // Also keep if we have unread messages from them?
          unreadCounts[u.socketId] > 0
        );

        // 3. Merge
        const mergedUsers = [...incomingUsers];

        existingPartners.forEach(partner => {
          // Check if this partner is already in the incoming list (by username)
          const matchIndex = mergedUsers.findIndex(u => u.username === partner.username);

          if (matchIndex !== -1) {
            // Partner is online. Ensure we keep any local state (like avatarColor) if needed?
            // But importantly, the incoming list has the NEW socketId. 
            // We should update our sharedSecrets map if the socketId changed!
            const newUser = mergedUsers[matchIndex];
            if (newUser.socketId !== partner.socketId) {
              // Socket ID changed for this user!
              // Migrate the shared secret to the new socket ID
              const secret = sharedSecretsRef.current.get(partner.socketId);
              if (secret) {
                sharedSecretsRef.current.set(newUser.socketId, secret);
                // sharedSecretsRef.current.delete(partner.socketId); // Optional: keep old for a bit?
              }
              // Also update unread counts mapping if needed? 
              // (Complex, maybe just reset or keep on old ID? For now let's assume unread is lost or we need to migrate it too)
              if (unreadCounts[partner.socketId]) {
                setUnreadCounts(prevCounts => {
                  const newCounts = { ...prevCounts };
                  newCounts[newUser.socketId] = (newCounts[newUser.socketId] || 0) + newCounts[partner.socketId];
                  delete newCounts[partner.socketId];
                  return newCounts;
                });
              }
            }
          } else {
            // Partner is NOT in the room. Mark as offline.
            mergedUsers.push({ ...partner, isOnline: false });
          }
        });

        return mergedUsers;
      });

      // Handle pending target logic...
      const pending = pendingTargetUserRef.current;
      if (pending) {
        const targetInRoom = users.find(u => u.username === pending);
        if (targetInRoom) {
          handleSetActiveChatTarget(targetInRoom.socketId, targetInRoom.username);
          setPendingTargetUser(null);
          socket.emit('direct-chat-request', { targetUsername: targetInRoom.username, senderUsername: userIdentity?.username });
          addSystemMessage(`Found user ${targetInRoom.username} in room.`, SystemMessageType.GENERAL);
        } else {
          socket.emit('find-user', pending, async (response: { found: boolean, user?: UserProfile }) => {
            if (response.found && response.user) {
              const user = response.user;
              setActiveUsers(prev => {
                if (prev.find(u => u.socketId === user.socketId)) return prev;
                return [...prev, user];
              });
              // Key derivation...
              const currentKeyPair = ownKeyPairRef.current;
              if (currentKeyPair) {
                try {
                  const peerKey = await importPublicKeyJwk(user.publicKey);
                  const secret = await deriveSharedSecret(currentKeyPair.privateKey, peerKey);
                  sharedSecretsRef.current.set(user.socketId, secret);
                } catch (e) { console.error("Key derivation error:", e); }
              }
              handleSetActiveChatTarget(user.socketId, user.username);
              setPendingTargetUser(null);
              socket.emit('direct-chat-request', { targetUsername: user.username, senderUsername: userIdentity?.username });
              addSystemMessage(`Found user ${user.username} globally. Starting chat.`, SystemMessageType.GENERAL);
            } else {
              addSystemMessage(`User ${pending} not found online.`, SystemMessageType.ERROR);
            }
          });
        }
      }

      // Key derivation for room users
      const currentKeyPair = ownKeyPairRef.current;
      if (currentKeyPair) {
        for (const user of users) {
          if (!sharedSecretsRef.current.has(user.socketId)) {
            try {
              const peerKey = await importPublicKeyJwk(user.publicKey);
              const secret = await deriveSharedSecret(currentKeyPair.privateKey, peerKey);
              sharedSecretsRef.current.set(user.socketId, secret);
            } catch (e) { console.error("Key derivation error:", e); }
          }
        }
      }
    });

    socket.on('user-joined', async (user: UserProfile) => {
      console.log("User joined:", user);
      const onlineUser = { ...user, isOnline: true };

      setActiveUsers((prev: UserProfile[]) => {
        // Check if we already have this user (by username)
        const existingIndex = prev.findIndex(u => u.username === user.username);

        if (existingIndex !== -1) {
          // Update existing entry
          const existingUser = prev[existingIndex];

          // Handle Socket ID Change (Reconnect)
          if (existingUser.socketId !== user.socketId) {
            console.log(`User ${user.username} reconnected with new socket ID.`);
            // Migrate Secret
            const secret = sharedSecretsRef.current.get(existingUser.socketId);
            if (secret) {
              sharedSecretsRef.current.set(user.socketId, secret);
            }
            // Migrate Unread
            if (unreadCounts[existingUser.socketId]) {
              setUnreadCounts(prevCounts => {
                const newCounts = { ...prevCounts };
                newCounts[user.socketId] = (newCounts[user.socketId] || 0) + newCounts[existingUser.socketId];
                delete newCounts[existingUser.socketId];
                return newCounts;
              });
            }

            // If this was our active target, update it!
            if (activeChatTargetRef.current === existingUser.socketId) {
              handleSetActiveChatTarget(user.socketId, user.username);
              addSystemMessage(`${user.username} reconnected. Session updated.`, SystemMessageType.CONNECTION_STATUS);
            }
          }

          const newUsers = [...prev];
          newUsers[existingIndex] = onlineUser;
          return newUsers;
        }

        // New user
        return [...prev, onlineUser];
      });

      addSystemMessage(`${user.username} joined the room.`, SystemMessageType.CONNECTION_STATUS);

      const pending = pendingTargetUserRef.current;
      if (pending && user.username === pending) {
        handleSetActiveChatTarget(user.socketId, user.username);
        setPendingTargetUser(null);
        addSystemMessage(`User ${user.username} just joined! Starting chat.`, SystemMessageType.GENERAL);
      }

      const currentKeyPair = ownKeyPairRef.current;
      if (currentKeyPair) {
        try {
          const peerKey = await importPublicKeyJwk(user.publicKey);
          const secret = await deriveSharedSecret(currentKeyPair.privateKey, peerKey);
          sharedSecretsRef.current.set(user.socketId, secret);
        } catch (e) { console.error("Key derivation error:", e); }
      }
    });

    socket.on('user-left', (socketId: string) => {
      setActiveUsers((prev: UserProfile[]) => {
        const user = prev.find((u: UserProfile) => u.socketId === socketId);
        if (user) {
          addSystemMessage(`${user.username} left the room.`, SystemMessageType.CONNECTION_STATUS);
        }

        // If we have a shared secret (DM history), keep them but mark offline
        if (sharedSecretsRef.current.has(socketId)) {
          return prev.map(u => u.socketId === socketId ? { ...u, isOnline: false } : u);
        }

        // Otherwise remove
        return prev.filter((u: UserProfile) => u.socketId !== socketId);
      });
    });

    socket.on('encrypted-message', async (data: { senderSocketId: string, senderUsername?: string, payload: EncryptedTextMessage }) => {
      const { senderSocketId, senderUsername, payload } = data;
      let secret = sharedSecretsRef.current.get(senderSocketId);

      if (!secret && payload.senderPublicKeyJwkString) {
        try {
          const peerKey = await importPublicKeyJwk(JSON.parse(payload.senderPublicKeyJwkString));
          if (ownKeyPairRef.current) {
            secret = await deriveSharedSecret(ownKeyPairRef.current.privateKey, peerKey);
            sharedSecretsRef.current.set(senderSocketId, secret);
          }
        } catch (e) { console.error("Failed to derive secret from payload:", e); }
      }

      if (!secret) return;

      try {
        const decryptedText = await decryptText(payload.encryptedDataB64, payload.ivB64, secret);
        if (decryptedText) {
          const senderProfile = activeUsersRef.current.find(u => u.socketId === senderSocketId);
          const displayName = senderProfile?.username || senderUsername || 'Unknown';
          const currentTarget = activeChatTargetRef.current;

          // Ensure sender is in activeUsers (for Sidebar visibility) if it's a DM
          if (payload.isDirect && !senderProfile && senderUsername && payload.senderPublicKeyJwkString) {
            try {
              const senderKey = JSON.parse(payload.senderPublicKeyJwkString);
              const newUser: UserProfile = {
                socketId: senderSocketId,
                username: senderUsername,
                publicKey: senderKey,
                isOnline: true
              };
              setActiveUsers(prev => [...prev, newUser]);
            } catch (e) {
              console.error("Error adding new user from DM:", e);
            }
          }

          if (payload.isDirect) {
            if (currentTarget !== senderSocketId) {
              setUnreadCounts(prev => ({ ...prev, [senderSocketId]: (prev[senderSocketId] || 0) + 1 }));
            }
          } else {
            if (currentTarget !== 'ROOM') {
              setUnreadCounts(prev => ({ ...prev, 'ROOM': (prev['ROOM'] || 0) + 1 }));
            }
          }

          // Variables for newMessage are missing in the original code, assuming they should be derived from payload and context
          // For an incoming message, senderIsSelf should be false, senderName should be displayName,
          // and id/timestamp/text should come from the decrypted content or generated.
          // Assuming `msgId`, `timestamp`, `text`, `isDirect`, `activeChatTarget` were meant to be defined earlier or derived.
          // For this fix, I'll assume `decryptedText` is the `text` and generate `id` and `timestamp`.
          // `isDirect` comes from `payload.isDirect`. `activeChatTarget` is not relevant for incoming messages.
          const newMessage = {
            id: `${senderSocketId}-${Date.now()}`, // Generate a unique ID
            timestamp: Date.now(),
            text: decryptedText,
            senderIsSelf: false, // Incoming message, so sender is not self
            senderName: displayName,
            targetSocketId: payload.isDirect ? undefined : undefined, // We don't know the socketId here easily, but for history it doesn't matter much. 
            // Actually, if it's incoming DM, target is US. 
            isDirect: payload.isDirect
          } as DecryptedMessage;

          if (payload.isDirect) {
            const senderName = displayName; // Use displayName which is username
            setDirectMessages(prev => ({
              ...prev,
              [senderName]: [...(prev[senderName] || []), newMessage]
            }));
          } else {
            setRoomMessages(prev => [...prev, newMessage]);
          }
        }
      } catch (e) { console.error("Decryption error:", e); }
    });

    socket.on('direct-chat-request', ({ senderSocketId, senderUsername }: { senderSocketId: string, senderUsername: string }) => {
      setChatRequests(prev => {
        if (prev.find(r => r.senderSocketId === senderSocketId)) return prev;
        return [...prev, { senderSocketId, senderUsername }];
      });
    });

    socket.on('end-direct-chat', ({ senderSocketId, senderUsername }: { senderSocketId: string, senderUsername: string }) => {
      addSystemMessage(`${senderUsername} ended the chat.`, SystemMessageType.CONNECTION_STATUS);
      if (activeChatTargetRef.current === senderSocketId) {
        handleSetActiveChatTarget('ROOM');
      }
    });

    // --- Typing & Update Listeners ---
    socket.on('force-update', ({ minVersion }) => {
      setUpdateRequired(true);
      socket.disconnect();
    });

    socket.on('soft-update', ({ latestVersion }) => {
      setUpdateAvailable(true);
      addSystemMessage(`New version ${latestVersion} is available!`, SystemMessageType.GENERAL);
    });

    socket.on('typing', ({ senderSocketId }) => {
      if (activeChatTargetRef.current === 'ROOM') {
        setTypingUsers(prev => [...prev, senderSocketId]);
      } else if (activeChatTargetRef.current === senderSocketId) {
        setTypingUsers(prev => [...prev, senderSocketId]);
      }
    });

    socket.on('stop-typing', ({ senderSocketId }) => {
      setTypingUsers(prev => prev.filter(id => id !== senderSocketId));
    });

    return () => {
      console.log("Cleaning up socket connection...");
      socket.off('typing');
      socket.off('stop-typing');
      socket.off('force-update');
      socket.off('soft-update');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userIdentity, ownKeyPair]); // Run once when identity/keys are ready

  useEffect(() => {
    activeUsersRef.current = activeUsers;
  }, [activeUsers]);



  const joinRoom = async (newRoomId: string) => {
    if (!socketRef.current || !userIdentity || !ownKeyPair) return;

    // Keys are already generated on init
    const publicKeyJwk = await exportPublicKeyJwk(ownKeyPair.publicKey);

    socketRef.current.emit('join-room', {
      roomId: newRoomId,
      username: userIdentity.username,
      publicKey: publicKeyJwk
    });

    setRoomId(newRoomId);
    // Only clear ROOM messages, keep DMs
    setRoomMessages([]);
    setCryptoStatusMessage("Joined room. Waiting for messages...");
  };

  const startDirectChat = async (targetUsername: string) => {
    if (!socketRef.current || !userIdentity || !ownKeyPair) return;

    // Do NOT exit room. We want to allow DMs while in a room.
    // If we are not in a room, we set a virtual room ID.

    setCryptoStatusMessage("Locating user...");
    const user = await findUser(targetUsername);

    if (user) {
      // Add to activeUsers so we can chat
      setActiveUsers(prev => {
        if (prev.find(u => u.socketId === user.socketId)) return prev;
        return [...prev, user];
      });

      // Derive secret
      try {
        const peerKey = await importPublicKeyJwk(user.publicKey);
        const secret = await deriveSharedSecret(ownKeyPair.privateKey, peerKey);
        sharedSecretsRef.current.set(user.socketId, secret);
      } catch (e) { console.error("Key derivation error:", e); }

      // If we are not in a room, enter "Direct Chat" virtual room to enable UI
      if (!roomId) {
        setRoomId('Direct Chat');
      }

      handleSetActiveChatTarget(user.socketId, user.username);

      // Notify target
      socketRef.current.emit('direct-chat-request', { targetUsername: user.username, senderUsername: userIdentity.username });

      addSystemMessage(`Started direct chat with ${user.username}.`, SystemMessageType.GENERAL);
      setCryptoStatusMessage("Secure connection established.");
    } else {
      addSystemMessage(`User ${targetUsername} not found.`, SystemMessageType.ERROR);
      setCryptoStatusMessage("User not found.");
    }
  };

  const getSafetyNumber = async (targetSocketId: string): Promise<string | null> => {
    const secret = sharedSecretsRef.current.get(targetSocketId);
    if (!secret) return null;

    try {
      // Export secret key to raw bytes
      const exported = await crypto.subtle.exportKey('raw', secret);
      const buffer = new Uint8Array(exported);

      // Create a simple hex string or hash
      // For a "Safety Number", we usually want a numeric string or easily comparable format.
      // Here we'll take the first 8 bytes and convert to a grouped hex string.
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Format as groups: 00000 00000 ...
      return hashHex.substring(0, 20).match(/.{1,5}/g)?.join(' ') || hashHex;
    } catch (e) {
      console.error("Error generating safety number:", e);
      return null;
    }
  };

  const fetchServerStats = async (): Promise<any> => {
    if (!socketRef.current) return null;
    return new Promise((resolve) => {
      socketRef.current?.emit('get-stats', (stats: any) => {
        resolve(stats);
      });
    });
  };

  const acceptDirectChat = async (targetSocketId: string, targetUsername: string) => {
    if (!socketRef.current || !userIdentity || !ownKeyPair) return;

    // Do NOT exit room.

    // We assume the user is valid since we got a request/message from them.
    // However, we might need their public key. 
    // If it was a request, we might not have the key yet unless we fetch it.
    // But usually 'findUser' or the message payload has it.
    // For safety, let's try to find them to get the latest key/status.

    const user = await findUser(targetUsername);
    if (user) {
      setActiveUsers(prev => {
        if (prev.find(u => u.socketId === user.socketId)) return prev;
        return [...prev, user];
      });

      try {
        const peerKey = await importPublicKeyJwk(user.publicKey);
        const secret = await deriveSharedSecret(ownKeyPair.privateKey, peerKey);
        sharedSecretsRef.current.set(user.socketId, secret);
      } catch (e) { console.error("Key derivation error:", e); }

      // If we are not in a room, enter "Direct Chat" virtual room to enable UI
      if (!roomId) {
        setRoomId('Direct Chat');
      }

      handleSetActiveChatTarget(user.socketId, user.username);
      addSystemMessage(`Accepted chat with ${user.username}.`, SystemMessageType.GENERAL);
    } else {
      // Fallback if findUser fails (maybe they disconnected?)
      // But we might have the key from a previous message? 
      // For now, error out.
      addSystemMessage(`Could not connect to ${targetUsername}.`, SystemMessageType.ERROR);
    }
  };

  const leaveRoom = () => {
    if (socketRef.current && roomId && roomId !== 'Direct Chat') {
      // Emit leave-room event to server
      socketRef.current.emit('leave-room');
    }

    // Clear room state but preserve DMs and identity
    setRoomId(null);

    // Only clear room messages, keep DMs
    setRoomMessages([]);

    // Don't clear activeUsers - keep DM partners
    // Don't clear sharedSecretsRef - keep encryption keys for DMs
    // Don't clear ownKeyPair - keep our identity

    // Switch to ROOM view if we were viewing room
    if (activeChatTarget === 'ROOM') {
      setActiveChatTarget('ROOM');
    }

    // Clear room unread count
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts['ROOM'];
      return newCounts;
    });
  };

  const closeDirectChat = (targetSocketId: string) => {
    if (activeChatTarget === targetSocketId) {
      setActiveChatTarget('ROOM');
      setChatEnded(true);
    }
    // Notify the other user?
    if (socketRef.current) {
      socketRef.current.emit('end-direct-chat', { targetSocketId });
    }
    // If we are in "Direct Chat" virtual room and have no other chats, maybe leave?
    // For now, just switching target is enough.
  };

  const resetChatEnded = () => setChatEnded(false);



  const sendMessage = async (text: string) => {
    if (!socketRef.current || !ownKeyPair) return;

    const timestamp = Date.now();
    const msgId = `msg-${timestamp}`;
    const isDirect = activeChatTarget !== 'ROOM';

    // Always include public key
    const publicKeyJwk = await exportPublicKeyJwk(ownKeyPair.publicKey);
    const publicKeyString = JSON.stringify(publicKeyJwk);

    const newMessage = {
      id: msgId,
      timestamp,
      text,
      senderIsSelf: true,
      senderName: userIdentity?.username || 'Me',
      targetSocketId: isDirect ? activeChatTarget : undefined,
      isDirect
    } as DecryptedMessage;

    if (isDirect) {
      // Optimistically add to DM
      const targetUser = activeUsers.find(u => u.socketId === activeChatTarget);
      const targetUsername = targetUser?.username || activeChatUsername;

      if (targetUsername) {
        setDirectMessages(prev => ({
          ...prev,
          [targetUsername]: [...(prev[targetUsername] || []), newMessage]
        }));
      }
    } else {
      setRoomMessages(prev => [...prev, newMessage]);
    }

    if (isDirect) {
      const targetSocketId = activeChatTarget;
      const secret = sharedSecretsRef.current.get(targetSocketId);

      // Find the username for this socket ID to send to server for robust routing
      const targetUser = activeUsers.find(u => u.socketId === targetSocketId);
      const targetUsername = targetUser?.username;

      if (secret) {
        const encrypted = await encryptText(text, secret);
        if (encrypted) {
          const payload: EncryptedTextMessage = {
            id: msgId,
            timestamp,
            type: MessageType.TEXT,
            senderPublicKeyJwkString: publicKeyString,
            encryptedDataB64: encrypted.encryptedDataB64,
            ivB64: encrypted.ivB64,
            isDirect: true
          };
          socketRef.current?.emit('send-message', {
            targetSocketId,
            targetUsername, // Send username for lookup
            payload,
            senderUsername: userIdentity?.username
          });
        }
      }
    } else {
      // Group Chat: Iterate over all users in the room
      if (activeUsers.length === 0) {
        console.warn("No active users in room to send to.");
      }

      activeUsers.forEach(async (user: UserProfile) => {
        let secret = sharedSecretsRef.current.get(user.socketId);

        // Self-Healing: If secret is missing, try to derive it now
        if (!secret && user.publicKey && ownKeyPair) {
          try {
            console.log(`[Self-Heal] Deriving missing secret for ${user.username} (${user.socketId})`);
            const peerKey = await importPublicKeyJwk(user.publicKey);
            secret = await deriveSharedSecret(ownKeyPair.privateKey, peerKey);
            sharedSecretsRef.current.set(user.socketId, secret);
          } catch (err) {
            console.error(`[Self-Heal] Failed to derive secret for ${user.username}:`, err);
          }
        }

        if (!secret) {
          console.error(`Cannot send message to ${user.username}: No shared secret available.`);
          return;
        }

        const encrypted = await encryptText(text, secret);
        if (encrypted) {
          const payload: EncryptedTextMessage = {
            id: msgId,
            timestamp,
            type: MessageType.TEXT,
            senderPublicKeyJwkString: publicKeyString,
            encryptedDataB64: encrypted.encryptedDataB64,
            ivB64: encrypted.ivB64,
            isDirect: false
          };

          socketRef.current?.emit('send-message', {
            targetSocketId: user.socketId,
            targetUsername: user.username, // Critical Fix: Allow server to route to latest socket for this username
            payload,
            senderUsername: userIdentity?.username
          });
        }
      });
    }
  };

  const sendFileOffer = (file: File, targetSocketId: string) => {
    if (!socketRef.current) return;
    const fileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type
    };
    socketRef.current.emit('file-offer', { targetSocketId, fileMetadata });
    addSystemMessage(`Offered file ${file.name} to user.`, SystemMessageType.GENERAL);
  };

  const acceptFileOffer = (senderSocketId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('file-response', { targetSocketId: senderSocketId, accepted: true });
    setFileOffers((prev: Array<{ senderSocketId: string, fileMetadata: any }>) => prev.filter((o: { senderSocketId: string }) => o.senderSocketId !== senderSocketId));
    addSystemMessage(`Accepted file offer. Waiting for transfer...`, SystemMessageType.WEBRTC_STATUS);
  };

  const declineFileOffer = (senderSocketId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('file-response', { targetSocketId: senderSocketId, accepted: false });
    setFileOffers((prev: Array<{ senderSocketId: string, fileMetadata: any }>) => prev.filter((o: { senderSocketId: string }) => o.senderSocketId !== senderSocketId));
  };

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const sendTyping = (isTyping: boolean) => {
    if (!socketRef.current) return;

    const payload = activeChatTarget === 'ROOM'
      ? { targetRoomId: roomId }
      : { targetSocketId: activeChatTarget };

    if (isTyping) {
      socketRef.current.emit('typing', payload);

      // Auto-stop typing after 3 seconds if no new input
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('stop-typing', payload);
      }, 3000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketRef.current.emit('stop-typing', payload);
    }
  };

  const checkUserOnline = (username: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }
      socketRef.current.emit('check-user-online', { targetUsername: username }, (response: { isOnline: boolean, socketId?: string }) => {
        resolve(response.isOnline);
      });
    });
  };



  const value = {
    roomId,
    joinRoom,
    leaveRoom,
    userIdentity,
    ownKeyPair,
    activeUsers,
    messages,
    directMessages,
    sendMessage,
    sendFileOffer,
    acceptFileOffer,
    declineFileOffer,
    fileOffers,
    activeTransfers,
    startFileTransfer,
    acceptFileTransfer,
    declineFileTransfer,
    cancelTransfer,
    cryptoStatusMessage,
    activeChatTarget,
    setActiveChatTarget: handleSetActiveChatTarget,
    unreadCounts,
    setPendingTargetUser,
    findUser,
    chatRequests,
    startDirectChat,
    acceptDirectChat,
    closeDirectChat,
    getSafetyNumber,
    fetchServerStats,
    typingUsers,
    sendTyping,
    updateRequired,
    updateAvailable,
    checkUserOnline,
    refreshActiveUsers,
    chatEnded,
    resetChatEnded
  };

  // Periodic Heartbeat
  useEffect(() => {
    if (!socketRef.current) return;
    const interval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('heartbeat');
      }
    }, 10000); // Send heartbeat every 10 seconds
    return () => clearInterval(interval);
  }, [socketRef.current]);

  // Periodic Peer/Group Check
  useEffect(() => {
    if (!socketRef.current) return;

    const checkStatus = () => {
      if (activeChatTarget === 'ROOM') {
        // In Group: Sync with server to ensure our list matches reality
        // The server tracks heartbeats, so asking it gives us the verified list
        socketRef.current?.emit('get-room-users');
      } else {
        // In DM: Direct Ping to verify peer is truly reachable
        socketRef.current?.emit('peer-ping', { targetSocketId: activeChatTarget });
      }
    };

    const interval = setInterval(checkStatus, 20000); // Check every 20 seconds
    // checkStatus(); // Don't run immediately on mount/change to avoid spamming on rapid switches

    return () => clearInterval(interval);
  }, [activeChatTarget]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};