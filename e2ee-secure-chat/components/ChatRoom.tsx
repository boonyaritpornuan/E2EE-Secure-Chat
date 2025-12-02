import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../contexts/ChatContext';
import { DecryptedMessage, SystemMessageType } from '../types';

const SafetyNumberDisplay: React.FC<{ targetSocketId: string }> = ({ targetSocketId }) => {
  const { getSafetyNumber } = useChat();
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null);

  useEffect(() => {
    getSafetyNumber(targetSocketId).then(setSafetyNumber);
  }, [targetSocketId, getSafetyNumber]);

  if (!safetyNumber) return null;

  return (
    <span className="text-gray-500 font-mono mt-1 flex items-center" title="Verify this number with your contact to ensure security">
      <span className="mr-1">🔒</span> Safety Number: {safetyNumber}
    </span>
  );
};

const ChatRoom: React.FC = () => {
  const {
    roomId, messages, sendMessage,
    cryptoStatusMessage,
    activeUsers,
    activeTransfers, startFileTransfer, acceptFileTransfer, declineFileTransfer, cancelTransfer,
    activeChatTarget,
    typingUsers, sendTyping
  } = useChat();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter messages based on active target
  const filteredMessages = messages.filter(msg => {
    if (msg.isSystem) return activeChatTarget === 'ROOM';

    if (activeChatTarget === 'ROOM') {
      return !msg.isDirect;
    } else {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (activeChatTarget === 'ROOM') {
        // Send file to all users in the room
        try {
          // Send to each active user
          for (const user of activeUsers) {
            await startFileTransfer(file, user.socketId);
          }
        } catch (e) {
          console.error("Group transfer failed:", e);
        }
      } else {
        // DM File Transfer
        try {
          await startFileTransfer(file, activeChatTarget);
        } catch (e) {
          console.error("Transfer failed:", e);
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages, activeTransfers]); // Added activeTransfers dependency

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

  // Filter transfers relevant to current view
  const currentTransfers = Object.values(activeTransfers).filter(t =>
    activeChatTarget === 'ROOM' || t.peerSocketId === activeChatTarget
  );

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
          <div className="text-xs text-gray-400">
            {activeChatTarget === 'ROOM' ? (
              `${activeUsers.length} members online`
            ) : (
              <div className="flex flex-col">
                <span>End-to-End Encrypted Direct Message</span>
                <SafetyNumberDisplay targetSocketId={activeChatTarget} />
              </div>
            )}
          </div>
        </div>
        {activeChatTarget !== 'ROOM' && (
          <button
            onClick={() => useChat().closeDirectChat(activeChatTarget)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            Close Chat
          </button>
        )}
      </div>

      {/* Active File Transfers */}
      {currentTransfers.length > 0 && (
        <div className="bg-gray-900 p-2 border-b border-gray-700 space-y-2 max-h-40 overflow-y-auto">
          {currentTransfers.map((transfer) => (
            <div key={transfer.transferId} className="bg-gray-800 p-3 rounded border border-gray-600 flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">
                    {transfer.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' : (transfer.status === 'pending' ? '📎' : transfer.isUpload ? '⬆️' : '⬇️')}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{transfer.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {(transfer.fileSize / 1024).toFixed(1)} KB • {transfer.status}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {transfer.status === 'pending' && !transfer.isUpload && (
                    <>
                      <button
                        onClick={() => acceptFileTransfer(transfer.transferId)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineFileTransfer(transfer.transferId)}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {transfer.status === 'pending' && transfer.isUpload && (
                    <button
                      onClick={() => cancelTransfer(transfer.transferId)}
                      className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  {transfer.status === 'transferring' && (
                    <button
                      onClick={() => cancelTransfer(transfer.transferId)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              {/* Progress Bar - only show when transferring */}
              {transfer.status === 'transferring' && (
                <>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-blue-600"
                      style={{ width: `${transfer.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-xs text-gray-400">{transfer.progress}%</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03 8-9 8s9 3.582 9 8z" />
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
                ? (msg.text.includes('File offer') ? 'bg-blue-900/50 text-blue-200 border border-blue-700 py-2 px-4 rounded-xl' : 'bg-gray-700/50 text-gray-300 text-xs py-1 px-3 rounded-full')
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

      {/* Typing Indicator */}
      {
        typingUsers.length > 0 && (
          <div className="px-4 py-1 bg-gray-900 text-xs text-gray-400 italic animate-pulse">
            {activeChatTarget === 'ROOM'
              ? 'Someone is typing...'
              : 'User is typing...'}
          </div>
        )
      }

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
            onChange={(e) => {
              setInputText(e.target.value);
              sendTyping(true);
            }}
            onBlur={() => sendTyping(false)}
            onPaste={async (e) => {
              const items = e.clipboardData.items;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                  const file = items[i].getAsFile();
                  if (file) {
                    if (activeChatTarget === 'ROOM') {
                      for (const user of activeUsers) {
                        await startFileTransfer(file, user.socketId);
                      }
                    } else {
                      await startFileTransfer(file, activeChatTarget);
                    }
                  }
                }
              }
            }}
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
    </div >
  );
};

export default ChatRoom;