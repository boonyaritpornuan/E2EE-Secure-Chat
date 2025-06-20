import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { KeyPair, DecryptedMessage, MessageType, EncryptedTextMessage, BroadcastChannelMessage, PublicKeyShareMessage, SdpSignalMessage, IceCandidateSignalMessage, SystemMessageType } from '../types';
import { 
  generateAppKeyPair, 
  encryptText, 
  decryptText, 
  exportPublicKeyJwk, 
  importPublicKeyJwk,
  deriveSharedSecret,
  arrayBufferToBase64, // Not directly used here, but good to have in mind for other data
  base64ToArrayBuffer, // Not directly used here
} from '../utils/encryptionService';

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
const BROADCAST_CHANNEL_PREFIX = "e2ee-chat-";
const WEBRTC_DATA_CHANNEL_LABEL = "e2ee-chat-channel";

interface ChatContextType {
  roomId: string | null;
  setRoomId: (roomId: string | null) => void;
  ownKeyPair: KeyPair | null;
  peerPublicKeyJwk: JsonWebKey | null; // Store peer's public key as JWK object
  derivedAesKey: CryptoKey | null; // Store the derived AES key
  messages: DecryptedMessage[];
  sendMessage: (text: string) => Promise<void>;
  isPeerConnected: boolean; // True if peer's public key is known
  isCryptoReady: boolean; // True if shared AES key is derived
  isWebRTCConnected: boolean;
  clearChatData: () => void;
  sdpOfferToShow: string | null;
  sdpAnswerToShow: string | null;
  setRemoteSdp: (sdp: string, type: 'offer' | 'answer') => Promise<void>;
  addRemoteIceCandidate: (candidateJson: string) => Promise<void>;
  initiateWebRTCOffer: () => Promise<void>;
  cryptoStatusMessage: string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [roomId, setRoomIdInternal] = useState<string | null>(null);
  const [ownKeyPair, setOwnKeyPair] = useState<KeyPair | null>(null);
  const [peerPublicKeyJwk, setPeerPublicKeyJwk] = useState<JsonWebKey | null>(null);
  const [derivedAesKey, setDerivedAesKey] = useState<CryptoKey | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [isWebRTCConnected, setIsWebRTCConnected] = useState<boolean>(false);
  const [cryptoStatusMessage, setCryptoStatusMessage] = useState<string | null>("Initializing...");

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localInstanceIdRef = useRef<string>(Date.now().toString() + Math.random().toString());
  const webRTCInitiatorRef = useRef<boolean>(false); 

  const [sdpOfferToShow, setSdpOfferToShow] = useState<string | null>(null);
  const [sdpAnswerToShow, setSdpAnswerToShow] = useState<string | null>(null);

  const isPeerConnected = !!peerPublicKeyJwk;
  const isCryptoReady = !!derivedAesKey;

