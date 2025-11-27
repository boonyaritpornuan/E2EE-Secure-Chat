import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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

const SIGNALING_SERVER_URL = 'http://localhost:3001'; // Adjust if deployed

interface ChatContextType {
  roomId: string | null;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;

  userIdentity: UserIdentity | null;
  ownKeyPair: KeyPair | null;
  activeUsers: UserProfile[];

  messages: DecryptedMessage[];
  sendMessage: (text: string) => Promise<void>;

  // File Sharing
  sendFileOffer: (file: File, targetSocketId: string) => void;
  acceptFileOffer: (senderSocketId: string) => void;
  declineFileOffer: (senderSocketId: string) => void;
  fileOffers: Array<{ senderSocketId: string, fileMetadata: any }>;

  cryptoStatusMessage: string | null;
  activeChatTarget: string | 'ROOM';
  setActiveChatTarget: (target: string | 'ROOM') => void;
  unreadCounts: Record<string, number>;
  setPendingTargetUser: (username: string | null) => void;
  findUser: (username: string) => Promise<UserProfile | null>;
  chatRequests: Array<{ senderSocketId: string, senderUsername: string }>;
  startDirectChat: (targetUsername: string) => Promise<void>;
  acceptDirectChat: (targetSocketId: string, targetUsername: string) => Promise<void>;
  closeDirectChat: (targetSocketId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);
  const [ownKeyPair, setOwnKeyPair] = useState<KeyPair | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [cryptoStatusMessage, setCryptoStatusMessage] = useState<string | null>("Initializing...");
  const [activeChatTarget, setActiveChatTarget] = useState<string | 'ROOM'>('ROOM');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [pendingTargetUser, setPendingTargetUser] = useState<string | null>(null);
  const [chatRequests, setChatRequests] = useState<Array<{ senderSocketId: string, senderUsername: string }>>([]);

  const [fileOffers, setFileOffers] = useState<Array<{ senderSocketId: string, fileMetadata: any }>>([]);

  const socketRef = useRef<Socket | null>(null);
  const sharedSecretsRef = useRef<Map<string, CryptoKey>>(new Map());

  const ownKeyPairRef = useRef<KeyPair | null>(null);
  const activeUsersRef = useRef<UserProfile[]>([]);
  const activeChatTargetRef = useRef<string | 'ROOM'>('ROOM');
  const pendingTargetUserRef = useRef<string | null>(null);

  useEffect(() => { ownKeyPairRef.current = ownKeyPair; }, [ownKeyPair]);
  useEffect(() => { activeUsersRef.current = activeUsers; }, [activeUsers]);
  useEffect(() => { activeChatTargetRef.current = activeChatTarget; }, [activeChatTarget]);
  useEffect(() => { pendingTargetUserRef.current = pendingTargetUser; }, [pendingTargetUser]);

  useEffect(() => {
    const initIdentityAndKeys = async () => {
      let identity = getStoredIdentity();
      if (!identity) {
        identity = generateRandomIdentity();
        storeIdentity(identity);
      }
      setUserIdentity(identity);

      // Generate keys immediately
      setCryptoStatusMessage("Generating identity keys...");
      const keys = await generateAppKeyPair();
      setOwnKeyPair(keys);
      setCryptoStatusMessage("Ready.");
    };
    initIdentityAndKeys();
  }, []);

