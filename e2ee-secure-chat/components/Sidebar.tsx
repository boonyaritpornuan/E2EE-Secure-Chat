import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';

const Sidebar: React.FC = () => {
    const { activeUsers, userIdentity, activeChatTarget, setActiveChatTarget, unreadCounts, chatRequests, acceptDirectChat, roomId, joinRoom, startDirectChat } = useChat();
    const [targetUser, setTargetUser] = useState('');
    const [targetRoom, setTargetRoom] = useState('');

    const handleFindUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (targetUser.trim()) {
            startDirectChat(targetUser.trim());
            setTargetUser('');
        }
    };

    const handleSwitchRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (targetRoom.trim()) {
            joinRoom(targetRoom.trim());
            setTargetRoom('');
        }
    };

    return (
        <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">Chats</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Current Room Option */}
                <div
                    onClick={() => setActiveChatTarget('ROOM')}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all relative ${activeChatTarget === 'ROOM'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'hover:bg-gray-800 text-gray-300'
                        }`}
                >
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                        <span className="text-lg">#</span>
                    </div>
                    <div>
                        <div className="font-medium">{roomId || 'Lobby'}</div>
                        <div className="text-xs opacity-70">Broadcast to room</div>
                    </div>

                    {/* Room Unread Badge */}
                    {unreadCounts['ROOM'] > 0 && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                            {unreadCounts['ROOM']}
                        </div>
                    )}
                </div>

                {/* Quick Connect Section */}
                <div className="my-4 px-2 space-y-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Quick Actions
                    </div>
                    <form onSubmit={handleSwitchRoom} className="flex">
                        <input
                            type="text"
                            value={targetRoom}
                            onChange={(e) => setTargetRoom(e.target.value)}
                            placeholder="Switch Room..."
                            className="flex-1 bg-gray-800 text-white text-xs px-2 py-2 rounded-l border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <button type="submit" className="bg-blue-600 text-white text-xs px-3 py-2 rounded-r hover:bg-blue-700 transition-colors">
                            Join
                        </button>
                    </form>
                    <form onSubmit={handleFindUser} className="flex">
                        <input
                            type="text"
                            value={targetUser}
                            onChange={(e) => setTargetUser(e.target.value)}
                            placeholder="DM User..."
                            className="flex-1 bg-gray-800 text-white text-xs px-2 py-2 rounded-l border border-gray-600 focus:outline-none focus:border-green-500 transition-colors"
                        />
                        <button type="submit" className="bg-green-600 text-white text-xs px-3 py-2 rounded-r hover:bg-green-700 transition-colors">
                            Chat
                        </button>
                    </form>
                </div>

                <div className="pt-2 pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Incoming Requests
                </div>
                {chatRequests.length === 0 && (
                    <div className="px-4 py-2 text-xs text-gray-600 italic">
                        No pending requests
                    </div>
                )}
                {chatRequests.map((req) => (
                    <div key={req.senderSocketId} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg mx-2 mb-2 border border-blue-500/30">
                        <div className="flex items-center min-w-0">
                            <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-blue-200 text-xs font-bold mr-2">
                                {req.senderUsername.charAt(0)}
                            </div>
                            <div className="truncate text-sm text-gray-200">
                                {req.senderUsername}
                            </div>
                        </div>
                        <button
                            onClick={() => acceptDirectChat(req.senderSocketId, req.senderUsername)}
                            className="ml-2 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                        >
                            Accept
                        </button>
                    </div>
                ))}

                {/* Direct Messages Section */}
                <div className="pt-4 pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                    <span>Direct Messages</span>
                    <button
                        onClick={() => useChat().refreshActiveUsers()}
                        className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
                        title="Refresh User List"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                {/* Filter for Direct Messages: Users we have unread counts for OR are the active target OR have a shared secret (implied by being in activeUsers but maybe offline) */}
                {/* Actually, ChatContext now keeps DM partners in activeUsers even if offline. So we filter by 'has history' logic or just separate them. */}
                {/* Let's define "Direct Message" as anyone we have a shared secret with (which means we exchanged keys). */}
                {/* And "Room Member" as anyone else who is online. */}

                {activeUsers.filter(u => u.username !== userIdentity?.username && (unreadCounts[u.socketId] > 0 || activeChatTarget === u.socketId || !u.isOnline)).map((user) => (
                    <div
                        key={user.socketId}
                        onClick={() => setActiveChatTarget(user.socketId)}
                        className={`flex items-center p-3 rounded-lg cursor-pointer transition-all relative ${activeChatTarget === user.socketId
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'hover:bg-gray-800 text-gray-300'
                            }`}
                    >
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3 border-2 ${user.isOnline ? 'border-green-500' : 'border-gray-600'}`}
                            style={{ backgroundColor: user.avatarColor || '#6366F1' }}
                        >
                            {user.username.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                                {user.username}
                            </div>
                            <div className={`text-xs flex items-center ${user.isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                                <span className={`w-2 h-2 rounded-full mr-1 ${user.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                {user.isOnline ? 'Online' : 'Offline'}
                            </div>
                        </div>

                        {/* Unread Badge */}
                        {unreadCounts[user.socketId] > 0 && (
                            <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                                {unreadCounts[user.socketId]}
                            </div>
                        )}
                    </div>
                ))}

                {/* Room Members Section */}
                <div className="pt-4 pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Room Members
                </div>

                {activeUsers.filter(u => u.username !== userIdentity?.username && u.isOnline && !(unreadCounts[u.socketId] > 0 || activeChatTarget === u.socketId)).map((user) => (
                    <div
                        key={user.socketId}
                        onClick={() => setActiveChatTarget(user.socketId)}
                        className={`flex items-center p-3 rounded-lg cursor-pointer transition-all relative ${activeChatTarget === user.socketId
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'hover:bg-gray-800 text-gray-300'
                            }`}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3 border-2 border-gray-600"
                            style={{ backgroundColor: user.avatarColor || '#10B981' }}
                        >
                            {user.username.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                                {user.username}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center">
                                In Room
                            </div>
                        </div>
                    </div>
                ))}

                {activeUsers.length <= 1 && (
                    <div className="p-4 text-center text-gray-500 text-sm italic">
                        No other users online.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
