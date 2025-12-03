import React, { useEffect, useState } from 'react';
import { useChat } from '../contexts/ChatContext';

interface DailyStat {
    visits: number;
    uniqueIps: string[];
}

interface ServerStats {
    totalVisits: number;
    activeUsers: number;
    startTime: number;
    dailyStats?: Record<string, DailyStat>;
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
        const interval = setInterval(loadStats, 10000); // Auto-refresh every 10s
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

    // Prepare chart data
    const getChartData = () => {
        if (!stats?.dailyStats) return [];
        return Object.entries(stats.dailyStats)
            .sort((a, b) => a[0].localeCompare(b[0])) // Sort by date
            .slice(-7); // Last 7 days
    };

    const chartData = getChartData();
    const maxVisits = Math.max(...chartData.map(([, d]) => d.visits), 10); // Scale max

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center overflow-y-auto">
            <div className="w-full max-w-5xl">
                <button
                    onClick={onBack}
                    className="mb-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center text-gray-300"
                >
                    ← Back to App
                </button>

                <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    Server Status & Analytics
                </h1>

                {loading && !stats ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Connecting to server...</p>
                    </div>
                ) : stats ? (
                    <div className="space-y-8">
                        {/* Key Metrics Grid */}
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

                        {/* Daily Stats Chart */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                            <h3 className="text-xl font-bold text-white mb-6">Daily Traffic (Last 7 Days)</h3>

                            {chartData.length > 0 ? (
                                <div className="flex items-end justify-between h-64 space-x-2 md:space-x-4 px-2">
                                    {chartData.map(([date, data]) => {
                                        const visitHeight = Math.max((data.visits / maxVisits) * 100, 5); // Min 5% height
                                        const uniqueCount = data.uniqueIps ? data.uniqueIps.length : 0;

                                        return (
                                            <div key={date} className="flex-1 flex flex-col items-center group relative">
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-xs text-white p-2 rounded z-10 whitespace-nowrap">
                                                    Visits: {data.visits} <br />
                                                    Unique Users: {uniqueCount}
                                                </div>

                                                {/* Bar */}
                                                <div
                                                    className="w-full bg-blue-600/50 hover:bg-blue-500 rounded-t-md transition-all relative overflow-hidden"
                                                    style={{ height: `${visitHeight}%` }}
                                                >
                                                    {/* Unique Users Overlay (Darker blue) */}
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 bg-blue-600"
                                                        style={{ height: `${(uniqueCount / data.visits) * 100}%` }}
                                                    ></div>
                                                </div>

                                                {/* Label */}
                                                <div className="mt-2 text-xs text-gray-400 rotate-45 md:rotate-0 origin-left truncate w-full text-center">
                                                    {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-40 flex items-center justify-center text-gray-500 italic">
                                    No historical data available yet.
                                </div>
                            )}
                            <div className="mt-4 flex justify-center space-x-6 text-xs text-gray-400">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 bg-blue-600/50 mr-2 rounded-sm"></span> Total Visits
                                </div>
                                <div className="flex items-center">
                                    <span className="w-3 h-3 bg-blue-600 mr-2 rounded-sm"></span> Unique Users (Est.)
                                </div>
                            </div>
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
