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
    <header className="bg-[#050505] border-b border-[#1A1A1A] p-4 z-20 relative">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          {roomId && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden text-[#86868b] hover:text-white focus:outline-none transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
            <span className="text-[#00FF41] mr-2 text-2xl">Ø</span>
            benull
          </h1>
          {roomId && (
            <span className="hidden sm:inline-block bg-[#1A1A1A] text-[#86868b] px-3 py-1 rounded-full text-xs border border-[#333]">
              Room: <span className="font-mono text-white ml-1">{roomId}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-6">
          {/* Crypto Status */}
          <div className="hidden md:flex items-center space-x-2">
            <div className={`w-1.5 h-1.5 rounded-full ${cryptoStatusMessage?.includes('Active') || cryptoStatusMessage?.includes('Connected') || cryptoStatusMessage === 'Online' ? 'bg-[#00FF41] shadow-[0_0_8px_#00FF41]' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-xs text-[#86868b] max-w-[200px] truncate">{cryptoStatusMessage}</span>
          </div>

          {/* User Identity */}
          {userIdentity && (
            <div className="flex items-center space-x-3 bg-[#1A1A1A] px-3 py-1.5 rounded-full border border-[#333] hover:border-[#555] transition-colors">
              <div
                className="w-6 h-6 rounded-full border border-[#333]"
                style={{ backgroundColor: userIdentity.avatarColor }}
              />
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span
                    className="text-sm font-medium text-[#F5F5F7] cursor-pointer select-none max-w-[80px] sm:max-w-none truncate hover:text-white transition-colors"
                    onClick={() => setIsIdentityRevealed(!isIdentityRevealed)}
                    title="Click to reveal/hide"
                  >
                    {isIdentityRevealed ? userIdentity.username : '••••••••'}
                  </span>
                  <button
                    onClick={copyUsername}
                    className="text-[#86868b] hover:text-white transition-colors"
                    title="Copy Username"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {roomId && (
            <button
              onClick={leaveRoom}
              className="text-[#86868b] hover:text-red-500 text-sm px-3 py-1.5 transition-colors font-medium"
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
