import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import { generateRandomIdentity, storeIdentity } from '../utils/userManager';

const CreateOrJoinRoom: React.FC = () => {
  const { joinRoom, userIdentity, unreadCounts, messages, directMessages, activeUsers, chatRequests, startDirectChat, acceptDirectChat, checkUserOnline } = useChat();
  const [roomName, setRoomName] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [mode, setMode] = useState<'ROOM' | 'DIRECT'>('ROOM');

  // Derive incoming requests from unreadCounts and chatRequests
  const requestMap = new Map<string, { socketId: string, username: string, count: number }>();

  // 1. Process unreadCounts (existing messages)
  Object.keys(unreadCounts).forEach(socketId => {
    if (socketId === 'ROOM') return;

    // Find username for this socketId
    const user = activeUsers.find(u => u.socketId === socketId);
    const username = user?.username;

    let lastMsg: any = null;
    if (username && directMessages[username]) {
      lastMsg = directMessages[username].slice().reverse()[0];
    } else {
      // Fallback to room messages if for some reason it's there (shouldn't be for DM unreads)
      lastMsg = messages.slice().reverse().find(m => m.senderSocketId === socketId);
    }

    requestMap.set(socketId, {
      socketId,
      username: lastMsg?.senderName || username || 'Unknown User',
      count: unreadCounts[socketId]
    });
  });

  // 2. Process chatRequests (new requests without messages yet)
  chatRequests.forEach(req => {
    if (!requestMap.has(req.senderSocketId)) {
      requestMap.set(req.senderSocketId, {
        socketId: req.senderSocketId,
        username: req.senderUsername,
        count: 0
      });
    }
  });

  const incomingRequests = Array.from(requestMap.values());

  const handleAcceptChat = async (socketId: string, username: string) => {
    setIsJoining(true);
    await acceptDirectChat(socketId, username);
    setIsJoining(false);
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsJoining(true);
    await joinRoom(roomName);
    setIsJoining(false);
  };

  const handleDirectChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;

    setIsJoining(true);

    const isOnline = await checkUserOnline(targetUsername.trim());
    if (!isOnline) {
      alert(`User ${targetUsername} is currently offline or does not exist.`);
      setIsJoining(false);
      return;
    }

    await startDirectChat(targetUsername.trim());
    setIsJoining(false);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Connection Status Indicator */}
      <div className="flex justify-end">
        <div className={`flex items-center text-xs font-bold px-3 py-1 rounded-full ${userIdentity ? 'bg-[#1A1A1A] text-[#00FF41] border border-[#00FF41]/30' : 'bg-red-900/20 text-red-400 border border-red-500/30'}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${userIdentity ? 'bg-[#00FF41] animate-pulse shadow-[0_0_5px_#00FF41]' : 'bg-red-500'}`}></span>
          {userIdentity ? 'System Online' : 'Connecting...'}
        </div>
      </div>

      {/* Incoming Requests Notification Area */}
      {incomingRequests.length > 0 && (
        <div className="bg-[#1A1A1A] border border-[#00FF41]/50 rounded-[20px] p-4 shadow-[0_0_20px_rgba(0,255,65,0.1)] animate-fade-in-up">
          <h3 className="text-white font-bold mb-3 flex items-center">
            <span className="w-2 h-2 bg-[#00FF41] rounded-full mr-2 animate-pulse"></span>
            Incoming Transmissions
          </h3>
          <div className="space-y-2">
            {incomingRequests.map(req => (
              <div key={req.socketId} className="bg-[#050505] p-3 rounded-xl flex justify-between items-center border border-[#333]">
                <div>
                  <p className="text-white font-medium">{req.username}</p>
                  <p className="text-xs text-[#86868b]">
                    {req.count > 0 ? `${req.count} new message${req.count > 1 ? 's' : ''}` : 'New Request'}
                  </p>
                </div>
                <button
                  onClick={() => handleAcceptChat(req.socketId, req.username)}
                  className="bg-[#00FF41] hover:bg-[#00CC33] text-black text-xs font-bold px-4 py-2 rounded-full transition-colors shadow-[0_0_10px_rgba(0,255,65,0.3)]"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#1A1A1A] p-8 rounded-[24px] shadow-2xl border border-[#333]">
        <h2 className="text-3xl font-bold text-center mb-2 text-white tracking-tight">
          Secure Chat
        </h2>
        <p className="text-center text-[#86868b] mb-8 font-light">
          Initialize secure connection.
        </p>

        <div className="mb-8 p-4 bg-[#050505] rounded-2xl border border-[#333] flex items-center justify-between group relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <p className="text-[10px] text-[#86868b] uppercase tracking-widest font-semibold mb-1">Identity</p>
            <div className="flex items-center space-x-2">
              <p className="text-lg font-bold text-white font-mono tracking-tight">
                {userIdentity?.username || 'Loading...'}
              </p>
              <button
                onClick={() => {
                  const newId = generateRandomIdentity();
                  storeIdentity(newId);
                  window.location.reload();
                }}
                className="p-1 text-[#86868b] hover:text-white transition-colors"
                title="Regenerate Identity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          <div
            className="w-10 h-10 rounded-full border border-[#333] relative z-10"
            style={{ backgroundColor: userIdentity?.avatarColor || '#333' }}
          >
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mb-8 border-b border-[#333]">
          <button
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'ROOM' ? 'text-white border-b-2 border-white' : 'text-[#86868b] hover:text-gray-400'}`}
            onClick={() => setMode('ROOM')}
          >
            Join Room
          </button>
          <button
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'DIRECT' ? 'text-white border-b-2 border-white' : 'text-[#86868b] hover:text-gray-400'}`}
            onClick={() => setMode('DIRECT')}
          >
            Direct Chat
          </button>
        </div>

        {mode === 'ROOM' ? (
          <form onSubmit={handleJoinRoom} className="space-y-6">
            <div>
              <label htmlFor="roomName" className="block text-xs font-bold text-[#86868b] uppercase tracking-wider mb-2">
                Room Name
              </label>
              <input
                type="text"
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-4 py-3 bg-[#050505] border border-[#333] rounded-xl text-white focus:ring-1 focus:ring-white focus:border-white outline-none transition-all placeholder-[#444]"
                placeholder="e.g. SecretBase"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isJoining}
              className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 px-4 rounded-full transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleDirectChat} className="space-y-6">
            <div>
              <label htmlFor="targetUsername" className="block text-xs font-bold text-[#86868b] uppercase tracking-wider mb-2">
                Target Username
              </label>
              <input
                type="text"
                id="targetUsername"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#050505] border border-[#333] rounded-xl text-white focus:ring-1 focus:ring-white focus:border-white outline-none transition-all placeholder-[#444]"
                placeholder="e.g. NeonTiger"
                required
              />
              <p className="text-[10px] text-[#86868b] mt-2">
                * Searching in public lobby
              </p>
            </div>
            <button
              type="submit"
              disabled={isJoining}
              className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 px-4 rounded-full transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              {isJoining ? 'Connecting...' : 'Start Chat'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateOrJoinRoom;