import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../contexts/ChatContext';
import { DecryptedMessage, SystemMessageType } from '../types';

const ChatRoom: React.FC = () => {
  const { 
    roomId, setRoomId, messages, sendMessage, 
    isPeerConnected, 
    isWebRTCConnected, 
    ownKeyPair, peerPublicKeyBase64, 
    clearChatData,
    sdpOfferToShow, sdpAnswerToShow,
    setRemoteSdp, addRemoteIceCandidate,
    initiateWebRTCOffer,
    isSodiumReady // Added for completeness, though not directly used for disabling here yet
  } = useChat();
  
  const [inputText, setInputText] = useState('');
  const [manualSdp, setManualSdp] = useState('');
  const [manualIce, setManualIce] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleLeaveRoom = () => {
    clearChatData();
    setRoomId(null); // setRoomId is async but we don't need to await here
  };

  const handleSendMessage = async (e: React.FormEvent) => { // handleSendMessage is now async
    e.preventDefault();
    if (inputText.trim() && ownKeyPair && peerPublicKeyBase64 && isSodiumReady) { 
      try {
        await sendMessage(inputText.trim());
        setInputText('');
      } catch (error) {
        console.error("Error sending message:", error);
        addSystemMessageUI("Failed to send message. Check console.");
      }
    } else if (!isPeerConnected) {
        addSystemMessageUI("Cannot send: Peer's public key not yet exchanged.");
    } else if (!isSodiumReady) {
        addSystemMessageUI("Cannot send: Cryptography library not ready.");
    }
  };

  const addSystemMessageUI = (text: string, type: SystemMessageType = SystemMessageType.ERROR) => {
    // This currently only logs to console. For UI messages, ChatContext.addSystemMessage is used.
    console.warn(`UI System Message (${type}): ${text}`);
  };


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getStatusMessage = () => {
    if (!isSodiumReady) return "Cryptography loading..."; // Status for Sodium
    if (!ownKeyPair) return "Generating your keys...";
    if (!isPeerConnected) return "Waiting for peer's public key via BroadcastChannel...";
    if (isWebRTCConnected) return "WebRTC P2P Connected!";
    if (isPeerConnected && !isWebRTCConnected) return "E2EE ready (via BroadcastChannel). Initiate or await WebRTC for full P2P.";
    return "Connecting...";
  };
  
  const handleSetRemoteOffer = async () => { // async
    if (manualSdp.trim()) await setRemoteSdp(manualSdp.trim(), 'offer');
    setManualSdp('');
  };
  const handleSetRemoteAnswer = async () => { // async
     if (manualSdp.trim()) await setRemoteSdp(manualSdp.trim(), 'answer');
     setManualSdp('');
  };
  const handleAddManualIce = async () => { // async
    if (manualIce.trim()) await addRemoteIceCandidate(manualIce.trim());
    setManualIce('');
  };

  const renderMessageText = (msg: DecryptedMessage) => {
    let prefix = "";
    if (msg.isSystem) {
      switch(msg.systemType) {
        case SystemMessageType.KEY_EXCHANGE: prefix = "🔑 "; break;
        case SystemMessageType.CONNECTION_STATUS: prefix = "📡 "; break;
        case SystemMessageType.WEBRTC_STATUS: prefix = "🌐 "; break;
        case SystemMessageType.ERROR: prefix = "⚠️ "; break;
        default: prefix = "ℹ️ ";
      }
    }
    return prefix + msg.text;
  }

  return (
    <div className="w-full max-w-3xl h-[calc(100vh-150px)] flex flex-col p-4 sm:p-6 bg-gray-800 rounded-xl shadow-2xl">
      <div className="mb-4">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-teal-400">
                Room: <span className="font-bold text-teal-300">{roomId}</span>
                </h2>
                <p className={`text-xs ${isWebRTCConnected ? 'text-green-400' : (isPeerConnected ? 'text-yellow-400' : 'text-red-400')}`}>
                {getStatusMessage()}
                </p>
            </div>
            <button
            onClick={handleLeaveRoom}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
            >
            Leave Room
            </button>
        </div>
        {isPeerConnected && !isWebRTCConnected && isSodiumReady && (
            <button
                onClick={() => initiateWebRTCOffer()} // initiateWebRTCOffer is async
                className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-sm"
            >
                Initiate/Retry WebRTC Offer
            </button>
        )}
      </div>

      {isPeerConnected && !isWebRTCConnected && isSodiumReady && (
        <div className="my-3 p-3 bg-gray-700 rounded-md text-xs space-y-2">
          <p className="font-semibold text-gray-300">Manual WebRTC Signaling (if cross-browser or BroadcastChannel fails):</p>
          {sdpOfferToShow && (
            <div>
              <label className="block text-gray-400">Your Offer SDP (<span className="text-teal-400">Ready to copy</span> and send to peer):</label>
              <textarea readOnly value={sdpOfferToShow} rows={3} className="w-full p-1 bg-gray-600 text-gray-200 rounded custom-scrollbar text-xs"></textarea>
            </div>
          )}
          {sdpAnswerToShow && (
            <div>
              <label className="block text-gray-400">Your Answer SDP (<span className="text-teal-400">Ready to copy</span> and send to peer):</label>
              <textarea readOnly value={sdpAnswerToShow} rows={3} className="w-full p-1 bg-gray-600 text-gray-200 rounded custom-scrollbar text-xs"></textarea>
            </div>
          )}
          <div>
            <label className="block text-gray-400">Paste Peer's Offer/Answer SDP:</label>
            <textarea value={manualSdp} onChange={(e) => setManualSdp(e.target.value)} rows={3} placeholder="Paste SDP JSON here" className="w-full p-1 bg-gray-600 text-gray-200 rounded custom-scrollbar text-xs"></textarea>
            <button onClick={handleSetRemoteOffer} className="mr-1 mt-1 px-2 py-1 bg-sky-600 hover:bg-sky-700 rounded text-xs">Set as Peer's Offer</button>
            <button onClick={handleSetRemoteAnswer} className="mt-1 px-2 py-1 bg-sky-600 hover:bg-sky-700 rounded text-xs">Set as Peer's Answer</button>
          </div>
           <div>
            <label className="block text-gray-400">Paste Peer's ICE Candidate:</label>
            <textarea value={manualIce} onChange={(e) => setManualIce(e.target.value)} rows={2} placeholder="Paste ONE ICE Candidate JSON here" className="w-full p-1 bg-gray-600 text-gray-200 rounded custom-scrollbar text-xs"></textarea>
            <button onClick={handleAddManualIce} className="mt-1 px-2 py-1 bg-sky-600 hover:bg-sky-700 rounded text-xs">Add Peer's ICE Candidate</button>
          </div>
        </div>
      )}

      <div className="flex-grow overflow-y-auto mb-4 p-3 bg-gray-750 rounded-md space-y-3 custom-scrollbar">
        {messages.map((msg: DecryptedMessage) => (
          <div
            key={msg.id}
            className={`flex ${msg.isSystem || msg.senderIsSelf ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-lg shadow ${
                msg.isSystem
                  ? `text-xs italic mx-auto ${msg.systemType === SystemMessageType.ERROR ? 'bg-red-700 text-red-100' : 'bg-gray-600 text-gray-300'}`
                  : msg.senderIsSelf
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-600 text-white'
              }`}
              aria-live={msg.isSystem ? "polite" : "off"}
            >
              <p className="text-sm break-words whitespace-pre-wrap">{renderMessageText(msg)}</p>
              <p className={`text-xs mt-1 ${msg.senderIsSelf ? 'text-teal-200' : 'text-slate-300'} ${msg.isSystem ? 'hidden' : ''}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isSodiumReady && isPeerConnected ? (isWebRTCConnected ? "Type (WebRTC P2P)..." : "Type (BroadcastChannel fallback)...") : (isSodiumReady ? "Waiting for peer connection..." : "Cryptography loading...")}
          className="flex-grow px-4 py-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm text-gray-100"
          disabled={!isPeerConnected || !isSodiumReady} 
          aria-label="Chat message input"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !isPeerConnected || !isSodiumReady}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatRoom;