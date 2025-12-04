import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const { activeUsers, userIdentity, activeChatTarget, setActiveChatTarget, unreadCounts, chatRequests, acceptDirectChat, roomId, joinRoom, startDirectChat, directMessages } = useChat();
    const [targetUser, setTargetUser] = useState('');
    const [targetRoom, setTargetRoom] = useState('');

    const handleFindUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (targetUser.trim()) {
            startDirectChat(targetUser.trim());
            setTargetUser('');
            if (window.innerWidth < 768) onClose(); // Close sidebar on mobile after action
        }
    };

    const handleSwitchRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (targetRoom.trim()) {
            joinRoom(targetRoom.trim());
            setTargetRoom('');
            if (window.innerWidth < 768) onClose(); // Close sidebar on mobile after action
        }
    };

    const handleSelectChat = (target: string) => {
        setActiveChatTarget(target);
        if (window.innerWidth < 768) onClose();
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden glass-effect"
                    onClick={onClose}
                />
            )}

            <div className={`
                fixed inset-y-0 left-0 z-40 w-64 bg-[#050505] border-r border-[#1A1A1A] flex flex-col h-full transition-transform duration-300 ease-in-out transform
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                md:relative md:translate-x-0
            `}>
                <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white tracking-tight">Chats</h2>
                    <button
                        onClick={onClose}
                        className="md:hidden text-[#86868b] hover:text-white focus:outline-none transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {/* Current Room Option */}
                    <div
                        onClick={() => handleSelectChat('ROOM')}
                        className={`flex items-center p-3 rounded-xl cursor-pointer transition-all relative group ${activeChatTarget === 'ROOM'
                            ? 'bg-[#1A1A1A] text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-[#333]'
                            : 'hover:bg-[#111] text-[#86868b] border border-transparent hover:border-[#222]'
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 transition-colors ${activeChatTarget === 'ROOM' ? 'bg-white text-black' : 'bg-[#1A1A1A] text-white group-hover:bg-[#222]'}`}>
                            <span className="text-lg font-bold">#</span>
                        </div>
                        <div>
                            <div className="font-bold text-sm">{roomId || 'Lobby'}</div>
                            <div className="text-[10px] uppercase tracking-wider opacity-70">Broadcast Channel</div>
                        </div>

                        {/* Room Unread Badge */}
                        {unreadCounts['ROOM'] > 0 && (
                            <div className="absolute top-3 right-3 bg-[#00FF41] text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_5px_#00FF41] animate-pulse">
                                {unreadCounts['ROOM']}
                            </div>
                        )}
                    </div>

                    {/* Quick Connect Section */}
                    <div className="my-6 px-2 space-y-3">
                        <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">
                            Quick Actions
                        </div>
                        <form onSubmit={handleSwitchRoom} className="flex group">
                            <input
                                type="text"
                                value={targetRoom}
                                onChange={(e) => setTargetRoom(e.target.value)}
                                placeholder="Switch Room..."
                                className="flex-1 bg-[#0A0A0A] text-white text-xs px-3 py-2.5 rounded-l-lg border border-[#333] focus:outline-none focus:border-white transition-colors placeholder-[#444]"
                            />
                            <button type="submit" className="bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-r-lg border-y border-r border-[#333] hover:bg-white hover:text-black transition-colors font-medium">
                                Join
                            </button>
                        </form>
                        <form onSubmit={handleFindUser} className="flex group">
                            <input
                                type="text"
                                value={targetUser}
                                onChange={(e) => setTargetUser(e.target.value)}
                                placeholder="DM User..."
                                className="flex-1 bg-[#0A0A0A] text-white text-xs px-3 py-2.5 rounded-l-lg border border-[#333] focus:outline-none focus:border-[#00FF41] transition-colors placeholder-[#444]"
                            />
                            <button type="submit" className="bg-[#1A1A1A] text-[#00FF41] text-xs px-3 py-2 rounded-r-lg border-y border-r border-[#333] hover:bg-[#00FF41] hover:text-black transition-colors font-medium">
                                Chat
                            </button>
                        </form>
                    </div>

                    <div className="pt-2 pb-2 px-2 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">
                        Incoming Requests
                    </div>
                    {chatRequests.length === 0 && (
                        <div className="px-4 py-2 text-xs text-[#444] italic font-light">
                            No pending requests
                        </div>
                    )}
                    {chatRequests.map((req) => (
                        <div key={req.senderSocketId} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl mx-2 mb-2 border border-[#00FF41]/30 shadow-[0_0_10px_rgba(0,255,65,0.05)]">
                            <div className="flex items-center min-w-0">
                                <div className="w-8 h-8 rounded-full bg-[#00FF41]/10 flex items-center justify-center text-[#00FF41] text-xs font-bold mr-2 border border-[#00FF41]/20">
                                    {req.senderUsername.charAt(0)}
                                </div>
                                <div className="truncate text-sm text-white font-medium">
                                    {req.senderUsername}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    acceptDirectChat(req.senderSocketId, req.senderUsername);
                                    if (window.innerWidth < 768) onClose();
                                }}
                                className="ml-2 px-3 py-1 bg-[#00FF41] hover:bg-[#00CC33] text-black text-[10px] font-bold rounded-full transition-colors"
                            >
                                Accept
                            </button>
                        </div>
                    ))}

                    {/* Direct Messages Section */}
                    <div className="pt-6 pb-2 px-2 text-[10px] font-bold text-[#86868b] uppercase tracking-widest flex justify-between items-center">
                        <span>Direct Messages</span>
                        <button
                            onClick={() => useChat().refreshActiveUsers()}
                            className="text-[#86868b] hover:text-white transition-colors p-1 rounded hover:bg-[#1A1A1A]"
                            title="Refresh User List"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>

                    {activeUsers.filter(u =>
                        u.username !== userIdentity?.username &&
                        (unreadCounts[u.socketId] > 0 ||
                            activeChatTarget === u.socketId ||
                            (directMessages[u.username] && directMessages[u.username].length > 0) ||
                            !u.isOnline
                        )
                    ).map((user) => (
                        <div
                            key={user.socketId}
                            onClick={() => handleSelectChat(user.socketId)}
                            className={`flex items-center p-3 rounded-xl cursor-pointer transition-all relative group ${activeChatTarget === user.socketId
                                ? 'bg-[#1A1A1A] text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-[#333]'
                                : 'hover:bg-[#111] text-[#86868b] border border-transparent hover:border-[#222]'
                                }`}
                        >
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3 border-2 ${user.isOnline ? 'border-[#00FF41]' : 'border-[#333] grayscale'}`}
                                style={{ backgroundColor: user.avatarColor || '#333' }}
                            >
                                {user.username.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm truncate">
                                    {user.username}
                                </div>
                                <div className={`text-[10px] flex items-center ${user.isOnline ? 'text-[#00FF41]' : 'text-[#444]'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.isOnline ? 'bg-[#00FF41] shadow-[0_0_5px_#00FF41]' : 'bg-[#444]'}`}></span>
                                    {user.isOnline ? 'Online' : 'Offline'}
                                </div>
                            </div>

                            {/* Unread Badge */}
                            {unreadCounts[user.socketId] > 0 && (
                                <div className="absolute top-3 right-3 bg-[#00FF41] text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_5px_#00FF41] animate-pulse">
                                    {unreadCounts[user.socketId]}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Room Members Section */}
                    <div className="pt-6 pb-2 px-2 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">
                        Room Members
                    </div>

                    {activeUsers.filter(u => u.username !== userIdentity?.username && u.isOnline).map((user) => (
                        <div
                            key={user.socketId}
                            onClick={() => handleSelectChat(user.socketId)}
                            className={`flex items-center p-3 rounded-xl cursor-pointer transition-all relative group ${activeChatTarget === user.socketId
                                ? 'bg-[#1A1A1A] text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-[#333]'
                                : 'hover:bg-[#111] text-[#86868b] border border-transparent hover:border-[#222]'
                                }`}
                        >
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3 border border-[#333]"
                                style={{ backgroundColor: user.avatarColor || '#333' }}
                            >
                                {user.username.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm truncate">
                                    {user.username}
                                </div>
                                <div className="text-[10px] text-[#444] flex items-center">
                                    In Room
                                </div>
                            </div>
                        </div>
                    ))}

                    {activeUsers.length <= 1 && (
                        <div className="p-4 text-center text-[#444] text-xs italic font-light">
                            No other users detected.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
