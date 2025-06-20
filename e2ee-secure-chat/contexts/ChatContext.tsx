
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { KeyPair, DecryptedMessage, MessageType, EncryptedTextMessage, BroadcastChannelMessage, PublicKeyShareMessage, SystemMessage, SdpSignalMessage, IceCandidateSignalMessage, SystemMessageType } from '../types';
import { generateAppKeyPair, encryptText, decryptText, encodeBase64, decodeBase64 } from '../utils/encryptionService';

// Libsodium will be available globally from the script tag in index.html
declare const sodium: any;

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Example STUN server
};
const BROADCAST_CHANNEL_PREFIX = "e2ee-chat-";
const WEBRTC_DATA_CHANNEL_LABEL = "e2ee-chat-channel";

interface ChatContextType {
  roomId: string | null;
  setRoomId: (roomId: string | null) => void;
  ownKeyPair: KeyPair | null;
  peerPublicKeyBase64: string | null;
  messages: DecryptedMessage[];
  sendMessage: (text: string) => Promise<void>; // sendMessage is now async
  isPeerConnected: boolean; 
  isWebRTCConnected: boolean;
  clearChatData: () => void;
  sdpOfferToShow: string | null;
  sdpAnswerToShow: string | null;
  setRemoteSdp: (sdp: string, type: 'offer' | 'answer') => Promise<void>; // Now async
  addRemoteIceCandidate: (candidateJson: string) => Promise<void>; // Now async
  initiateWebRTCOffer: () => Promise<void>;  // Now async
  isSodiumReady: boolean; // Changed from isNaClReady
  sodiumLoadingStatusMessage: string | null; // Changed from naclLoadingStatusMessage
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [roomId, setRoomIdInternal] = useState<string | null>(null);
  const [ownKeyPair, setOwnKeyPair] = useState<KeyPair | null>(null);
  const [peerPublicKeyBase64, setPeerPublicKeyBase64] = useState<string | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [isPeerConnectedViaPK, setIsPeerConnectedViaPK] = useState<boolean>(false);
  const [isWebRTCConnected, setIsWebRTCConnected] = useState<boolean>(false);
  
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localInstanceIdRef = useRef<string>(Date.now().toString() + Math.random().toString());
  const webRTCInitiatorRef = useRef<boolean>(false); 

  const [sdpOfferToShow, setSdpOfferToShow] = useState<string | null>(null);
  const [sdpAnswerToShow, setSdpAnswerToShow] = useState<string | null>(null);

  const [isSodiumReady, setIsSodiumReady] = useState(false);
  const [sodiumLoadingStatusMessage, setSodiumLoadingStatusMessage] = useState<string | null>(
    "Initializing cryptography..."
  );

