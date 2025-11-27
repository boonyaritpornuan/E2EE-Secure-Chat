import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../contexts/ChatContext';
import { DecryptedMessage, SystemMessageType } from '../types';

const ChatRoom: React.FC = () => {
  const {
    roomId, messages, sendMessage,
    cryptoStatusMessage,
    activeUsers,
    sendFileOffer, fileOffers, acceptFileOffer, declineFileOffer,
    activeChatTarget
  } = useChat();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter messages based on active target
  const filteredMessages = messages.filter(msg => {
    if (msg.isSystem) return activeChatTarget === 'ROOM'; // Show system messages only in Room view? Or maybe global?

    if (activeChatTarget === 'ROOM') {
      return !msg.isDirect; // Show only public messages
    } else {
      // Show DMs with this specific user
      // 1. Sent by me TO them (targetSocketId === activeChatTarget)
      // 2. Sent by them TO me (senderSocketId === activeChatTarget)
      return msg.isDirect && (
        (msg.senderIsSelf && msg.targetSocketId === activeChatTarget) ||
        (!msg.senderIsSelf && msg.senderSocketId === activeChatTarget)
      );
    }
  });

  const targetUser = activeChatTarget === 'ROOM'
    ? null
    : activeUsers.find(u => u.socketId === activeChatTarget);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      try {
        await sendMessage(inputText.trim());
        setInputText('');
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (activeChatTarget === 'ROOM') {
        if (activeUsers.length > 0) {
          activeUsers.forEach(u => sendFileOffer(file, u.socketId));
          alert(`Offered ${file.name} to all users.`);
        }
      } else {
        // DM File Offer
        sendFileOffer(file, activeChatTarget);
        alert(`Offered ${file.name} to ${targetUser?.username}.`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages, fileOffers]);

  const renderMessageText = (msg: DecryptedMessage) => {
    let prefix = "";
    if (msg.isSystem) {
      switch (msg.systemType) {
        case SystemMessageType.KEY_EXCHANGE: prefix = "🔑 "; break;
        case SystemMessageType.CRYPTO_STATUS: prefix = "🛡️ "; break;
        case SystemMessageType.CONNECTION_STATUS: prefix = "📡 "; break;
        case SystemMessageType.WEBRTC_STATUS: prefix = "🌐 "; break;
        case SystemMessageType.ERROR: prefix = "⚠️ "; break;
        default: prefix = "ℹ️ ";
      }
    }
    return prefix + msg.text;
  }

  return (
    <div className="flex flex-col h-full bg-gray-800 relative">
      {/* Chat Header */}
      <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center">
            {activeChatTarget === 'ROOM' ? (
              <>
                <span className="mr-2 text-gray-400">#</span> {roomId === 'Direct Chat' ? 'Direct Chat' : roomId}
              </>
            ) : (
              <>
                <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                {targetUser?.username || 'Unknown User'}
              </>
            )}
          </h2>
          <p className="text-xs text-gray-400">
            {activeChatTarget === 'ROOM'
              ? `${activeUsers.length} members online`
              : 'End-to-End Encrypted Direct Message'}
          </p>
        </div>
        {activeChatTarget !== 'ROOM' && (
          <button
            onClick={() => closeDirectChat(activeChatTarget)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            Close Chat
          </button>
        )}
      </div>

      {/* File Offers Area */}
      {fileOffers.length > 0 && (
        <div className="bg-gray-900 p-2 border-b border-gray-700 space-y-2">
          {fileOffers.map((offer, idx) => (
            <div key={idx} className="flex items-center justify-between bg-gray-800 p-2 rounded border border-gray-600">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-sm text-white font-bold">{offer.fileMetadata.name}</p>
                  <p className="text-xs text-gray-400">
                    {(offer.fileMetadata.size / 1024).toFixed(1)} KB • From {activeUsers.find(u => u.socketId === offer.senderSocketId)?.username || 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => acceptFileOffer(offer.senderSocketId)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => declineFileOffer(offer.senderSocketId)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No messages yet.</p>
          </div>
        )}

        {filteredMessages.map((msg: DecryptedMessage) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.isSystem ? 'items-center' : (msg.senderIsSelf ? 'items-end' : 'items-start')}`}
          >
            {!msg.isSystem && !msg.senderIsSelf && activeChatTarget === 'ROOM' && (
              <span className="text-xs text-gray-400 mb-1 ml-1">{msg.senderName}</span>
            )}

            <div
              className={`max-w-[85%] md:max-w-[70%] px-4 py-2 rounded-2xl shadow-md ${msg.isSystem
                ? 'bg-gray-700/50 text-gray-300 text-xs py-1 px-3 rounded-full'
                : msg.senderIsSelf
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
                }`}
            >
              <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{renderMessageText(msg)}</p>
            </div>

            {!msg.isSystem && (
              <span className={`text-[10px] text-gray-500 mt-1 ${msg.senderIsSelf ? 'mr-1' : 'ml-1'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-900 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-800"
            title="Attach File"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={activeChatTarget === 'ROOM' ? "Message #General..." : `Message ${targetUser?.username || 'User'}...`}
            className="flex-grow px-4 py-2 bg-gray-800 border border-gray-600 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
        <div className="text-center mt-2">
          <span className="text-[10px] text-gray-500">{cryptoStatusMessage}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;