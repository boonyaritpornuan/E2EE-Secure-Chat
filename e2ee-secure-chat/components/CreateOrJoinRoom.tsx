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
        <div className={`flex items-center text-xs font-bold px-3 py-1 rounded-full ${userIdentity ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${userIdentity ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {userIdentity ? 'Online & Ready' : 'Connecting...'}
        </div>
      </div>

      {/* Incoming Requests Notification Area */}
      {incomingRequests.length > 0 && (
        <div className="bg-gray-800 border border-blue-500 rounded-lg p-4 shadow-lg animate-fade-in-up">
          <h3 className="text-white font-bold mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
            Incoming Chat Requests
          </h3>
          <div className="space-y-2">
            {incomingRequests.map(req => (
              <div key={req.socketId} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{req.username}</p>
                  <p className="text-xs text-blue-300">
                    {req.count > 0 ? `${req.count} new message${req.count > 1 ? 's' : ''}` : 'New Chat Request'}
                  </p>
                </div>
                <button
                  onClick={() => handleAcceptChat(req.socketId, req.username)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded transition-colors"
                >
                  Reply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
        <h2 className="text-3xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          Secure Chat
        </h2>
        <p className="text-center text-gray-400 mb-6">
          Serverless, End-to-End Encrypted.
        </p>

        <div className="mb-6 p-4 bg-gray-900 rounded-md border border-gray-700 flex items-center justify-between group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Your Identity</p>
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
                className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                title="Regenerate Identity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          <div
            className="w-12 h-12 rounded-full border-2 border-gray-700 shadow-lg relative z-10"
            style={{ backgroundColor: userIdentity?.avatarColor || '#333' }}
          >
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl opacity-80">
              {userIdentity?.username?.charAt(0) || '?'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 border-b border-gray-700">
          <button
            className={`flex-1 pb-2 text-sm font-medium ${mode === 'ROOM' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setMode('ROOM')}
          >
            Join Room
          </button>
          <button
            className={`flex-1 pb-2 text-sm font-medium ${mode === 'DIRECT' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setMode('DIRECT')}
          >
            Direct Chat
          </button>
        </div>

        {mode === 'ROOM' ? (
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label htmlFor="roomName" className="block text-sm font-medium text-gray-300 mb-1">
                Room Name
              </label>
              <input
                type="text"
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="e.g. SecretBase"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isJoining}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-4 rounded-md transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleDirectChat} className="space-y-4">
            <div>
              <label htmlFor="targetUsername" className="block text-sm font-medium text-gray-300 mb-1">
                Target Username
              </label>
              <input
                type="text"
                id="targetUsername"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="e.g. NeonTiger"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enters the default "Lobby" to find this user.
              </p>
            </div>
            <button
              type="submit"
              disabled={isJoining}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-4 rounded-md transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
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