  const handleSetActiveChatTarget = (target: string | 'ROOM') => {
    setActiveChatTarget(target);
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

  useEffect(() => {
    if (!userIdentity) return;
    if (!ownKeyPair) return; // Wait for keys

    if (socketRef.current) return;

    const socket = io(SIGNALING_SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server:', socket.id);
      setCryptoStatusMessage("Connected to server.");

      // Register User Globally
      if (userIdentity && ownKeyPairRef.current) {
        exportPublicKeyJwk(ownKeyPairRef.current.publicKey).then(jwk => {
          socket.emit('register-user', {
            username: userIdentity.username,
            publicKey: jwk
          });
        });
      }

      // Auto-rejoin if we have state (handles actual network reconnects)
      // IMPORTANT: Do NOT auto-join if the room is "Direct Chat" (virtual room)
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

    socket.on('room-users', async (users: UserProfile[]) => {
      console.log("Received room users:", users);
      setActiveUsers(users);

      // Check pending target using Ref
      const pending = pendingTargetUserRef.current;
      if (pending) {
        const targetInRoom = users.find(u => u.username === pending);
        if (targetInRoom) {
          handleSetActiveChatTarget(targetInRoom.socketId);
          setPendingTargetUser(null);
          socket.emit('direct-chat-request', { targetUsername: targetInRoom.username, senderUsername: userIdentity?.username });
          addSystemMessage(`Found user ${targetInRoom.username} in room.`, SystemMessageType.GENERAL);
        } else {
          // Not in room, try global search
          addSystemMessage(`User ${pending} not in room, searching globally...`, SystemMessageType.GENERAL);
          socket.emit('find-user', pending, async (response: { found: boolean, user?: UserProfile }) => {
            if (response.found && response.user) {
              const user = response.user;
              // Add to activeUsers so they appear in UI and we can track them
              setActiveUsers(prev => {
                if (prev.find(u => u.socketId === user.socketId)) return prev;
                return [...prev, user];
              });

              // Derive secret
              const currentKeyPair = ownKeyPairRef.current;
              if (currentKeyPair) {
                try {
                  const peerKey = await importPublicKeyJwk(user.publicKey);
                  const secret = await deriveSharedSecret(currentKeyPair.privateKey, peerKey);
                  sharedSecretsRef.current.set(user.socketId, secret);
                } catch (e) { console.error("Key derivation error:", e); }
              }

              handleSetActiveChatTarget(user.socketId);
              setPendingTargetUser(null);
              socket.emit('direct-chat-request', { targetUsername: user.username, senderUsername: userIdentity?.username });
              addSystemMessage(`Found user ${user.username} globally. Starting chat.`, SystemMessageType.GENERAL);
            } else {
              addSystemMessage(`User ${pending} not found online.`, SystemMessageType.ERROR);
            }
          });
        }
      }

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
      setActiveUsers((prev: UserProfile[]) => {
        if (prev.find(u => u.socketId === user.socketId)) return prev;
        return [...prev, user];
      });
      addSystemMessage(`${user.username} joined the room.`, SystemMessageType.CONNECTION_STATUS);

      const pending = pendingTargetUserRef.current;
      if (pending && user.username === pending) {
        handleSetActiveChatTarget(user.socketId);
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
        return prev.filter((u: UserProfile) => u.socketId !== socketId);
      });
      sharedSecretsRef.current.delete(socketId);

      // If the user we are chatting with leaves/disconnects, close the chat
      if (activeChatTargetRef.current === socketId) {
        handleSetActiveChatTarget('ROOM');
        addSystemMessage(`Chat closed because the user left.`, SystemMessageType.GENERAL);
      }
    });

    socket.on('encrypted-message', async (data: { senderSocketId: string, senderUsername?: string, payload: EncryptedTextMessage }) => {
      const { senderSocketId, senderUsername, payload } = data;
      let secret = sharedSecretsRef.current.get(senderSocketId);

      // If secret missing, try to derive from payload key
      if (!secret && payload.senderPublicKeyJwkString) {
        try {
          const peerKey = await importPublicKeyJwk(JSON.parse(payload.senderPublicKeyJwkString));
          if (ownKeyPairRef.current) {
            secret = await deriveSharedSecret(ownKeyPairRef.current.privateKey, peerKey);
            sharedSecretsRef.current.set(senderSocketId, secret);
          }
        } catch (e) {
          console.error("Failed to derive secret from payload:", e);
        }
      }

      if (!secret) {
        console.warn(`Received message from ${senderSocketId} but no shared secret found.`);
        return;
      }

      try {
        const decryptedText = await decryptText(payload.encryptedDataB64, payload.ivB64, secret);

        if (decryptedText) {
          const senderProfile = activeUsersRef.current.find(u => u.socketId === senderSocketId);
          const displayName = senderProfile?.username || senderUsername || 'Unknown';

          // Handle Unread Counts using Ref
          const currentTarget = activeChatTargetRef.current;

          if (payload.isDirect) {
            if (currentTarget !== senderSocketId) {
              setUnreadCounts(prev => ({
                ...prev,
                [senderSocketId]: (prev[senderSocketId] || 0) + 1
              }));
            }
          } else {
            // Room Message
            if (currentTarget !== 'ROOM') {
              setUnreadCounts(prev => ({
                ...prev,
                'ROOM': (prev['ROOM'] || 0) + 1
              }));
            }
          }

          setMessages((prev: DecryptedMessage[]) => [...prev, {
            id: payload.id,
            timestamp: payload.timestamp,
            text: decryptedText,
            senderIsSelf: false,
            senderName: displayName,
            senderSocketId: senderSocketId,
            isDirect: payload.isDirect
          } as DecryptedMessage]);
        }
      } catch (e) {
        console.error("Decryption error:", e);
      }
    });

    socket.on('file-offer', ({ senderSocketId, fileMetadata }: { senderSocketId: string, fileMetadata: any }) => {
      setFileOffers((prev: Array<{ senderSocketId: string, fileMetadata: any }>) => [...prev, { senderSocketId, fileMetadata }]);
    });

    socket.on('file-response', ({ senderSocketId, accepted }: { senderSocketId: string, accepted: boolean }) => {
      if (accepted) {
        addSystemMessage(`User accepted file offer. Starting transfer... (Simulated)`, SystemMessageType.WEBRTC_STATUS);
      } else {
        addSystemMessage(`User declined file offer.`, SystemMessageType.ERROR);
      }
    });

    socket.on('direct-chat-request', ({ senderSocketId, senderUsername }: { senderSocketId: string, senderUsername: string }) => {
      setChatRequests(prev => {
        if (prev.find(r => r.senderSocketId === senderSocketId)) return prev;
        return [...prev, { senderSocketId, senderUsername }];
      });
    });

    socket.on('end-direct-chat', ({ senderSocketId, senderUsername }: { senderSocketId: string, senderUsername: string }) => {
      addSystemMessage(`${senderUsername} ended the chat.`, SystemMessageType.CONNECTION_STATUS);

      // If we are currently chatting with them, switch back to Room view
      if (activeChatTargetRef.current === senderSocketId) {
        handleSetActiveChatTarget('ROOM');
        // If we were in a virtual room, we might want to clear roomId too, 
        // but for now let's assume we want to go back to the "Room" context if it exists.
        // If roomId was 'Direct Chat', we should probably clear it to go back to Lobby?
        // But handleSetActiveChatTarget doesn't touch roomId.

        // Actually, if we are in 'Direct Chat' virtual room, we should probably leave it?
        // But we don't know if we have other chats. 
        // Let's just switch target for now.
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userIdentity, ownKeyPair]); // Added ownKeyPair dependency

  const addSystemMessage = useCallback((text: string, systemType: SystemMessageType = SystemMessageType.GENERAL) => {
    setMessages((prev: DecryptedMessage[]) => [...prev, {
      id: `sys-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      text,
      isSystem: true,
      senderIsSelf: false,
      systemType,
    }]);
  }, []);

  const deriveSecretForUser = async (targetSocketId: string, publicKeyJwk: JsonWebKey) => {
    if (!ownKeyPair) return;
    try {
      const peerKey = await importPublicKeyJwk(publicKeyJwk);
      const secret = await deriveSharedSecret(ownKeyPair.privateKey, peerKey);
      sharedSecretsRef.current.set(targetSocketId, secret);
      console.log(`Derived secret for ${targetSocketId}`);
    } catch (e) {
      console.error("Failed to derive secret:", e);
    }
  };

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
    setMessages([]);
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

      handleSetActiveChatTarget(user.socketId);

      // Notify target
      socketRef.current.emit('direct-chat-request', { targetUsername: user.username, senderUsername: userIdentity.username });

      addSystemMessage(`Started direct chat with ${user.username}.`, SystemMessageType.GENERAL);
      setCryptoStatusMessage("Secure connection established.");
    } else {
      addSystemMessage(`User ${targetUsername} not found.`, SystemMessageType.ERROR);
      setCryptoStatusMessage("User not found.");
    }
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

      handleSetActiveChatTarget(user.socketId);
      addSystemMessage(`Accepted chat with ${user.username}.`, SystemMessageType.GENERAL);
    } else {
      // Fallback if findUser fails (maybe they disconnected?)
      // But we might have the key from a previous message? 
      // For now, error out.
      addSystemMessage(`Could not connect to ${targetUsername}.`, SystemMessageType.ERROR);
    }
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
    setRoomId(null);
    setMessages([]);
    setActiveUsers([]);
    sharedSecretsRef.current.clear();
    setOwnKeyPair(null);
    setActiveChatTarget('ROOM');
    setUnreadCounts({});
    setPendingTargetUser(null);
  };

  const closeDirectChat = (targetSocketId: string) => {
    if (activeChatTarget === targetSocketId) {
      setActiveChatTarget('ROOM');
    }
    // Notify the other user?
    if (socketRef.current) {
      socketRef.current.emit('end-direct-chat', { targetSocketId });
    }
    // If we are in "Direct Chat" virtual room and have no other chats, maybe leave?
    // For now, just switching target is enough.
  };

  const exitRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
    }
    setRoomId(null);
    setMessages([]);
    setActiveUsers([]);
    sharedSecretsRef.current.clear();
    // Do NOT clear keys or identity
    setActiveChatTarget('ROOM');
    setUnreadCounts({});
    setPendingTargetUser(null);
  };

  const sendMessage = async (text: string) => {
    if (!socketRef.current || !ownKeyPair) return;

    const timestamp = Date.now();
    const msgId = `msg-${timestamp}`;
    const isDirect = activeChatTarget !== 'ROOM';

    // Always include public key
    const publicKeyJwk = await exportPublicKeyJwk(ownKeyPair.publicKey);
    const publicKeyString = JSON.stringify(publicKeyJwk);

    setMessages((prev: DecryptedMessage[]) => [...prev, {
      id: msgId,
      timestamp,
      text,
      senderIsSelf: true,
      senderName: userIdentity?.username || 'Me',
      targetSocketId: isDirect ? activeChatTarget : undefined,
      isDirect
    } as DecryptedMessage]);

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
      activeUsers.forEach(async (user: UserProfile) => {
        const secret = sharedSecretsRef.current.get(user.socketId);
        if (!secret) return;

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

  return (
    <ChatContext.Provider value={{
      roomId, joinRoom, leaveRoom,
      userIdentity, ownKeyPair, activeUsers,
      messages, sendMessage,
      sendFileOffer, acceptFileOffer, declineFileOffer, fileOffers,
      cryptoStatusMessage,
      activeChatTarget, setActiveChatTarget: handleSetActiveChatTarget,
      unreadCounts,
      setPendingTargetUser,
      findUser,
      chatRequests,
      startDirectChat,
      acceptDirectChat,
      closeDirectChat
    }}>
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