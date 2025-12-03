import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { roomId, leaveRoom, userIdentity, cryptoStatusMessage } = useChat();
  const [isIdentityRevealed, setIsIdentityRevealed] = useState(false);

  const copyUsername = () => {
    if (userIdentity?.username) {
      navigator.clipboard.writeText(userIdentity.username);
      alert('Username copied!');
    }
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 p-4 shadow-md z-20 relative">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          {roomId && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden text-gray-300 hover:text-white focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Secure Chat
          </h1>
          {roomId && (
            <span className="hidden sm:inline-block bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm border border-gray-600">
              Room: <span className="font-mono text-white">{roomId}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-6">
          {/* Crypto Status */}
          <div className="hidden md:flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${cryptoStatusMessage?.includes('Active') || cryptoStatusMessage?.includes('Connected') ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-xs text-gray-400 max-w-[200px] truncate">{cryptoStatusMessage}</span>
          </div>

          {/* User Identity */}
          {userIdentity && (
            <div className="flex items-center space-x-3 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
              <div
                className="w-8 h-8 rounded-full border-2 border-gray-600"
                style={{ backgroundColor: userIdentity.avatarColor }}
              />
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span
                    className="text-sm font-medium text-white cursor-pointer select-none max-w-[80px] sm:max-w-none truncate"
                    onClick={() => setIsIdentityRevealed(!isIdentityRevealed)}
                    title="Click to reveal/hide"
                  >
                    {isIdentityRevealed ? userIdentity.username : '••••••••'}
                  </span>
                  <button
                    onClick={copyUsername}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Copy Username"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <span className="text-[10px] text-green-400 leading-none hidden sm:inline">Online</span>
              </div>
            </div>
          )}

          {roomId && (
            <button
              onClick={leaveRoom}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded transition-colors"
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
