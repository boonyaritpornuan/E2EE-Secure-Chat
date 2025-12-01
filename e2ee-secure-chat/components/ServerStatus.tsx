import React, { useEffect, useState } from 'react';
import { useChat } from '../contexts/ChatContext';

interface ServerStats {
    totalVisits: number;
    activeUsers: number;
    startTime: number;
}

const ServerStatus: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { fetchServerStats } = useChat();
    const [stats, setStats] = useState<ServerStats | null>(null);
    const [loading, setLoading] = useState(true);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await fetchServerStats();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const formatUptime = (startTime: number) => {
        const diff = Date.now() - startTime;
        const seconds = Math.floor((diff / 1000) % 60);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl">
                <button
                    onClick={onBack}
                    className="mb-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center text-gray-300"
                >
                    ← Back to App
                </button>

                <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    Server Status Dashboard
                </h1>

                {loading && !stats ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Connecting to server...</p>
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Active Users Card */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg transform hover:scale-105 transition-transform">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-gray-400 text-sm font-medium">Active Users</h3>
                                <span className="text-green-500 bg-green-500/10 px-2 py-1 rounded text-xs">Live</span>
                            </div>
                            <p className="text-4xl font-bold text-white">{stats.activeUsers}</p>
                            <p className="text-xs text-gray-500 mt-2">Currently connected sockets</p>
                        </div>

                        {/* Total Visits Card */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg transform hover:scale-105 transition-transform">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-gray-400 text-sm font-medium">Total Visits</h3>
                                <span className="text-blue-500 bg-blue-500/10 px-2 py-1 rounded text-xs">Cumulative</span>
                            </div>
                            <p className="text-4xl font-bold text-white">{stats.totalVisits}</p>
                            <p className="text-xs text-gray-500 mt-2">Since server start</p>
                        </div>

                        {/* Uptime Card */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg transform hover:scale-105 transition-transform">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-gray-400 text-sm font-medium">Server Uptime</h3>
                                <span className="text-purple-500 bg-purple-500/10 px-2 py-1 rounded text-xs">Duration</span>
                            </div>
                            <p className="text-2xl font-bold text-white font-mono">{formatUptime(stats.startTime)}</p>
                            <p className="text-xs text-gray-500 mt-2">Continuous runtime</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-red-400 py-12 bg-red-900/20 rounded-xl border border-red-900/50">
                        <p>Failed to load stats. Server might be offline.</p>
                        <button
                            onClick={loadStats}
                            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                        >
                            Retry
                        </button>
                    </div>
                )}

                <div className="mt-12 text-center text-gray-600 text-sm">
                    <p>E2EE Secure Chat Server • v1.0.0</p>
                </div>
            </div>
        </div>
    );
};

export default ServerStatus;
