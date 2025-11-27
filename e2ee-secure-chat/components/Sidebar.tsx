import React from 'react';
import { useChat } from '../contexts/ChatContext';

const Sidebar: React.FC = () => {
    const { activeUsers, userIdentity, activeChatTarget, setActiveChatTarget, unreadCounts, chatRequests, acceptDirectChat } = useChat();

    return (
        <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">Chats</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* General Room Option */}
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
                        <div className="font-medium">General Room</div>
                        <div className="text-xs opacity-70">Broadcast to all</div>
                    </div>

                    {/* Room Unread Badge */}
                    {unreadCounts['ROOM'] > 0 && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                            {unreadCounts['ROOM']}
                        </div>
                    )}
                </div>

                <div className="pt-4 pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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

                <div className="pt-4 pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Direct Messages
                </div>

                {activeUsers.filter(u => u.username !== userIdentity?.username).map((user) => (
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
                            style={{ backgroundColor: user.avatarColor || '#6366F1' }}
                        >
                            {user.username.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                                {user.username}
                            </div>
                            <div className="text-xs text-green-400 flex items-center">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                Online
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