  useEffect(() => {
    if (typeof sodium !== 'undefined' && typeof sodium.ready !== 'undefined') {
      setSodiumLoadingStatusMessage("Cryptography library loading...");
      sodium.ready.then(() => {
        setIsSodiumReady(true);
        setSodiumLoadingStatusMessage(null);
        // console.log("Sodium.js is ready.");
      }).catch((error: any) => {
        setIsSodiumReady(false);
        setSodiumLoadingStatusMessage("Failed to load cryptography library (Sodium). Please refresh.");
        console.error("Sodium.js failed to initialize:", error);
      });
    } else {
      // This case means the <script> tag for sodium.js didn't load or is malformed
      setIsSodiumReady(false);
      setSodiumLoadingStatusMessage("Cryptography library (Sodium.js) not found or script error. Please refresh.");
    }
  }, []);


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
      if (dataChannelRef.current.readyState !== 'closed') {
        dataChannelRef.current.close();
      }
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.ondatachannel = null;
      if (peerConnectionRef.current.signalingState !== 'closed') {
        peerConnectionRef.current.close();
      }
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
    setPeerPublicKeyBase64(null);
    setIsPeerConnectedViaPK(false);
    resetWebRTCState();
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.onmessage = null;
      broadcastChannelRef.current.onmessageerror = null;
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }
  }, [resetWebRTCState]);

  const setRoomId = async (newRoomId: string | null) => { // setRoomId is now async
    if (roomId === newRoomId && newRoomId !== null) return; 
    
    clearChatData(); 
    setRoomIdInternal(newRoomId);

    if (newRoomId) {
      if (!isSodiumReady) {
        if (sodiumLoadingStatusMessage && sodiumLoadingStatusMessage.includes("loading...")) {
             addSystemMessage("Cryptography library is still loading. Please wait a moment and try again.", SystemMessageType.ERROR);
        } else {
             addSystemMessage(sodiumLoadingStatusMessage || "Encryption library (Sodium) not available. Please refresh.", SystemMessageType.ERROR);
        }
        return;
      }
      
      try {
        const newKeys = await generateAppKeyPair(); 
        setOwnKeyPair(newKeys);
        addSystemMessage("Your encryption keys generated.", SystemMessageType.KEY_EXCHANGE);
      } catch (e: any) {
        addSystemMessage(e.message || "Key generation failed: Critical crypto library issue. Please refresh.", SystemMessageType.ERROR);
        setOwnKeyPair(null); 
      }
    }
  };

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
    channel.onmessage = async (event) => { // onmessage is now async
      try {
        const encryptedPayload = JSON.parse(event.data) as Omit<EncryptedTextMessage, 'type' | 'id' | 'timestamp'> & { senderPublicKeyBase64: string };
        if (!ownKeyPair || !encryptedPayload.senderPublicKeyBase64) {
          addSystemMessage("Cannot decrypt WebRTC message: missing keys.", SystemMessageType.ERROR);
          return;
        }
        const peerKey = decodeBase64(encryptedPayload.senderPublicKeyBase64);
        const decryptedText = await decryptText(encryptedPayload.encryptedText, encryptedPayload.nonce, ownKeyPair.privateKey, peerKey); // Use privateKey

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
  }, [addSystemMessage, ownKeyPair]); // ownKeyPair's structure has changed (privateKey)

  const setupPeerConnection = useCallback(() => {
    if (!ownKeyPair) { 
        addSystemMessage("Cannot setup WebRTC: Own keys not generated (Sodium issue?).", SystemMessageType.ERROR);
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


  const initiateWebRTCOffer = useCallback(async () => { // initiateWebRTCOffer is now async
    if (!isPeerConnectedViaPK) {
      addSystemMessage("Cannot initiate WebRTC: Peer's public key not known yet.", SystemMessageType.WEBRTC_STATUS);
      return;
    }
    if (!isSodiumReady || !ownKeyPair) {
      addSystemMessage("Cannot initiate WebRTC: Cryptography library not ready or keys missing.", SystemMessageType.ERROR);
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
  }, [isPeerConnectedViaPK, addSystemMessage, setupPeerConnection, setupDataChannelEvents, isSodiumReady, ownKeyPair]);

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
    
    addSystemMessage(`Joined room: ${roomId}. Broadcasting public key...`, SystemMessageType.CONNECTION_STATUS);
    const myPublicKeyBase64 = encodeBase64(ownKeyPair.publicKey);
    const pkShareMsg: BroadcastChannelMessage = {
      type: MessageType.PUBLIC_KEY_SHARE,
      payload: { publicKeyBase64: myPublicKeyBase64 } as PublicKeyShareMessage,
      senderId: localInstanceIdRef.current,
    };
    broadcastChannelRef.current.postMessage(pkShareMsg);

    broadcastChannelRef.current.onmessage = async (event: MessageEvent<BroadcastChannelMessage>) => { // onmessage is async
      const { data } = event;
      if (data.senderId === localInstanceIdRef.current) return; 

      let pc = peerConnectionRef.current;

      switch (data.type) {
        case MessageType.PUBLIC_KEY_SHARE:
          const pkPayload = data.payload as PublicKeyShareMessage;
          if (pkPayload.publicKeyBase64 && pkPayload.publicKeyBase64 !== peerPublicKeyBase64) {
            setPeerPublicKeyBase64(pkPayload.publicKeyBase64);
            setIsPeerConnectedViaPK(true);
            addSystemMessage("Peer's public key received. E2EE ready. You can now initiate WebRTC.", SystemMessageType.KEY_EXCHANGE);
             broadcastChannelRef.current?.postMessage(pkShareMsg); 
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
          if (isWebRTCConnected) return;
          const encryptedTextPayload = data.payload as Omit<EncryptedTextMessage, 'type' | 'id' | 'timestamp'> & { senderPublicKeyBase64: string };
          if (!ownKeyPair || !encryptedTextPayload.senderPublicKeyBase64) {
            addSystemMessage("Cannot decrypt BC message: missing keys.", SystemMessageType.ERROR);
            return;
          }
          const peerKey = decodeBase64(encryptedTextPayload.senderPublicKeyBase64);
          const decryptedText = await decryptText(encryptedTextPayload.encryptedText, encryptedTextPayload.nonce, ownKeyPair.privateKey, peerKey); // Use privateKey
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

  }, [roomId, ownKeyPair, peerPublicKeyBase64, addSystemMessage, isWebRTCConnected, setupPeerConnection]);

  const setRemoteSdp = async (sdpJson: string, type: 'offer' | 'answer') => { // setRemoteSdp is async
    if (!isSodiumReady || !ownKeyPair) {
        addSystemMessage("Cannot process SDP: Cryptography library not ready or keys missing.", SystemMessageType.ERROR);
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

  const addRemoteIceCandidate = async (candidateJson: string) => { // addRemoteIceCandidate is async
    if (!isSodiumReady || !ownKeyPair) {
        addSystemMessage("Cannot process ICE: Cryptography library not ready or keys missing.", SystemMessageType.ERROR);
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
    return () => {
      clearChatData(); 
    }
  }, [clearChatData]); 

  const sendMessage = async (text: string) => { // sendMessage is now async
    if (!roomId || !ownKeyPair || !peerPublicKeyBase64) {
      addSystemMessage("Cannot send message: connection/keys missing.", SystemMessageType.ERROR);
      return;
    }
     if (!isSodiumReady) {
      addSystemMessage("Cannot send message: Cryptography library not ready.", SystemMessageType.ERROR);
      return;
    }

    const peerKey = decodeBase64(peerPublicKeyBase64);
    const encrypted = await encryptText(text, ownKeyPair.privateKey, peerKey); // Use privateKey and await

    if (!encrypted) {
      addSystemMessage("Failed to encrypt message.", SystemMessageType.ERROR);
      return;
    }
    
    const ownPkBase64 = encodeBase64(ownKeyPair.publicKey);
    const messagePayload = { 
      encryptedText: encrypted.encryptedTextBase64,
      nonce: encrypted.nonceBase64,
      senderPublicKeyBase64: ownPkBase64,
    };

    let messageSent = false;
    if (isWebRTCConnected && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(messagePayload));
        messageSent = true;
      } catch (error) {
        console.error("Failed to send message via WebRTC Data Channel:", error);
        addSystemMessage(`Failed to send message via WebRTC: ${error}`, SystemMessageType.ERROR);
      }
    }
    
    if (!messageSent && broadcastChannelRef.current) { 
      const bcMessage: BroadcastChannelMessage = {
        type: MessageType.TEXT,
        payload: messagePayload,
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
        roomId, setRoomId, ownKeyPair, peerPublicKeyBase64, messages, sendMessage, 
        isPeerConnected: isPeerConnectedViaPK, 
        isWebRTCConnected,
        clearChatData,
        sdpOfferToShow, sdpAnswerToShow,
        setRemoteSdp, addRemoteIceCandidate,
        initiateWebRTCOffer,
        isSodiumReady, sodiumLoadingStatusMessage
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