  const addSystemMessage = useCallback((text: string, systemType: SystemMessageType = SystemMessageType.GENERAL) => {
    const systemMessage: DecryptedMessage = {
      id: `sys-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      text,
      isSystem: true,
      senderIsSelf: false,
      systemType,
    };
    setMessages(prev => [...prev, systemMessage]);
  }, []);
  
  const resetWebRTCState = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.onopen = null;
      dataChannelRef.current.onclose = null;
      dataChannelRef.current.onerror = null;
      dataChannelRef.current.onmessage = null;
      if (dataChannelRef.current.readyState !== 'closed') dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.ondatachannel = null;
      if (peerConnectionRef.current.signalingState !== 'closed') peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsWebRTCConnected(false);
    webRTCInitiatorRef.current = false;
    setSdpOfferToShow(null);
    setSdpAnswerToShow(null);
    addSystemMessage("WebRTC connection reset.", SystemMessageType.WEBRTC_STATUS);
  },[addSystemMessage]);

  const clearChatData = useCallback(() => {
    setMessages([]);
    setOwnKeyPair(null);
    setPeerPublicKeyJwk(null);
    setDerivedAesKey(null);
    setCryptoStatusMessage("Initializing...");
    resetWebRTCState();
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.onmessage = null;
      broadcastChannelRef.current.onmessageerror = null;
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }
  }, [resetWebRTCState]);

  const setRoomId = async (newRoomId: string | null) => {
    if (roomId === newRoomId && newRoomId !== null) return;
    
    clearChatData();
    setRoomIdInternal(newRoomId);

    if (newRoomId) {
      setCryptoStatusMessage("Generating your encryption keys...");
      try {
        const newKeys = await generateAppKeyPair();
        setOwnKeyPair(newKeys);
        addSystemMessage("Your encryption keys generated. Waiting for peer.", SystemMessageType.KEY_EXCHANGE);
        setCryptoStatusMessage("Keys generated. Waiting for peer's public key.");
      } catch (e: any) {
        const errorMsg = e.message || "Key generation failed. Please refresh.";
        addSystemMessage(errorMsg, SystemMessageType.ERROR);
        setCryptoStatusMessage(errorMsg);
        setOwnKeyPair(null);
      }
    }
  };

  // Effect to derive shared AES key when own keys and peer's public key are available
  useEffect(() => {
    if (ownKeyPair && peerPublicKeyJwk && !derivedAesKey) {
      setCryptoStatusMessage("Peer key received. Deriving shared secret...");
      const derive = async () => {
        try {
          const peerCryptoKey = await importPublicKeyJwk(peerPublicKeyJwk);
          const aesKey = await deriveSharedSecret(ownKeyPair.privateKey, peerCryptoKey);
          setDerivedAesKey(aesKey);
          addSystemMessage("Shared AES key derived. End-to-end encryption active!", SystemMessageType.KEY_EXCHANGE);
          setCryptoStatusMessage("E2EE Active. Shared secret established.");
        } catch (e) {
          console.error("Failed to derive shared secret:", e);
          const errorMsg = `Failed to derive shared secret: ${e instanceof Error ? e.message : String(e)}`;
          addSystemMessage(errorMsg, SystemMessageType.ERROR);
          setCryptoStatusMessage(errorMsg);
          setDerivedAesKey(null);
        }
      };
      derive();
    } else if (!ownKeyPair && roomId) {
        setCryptoStatusMessage("Generating your keys...");
    } else if (ownKeyPair && !peerPublicKeyJwk && roomId) {
        setCryptoStatusMessage("Keys generated. Waiting for peer's public key.");
    } else if (!roomId) {
        setCryptoStatusMessage("Enter a Room ID to start.");
    }

  }, [ownKeyPair, peerPublicKeyJwk, derivedAesKey, addSystemMessage, roomId]);


  const setupDataChannelEvents = useCallback((channel: RTCDataChannel) => {
    channel.onopen = () => {
      addSystemMessage("WebRTC Data Channel OPEN. P2P connection established!", SystemMessageType.WEBRTC_STATUS);
      setIsWebRTCConnected(true);
      setSdpOfferToShow(null); 
      setSdpAnswerToShow(null);
    };
    channel.onclose = () => {
      addSystemMessage("WebRTC Data Channel CLOSED.", SystemMessageType.WEBRTC_STATUS);
      setIsWebRTCConnected(false);
    };
    channel.onerror = (errorEvent) => {
        const error = errorEvent as RTCErrorEvent;
        console.error("Data Channel Error:", error);
        addSystemMessage(`WebRTC Data Channel error: ${error.error?.message || 'Unknown error'}`, SystemMessageType.ERROR);
    };
    channel.onmessage = async (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        // Expecting { encryptedDataB64: string, ivB64: string, senderPublicKeyJwkString: string }
        // The senderPublicKeyJwkString is from BaseMessage, parsedData is the EncryptedTextMessage part
        const { encryptedDataB64, ivB64 } = parsedData as Omit<EncryptedTextMessage, 'type'|'id'|'timestamp'|'senderPublicKeyJwkString'>;

        if (!derivedAesKey) {
          addSystemMessage("Cannot decrypt WebRTC message: shared key not derived.", SystemMessageType.ERROR);
          return;
        }
        const decryptedText = await decryptText(encryptedDataB64, ivB64, derivedAesKey);

        if (decryptedText) {
          const newMessage: DecryptedMessage = {
            id: `msg-webrtc-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            text: decryptedText,
            senderIsSelf: false,
          };
          setMessages(prev => [...prev, newMessage]);
        } else {
          addSystemMessage("Failed to decrypt WebRTC message (possibly wrong key or corrupt).", SystemMessageType.ERROR);
        }
      } catch (error) {
        console.error("Error processing Data Channel message:", error);
        addSystemMessage("Error processing incoming WebRTC message.", SystemMessageType.ERROR);
      }
    };
  }, [addSystemMessage, derivedAesKey]);

  const setupPeerConnection = useCallback(() => {
    if (!ownKeyPair) { 
        addSystemMessage("Cannot setup WebRTC: Own keys not generated.", SystemMessageType.ERROR);
        return null;
    }
    if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
        return peerConnectionRef.current;
    }
    
    addSystemMessage("Initializing WebRTC Peer Connection...", SystemMessageType.WEBRTC_STATUS);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (broadcastChannelRef.current) {
          const iceMessage: BroadcastChannelMessage = {
            type: MessageType.ICE_CANDIDATE,
            payload: { candidate: event.candidate.toJSON() } as IceCandidateSignalMessage,
            senderId: localInstanceIdRef.current,
          };
          broadcastChannelRef.current.postMessage(iceMessage);
        } else {
            addSystemMessage("Cannot send ICE candidate: BroadcastChannel unavailable.", SystemMessageType.ERROR);
        }
      } else {
        addSystemMessage("All ICE candidates gathered.", SystemMessageType.WEBRTC_STATUS);
      }
    };

    pc.onconnectionstatechange = () => {
      if (!pc) return;
      addSystemMessage(`WebRTC Connection State: ${pc.connectionState}`, SystemMessageType.WEBRTC_STATUS);
      if (pc.connectionState === 'connected') {
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
           setIsWebRTCConnected(true);
        }
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setIsWebRTCConnected(false);
        if(pc.connectionState === 'failed'){
            addSystemMessage("WebRTC connection failed. Try re-initiating offer or check network.", SystemMessageType.ERROR);
        }
      }
    };
    
    pc.ondatachannel = (event) => {
      addSystemMessage("Received WebRTC Data Channel from peer.", SystemMessageType.WEBRTC_STATUS);
      dataChannelRef.current = event.channel;
      setupDataChannelEvents(event.channel);
    };
    return pc;
  }, [addSystemMessage, ownKeyPair, setupDataChannelEvents]);


  const initiateWebRTCOffer = useCallback(async () => {
    if (!isPeerConnected) { // Check if peer's public key JWK is known
      addSystemMessage("Cannot initiate WebRTC: Peer's public key not known yet.", SystemMessageType.WEBRTC_STATUS);
      return;
    }
    if (!ownKeyPair) {
      addSystemMessage("Cannot initiate WebRTC: Own keys missing.", SystemMessageType.ERROR);
      return;
    }
    
    let pc = peerConnectionRef.current;
    if (!pc || pc.signalingState === 'closed') {
        pc = setupPeerConnection();
    }
    if (!pc) {
        addSystemMessage("Failed to setup PeerConnection for offer.", SystemMessageType.ERROR);
        return;
    }

    if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') { 
      addSystemMessage(`Cannot create offer in WebRTC state: ${pc.signalingState}. Please wait or reset.`, SystemMessageType.WEBRTC_STATUS);
      return;
    }

    webRTCInitiatorRef.current = true; 
    addSystemMessage("Creating WebRTC Data Channel & Offer...", SystemMessageType.WEBRTC_STATUS);
    
    if (!dataChannelRef.current || dataChannelRef.current.readyState === 'closed' || dataChannelRef.current.readyState === 'closing') {
        const dc = pc.createDataChannel(WEBRTC_DATA_CHANNEL_LABEL);
        dataChannelRef.current = dc;
        setupDataChannelEvents(dc);
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setSdpOfferToShow(JSON.stringify(offer)); 
      
      if (broadcastChannelRef.current) {
        const offerMessage: BroadcastChannelMessage = {
          type: MessageType.SDP_OFFER,
          payload: { sdp: offer } as SdpSignalMessage,
          senderId: localInstanceIdRef.current,
        };
        broadcastChannelRef.current.postMessage(offerMessage);
        addSystemMessage("WebRTC Offer sent via BroadcastChannel.", SystemMessageType.WEBRTC_STATUS);
      } else {
         addSystemMessage("WebRTC Offer created. Please share it manually.", SystemMessageType.WEBRTC_STATUS);
      }
    } catch (error) {
      console.error("Failed to create WebRTC offer:", error);
      addSystemMessage(`Failed to create WebRTC offer: ${error}`, SystemMessageType.ERROR);
      webRTCInitiatorRef.current = false; 
    }
  }, [isPeerConnected, addSystemMessage, ownKeyPair, setupPeerConnection, setupDataChannelEvents]);

  useEffect(() => {
    if (!roomId || !ownKeyPair) { 
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.onmessage = null;
        broadcastChannelRef.current.onmessageerror = null;
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
      return;
    }

    const channelName = `${BROADCAST_CHANNEL_PREFIX}${roomId}`;
    if (broadcastChannelRef.current && broadcastChannelRef.current.name !== channelName) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }

    if (!broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current = new BroadcastChannel(channelName);
        addSystemMessage(`BroadcastChannel '${channelName}' opened.`, SystemMessageType.CONNECTION_STATUS);
      } catch (error) {
        console.error("Failed to create BroadcastChannel:", error);
        addSystemMessage(`Error creating BroadcastChannel: ${error}. Chat may not work across tabs.`, SystemMessageType.ERROR);
        return;
      }
    }
    
    const shareOwnPublicKey = async () => {
      if (ownKeyPair) {
        try {
          const ownPublicJwk = await exportPublicKeyJwk(ownKeyPair.publicKey);
          addSystemMessage(`Broadcasting public key for room: ${roomId}...`, SystemMessageType.CONNECTION_STATUS);
          const pkShareMsg: BroadcastChannelMessage = {
            type: MessageType.PUBLIC_KEY_SHARE,
            payload: { publicKeyJwk: ownPublicJwk } as PublicKeyShareMessage,
            senderId: localInstanceIdRef.current,
          };
          broadcastChannelRef.current?.postMessage(pkShareMsg);
        } catch (e) {
          addSystemMessage(`Failed to export or send own public key: ${e}`, SystemMessageType.ERROR);
        }
      }
    };
    shareOwnPublicKey(); // Call it immediately

    broadcastChannelRef.current.onmessage = async (event: MessageEvent<BroadcastChannelMessage>) => {
      const { data } = event;
      if (data.senderId === localInstanceIdRef.current) return; 

      let pc = peerConnectionRef.current;

      switch (data.type) {
        case MessageType.PUBLIC_KEY_SHARE:
          const pkPayload = data.payload as PublicKeyShareMessage;
          if (pkPayload.publicKeyJwk && JSON.stringify(pkPayload.publicKeyJwk) !== JSON.stringify(peerPublicKeyJwk)) {
            setPeerPublicKeyJwk(pkPayload.publicKeyJwk);
            addSystemMessage("Peer's public key received.", SystemMessageType.KEY_EXCHANGE);
            // Re-broadcast own key so peer also gets it if they joined later or missed it
            shareOwnPublicKey();
          }
          break;

        case MessageType.SDP_OFFER:
          if (webRTCInitiatorRef.current) return;
          webRTCInitiatorRef.current = false; 
          if (!pc || pc.signalingState === 'closed') pc = setupPeerConnection();
          if (!pc) {
            addSystemMessage("PeerConnection not ready to handle offer.", SystemMessageType.ERROR);
            return;
          }
          const offerPayload = data.payload as SdpSignalMessage;
          addSystemMessage("Received WebRTC Offer. Processing...", SystemMessageType.WEBRTC_STATUS);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offerPayload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            setSdpAnswerToShow(JSON.stringify(answer)); 
            const answerMessage: BroadcastChannelMessage = {
              type: MessageType.SDP_ANSWER,
              payload: { sdp: answer } as SdpSignalMessage,
              senderId: localInstanceIdRef.current,
            };
            broadcastChannelRef.current?.postMessage(answerMessage);
            addSystemMessage("WebRTC Answer created and sent.", SystemMessageType.WEBRTC_STATUS);
          } catch (error) {
            console.error("Error handling SDP offer / creating answer:", error);
            addSystemMessage(`Error processing WebRTC Offer: ${error}`, SystemMessageType.ERROR);
          }
          break;

        case MessageType.SDP_ANSWER:
          if (!webRTCInitiatorRef.current) return;
          if (!pc) {
            addSystemMessage("PeerConnection not ready to handle answer.", SystemMessageType.ERROR);
            return;
          }
          const answerPayload = data.payload as SdpSignalMessage;
          addSystemMessage("Received WebRTC Answer. Applying...", SystemMessageType.WEBRTC_STATUS);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answerPayload.sdp));
            addSystemMessage("WebRTC Answer applied.", SystemMessageType.WEBRTC_STATUS);
          } catch (error) {
            console.error("Error handling SDP answer:", error);
            addSystemMessage(`Error processing WebRTC Answer: ${error}`, SystemMessageType.ERROR);
          }
          break;

        case MessageType.ICE_CANDIDATE:
          if (!pc || pc.signalingState === 'closed') return;
          const icePayload = data.payload as IceCandidateSignalMessage;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(icePayload.candidate));
          } catch (error) { /* console.warn("Error adding received ICE candidate:", error); */ }
          break;
        
        case MessageType.TEXT: 
          if (isWebRTCConnected) return; // Prioritize WebRTC for messages if connected
          const textPayload = data.payload as Omit<EncryptedTextMessage, 'type' | 'id' | 'timestamp'| 'senderPublicKeyJwkString'>; // senderPublicKeyJwkString is in BaseMessage
          if (!derivedAesKey) {
            addSystemMessage("Cannot decrypt BC message: shared key not derived.", SystemMessageType.ERROR);
            return;
          }
          const decryptedText = await decryptText(textPayload.encryptedDataB64, textPayload.ivB64, derivedAesKey);
          if (decryptedText) {
            setMessages(prev => [...prev, { id: `msg-bc-${Date.now()}`, timestamp: Date.now(), text: decryptedText, senderIsSelf: false }]);
          } else {
            addSystemMessage("Failed to decrypt BC message.", SystemMessageType.ERROR);
          }
          break;
      }
    };
    
    broadcastChannelRef.current.onmessageerror = (event) => {
        console.error("BroadcastChannel message error:", event);
        addSystemMessage("Error receiving message via BC. Check console.", SystemMessageType.ERROR);
    };

    // Cleanup effect for BroadcastChannel
    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.onmessage = null;
        broadcastChannelRef.current.onmessageerror = null;
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
        addSystemMessage("BroadcastChannel closed.", SystemMessageType.CONNECTION_STATUS);
      }
    };
  }, [roomId, ownKeyPair, peerPublicKeyJwk, addSystemMessage, isWebRTCConnected, setupPeerConnection, derivedAesKey]);

  const setRemoteSdp = async (sdpJson: string, type: 'offer' | 'answer') => {
    if (!ownKeyPair) {
        addSystemMessage("Cannot process SDP: Own keys missing.", SystemMessageType.ERROR);
        return;
    }
    let pc = peerConnectionRef.current;
    if (!pc || pc.signalingState === 'closed') {
      pc = setupPeerConnection(); 
    }
    if (!pc) {
      addSystemMessage("PeerConnection not ready for manual SDP.", SystemMessageType.ERROR);
      return;
    }

    try {
      const sdp = JSON.parse(sdpJson) as RTCSessionDescriptionInit;
      if (typeof sdp.type !== 'string' || typeof sdp.sdp !== 'string') {
        throw new Error("Invalid SDP format.");
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      addSystemMessage(`Manual ${type} SDP set successfully.`, SystemMessageType.WEBRTC_STATUS);

      if (type === 'offer' && !webRTCInitiatorRef.current) { 
        webRTCInitiatorRef.current = false; 
        addSystemMessage("Processing manual offer to create an answer...", SystemMessageType.WEBRTC_STATUS);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        setSdpAnswerToShow(JSON.stringify(answer));
        addSystemMessage("Answer created for manual offer. Please share it.", SystemMessageType.WEBRTC_STATUS);
        
        if (broadcastChannelRef.current) {
           const answerMessage: BroadcastChannelMessage = {
              type: MessageType.SDP_ANSWER,
              payload: { sdp: answer } as SdpSignalMessage,
              senderId: localInstanceIdRef.current,
            };
            broadcastChannelRef.current.postMessage(answerMessage);
        }
      } else if (type === 'answer') {
         addSystemMessage("Manual answer applied.", SystemMessageType.WEBRTC_STATUS);
      }
    } catch (error) {
      console.error(`Error setting manual ${type} SDP:`, error);
      addSystemMessage(`Error setting manual ${type} SDP: ${error}. Ensure it's valid JSON.`, SystemMessageType.ERROR);
    }
  };

  const addRemoteIceCandidate = async (candidateJson: string) => {
    if (!ownKeyPair) {
        addSystemMessage("Cannot process ICE: Own keys missing.", SystemMessageType.ERROR);
        return;
    }
    const pc = peerConnectionRef.current;
    if (!pc) {
      addSystemMessage("PeerConnection not ready for manual ICE.", SystemMessageType.ERROR);
      return;
    }
    try {
      const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit;
       if (!candidate || (candidate.candidate === undefined && candidate.sdpMid === undefined && candidate.sdpMLineIndex === undefined && candidate.usernameFragment === undefined)) {
        throw new Error("Invalid ICE candidate format.");
      }
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      addSystemMessage("Manual ICE candidate added.", SystemMessageType.WEBRTC_STATUS);
    } catch (error) {
      console.error("Error adding manual ICE candidate:", error);
      addSystemMessage(`Error adding manual ICE candidate: ${error}. Ensure it's valid JSON.`, SystemMessageType.ERROR);
    }
  };

  useEffect(() => { 
    return () => { clearChatData(); }
  }, [clearChatData]); 

  const sendMessage = async (text: string) => {
    if (!roomId || !ownKeyPair || !peerPublicKeyJwk || !derivedAesKey) {
      addSystemMessage("Cannot send message: connection, keys, or shared secret missing.", SystemMessageType.ERROR);
      return;
    }

    const encrypted = await encryptText(text, derivedAesKey);
    if (!encrypted) {
      addSystemMessage("Failed to encrypt message.", SystemMessageType.ERROR);
      return;
    }
    
    const ownPublicJwk = await exportPublicKeyJwk(ownKeyPair.publicKey);
    const senderPublicKeyJwkString = JSON.stringify(ownPublicJwk);

    // This is the actual data payload for an EncryptedTextMessage, excluding BaseMessage fields
    const encryptedMessagePayload = { 
      encryptedDataB64: encrypted.encryptedDataB64,
      ivB64: encrypted.ivB64,
    };
    
    // This is what will be stringified and sent over the wire, including BaseMessage fields
    const fullMessageToSend: EncryptedTextMessage = {
        id: `msg-${Date.now()}`, // Temporary ID, could be generated better
        timestamp: Date.now(),
        senderPublicKeyJwkString,
        type: MessageType.TEXT,
        ...encryptedMessagePayload
    };


    let messageSent = false;
    if (isWebRTCConnected && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        // Send only the part relevant to EncryptedTextMessage structure, as BaseMessage fields are implicit or handled by context
        dataChannelRef.current.send(JSON.stringify(encryptedMessagePayload));
        messageSent = true;
      } catch (error) {
        console.error("Failed to send message via WebRTC Data Channel:", error);
        addSystemMessage(`Failed to send message via WebRTC: ${error}`, SystemMessageType.ERROR);
      }
    }
    
    if (!messageSent && broadcastChannelRef.current) { 
      const bcMessage: BroadcastChannelMessage = {
        type: MessageType.TEXT,
        // For BC, we send the full structure that the receiver's BC onmessage expects (which might be just encrypted parts)
        payload: encryptedMessagePayload, // Match what BC onmessage expects for TEXT
        senderId: localInstanceIdRef.current,
      };
      try {
        broadcastChannelRef.current.postMessage(bcMessage);
        messageSent = true;
      } catch (error) {
        console.error("Failed to send message via BroadcastChannel:", error);
        addSystemMessage(`Failed to send message via BC: ${error}`, SystemMessageType.ERROR);
      }
    }
    
    if (!messageSent) {
        addSystemMessage("No communication channel available to send message.", SystemMessageType.ERROR);
        return; 
    }

    const localMessage: DecryptedMessage = {
      id: `msg-self-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      text,
      senderIsSelf: true,
    };
    setMessages(prev => [...prev, localMessage]);
  };

  return (
    <ChatContext.Provider value={{ 
        roomId, setRoomId, ownKeyPair, peerPublicKeyJwk, derivedAesKey, messages, sendMessage, 
        isPeerConnected, 
        isCryptoReady,
        isWebRTCConnected,
        clearChatData,
        sdpOfferToShow, sdpAnswerToShow,
        setRemoteSdp, addRemoteIceCandidate,
        initiateWebRTCOffer,
        cryptoStatusMessage
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