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
        <div className="min-h-screen bg-[#050505] text-[#F5F5F7] p-8 flex flex-col items-center overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-5xl">
                <button
                    onClick={onBack}
                    className="mb-8 px-4 py-2 bg-[#1A1A1A] hover:bg-[#333] rounded-full transition-colors flex items-center text-[#86868b] hover:text-white border border-[#333]"
                >
                    ← Back to App
                </button>

                <h1 className="text-4xl font-bold mb-12 text-center text-white tracking-tight">
                    System Analytics
                </h1>

                {loading && !stats ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00FF41] mx-auto mb-4"></div>
                        <p className="text-[#86868b]">Establishing secure connection...</p>
                    </div>
                ) : stats ? (
                    <div className="space-y-8">
                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Active Users Card */}
                            <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-[#333] shadow-lg transform hover:scale-105 transition-transform group">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[#86868b] text-xs font-bold uppercase tracking-widest">Active Nodes</h3>
                                    <span className="text-[#00FF41] bg-[#00FF41]/10 px-2 py-1 rounded text-[10px] font-bold uppercase border border-[#00FF41]/20">Live</span>
                                </div>
                                <p className="text-5xl font-bold text-white group-hover:text-[#00FF41] transition-colors">{stats.activeUsers}</p>
                                <p className="text-xs text-[#86868b] mt-2">Currently connected sockets</p>
                            </div>

                            {/* Total Visits Card */}
                            <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-[#333] shadow-lg transform hover:scale-105 transition-transform group">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[#86868b] text-xs font-bold uppercase tracking-widest">Total Traffic</h3>
                                    <span className="text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-1 rounded text-[10px] font-bold uppercase border border-[#00F0FF]/20">Cumulative</span>
                                </div>
                                <p className="text-5xl font-bold text-white group-hover:text-[#00F0FF] transition-colors">{stats.totalVisits}</p>
                                <p className="text-xs text-[#86868b] mt-2">Since server initialization</p>
                            </div>

                            {/* Uptime Card */}
                            <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-[#333] shadow-lg transform hover:scale-105 transition-transform group">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[#86868b] text-xs font-bold uppercase tracking-widest">System Uptime</h3>
                                    <span className="text-[#BD00FF] bg-[#BD00FF]/10 px-2 py-1 rounded text-[10px] font-bold uppercase border border-[#BD00FF]/20">Duration</span>
                                </div>
                                <p className="text-2xl font-bold text-white font-mono group-hover:text-[#BD00FF] transition-colors">{formatUptime(stats.startTime)}</p>
                                <p className="text-xs text-[#86868b] mt-2">Continuous runtime</p>
                            </div>
                        </div>

                        {/* Daily Stats Chart */}
                        <div className="bg-[#1A1A1A] p-8 rounded-[24px] border border-[#333] shadow-lg">
                            <h3 className="text-xl font-bold text-white mb-8 tracking-tight">Traffic Analysis (7 Days)</h3>

                            {chartData.length > 0 ? (
                                <div className="flex items-end justify-between h-64 space-x-2 md:space-x-4 px-2">
                                    {chartData.map(([date, data]) => {
                                        const visitHeight = Math.max((data.visits / maxVisits) * 100, 5); // Min 5% height
                                        const uniqueCount = data.uniqueIps ? data.uniqueIps.length : 0;

                                        return (
                                            <div key={date} className="flex-1 flex flex-col items-center group relative">
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black border border-[#333] text-xs text-white p-3 rounded-lg z-10 whitespace-nowrap shadow-xl">
                                                    <div className="font-bold mb-1">{new Date(date).toLocaleDateString()}</div>
                                                    <div className="text-[#00F0FF]">Visits: {data.visits}</div>
                                                    <div className="text-[#00FF41]">Unique: {uniqueCount}</div>
                                                </div>

                                                {/* Bar */}
                                                <div
                                                    className="w-full bg-[#333] hover:bg-[#444] rounded-t-sm transition-all relative overflow-hidden"
                                                    style={{ height: `${visitHeight}%` }}
                                                >
                                                    {/* Unique Users Overlay (Neon Blue) */}
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 bg-[#00F0FF] opacity-50"
                                                        style={{ height: `${(uniqueCount / data.visits) * 100}%` }}
                                                    ></div>
                                                    {/* Total Visits Line (Neon Green top border) */}
                                                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00FF41]"></div>
                                                </div>

                                                {/* Label */}
                                                <div className="mt-4 text-[10px] text-[#86868b] rotate-45 md:rotate-0 origin-left truncate w-full text-center font-mono">
                                                    {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-40 flex items-center justify-center text-[#444] italic font-light">
                                    No historical data available yet.
                                </div>
                            )}
                            <div className="mt-8 flex justify-center space-x-8 text-xs text-[#86868b]">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 bg-[#333] border-t-2 border-[#00FF41] mr-2 rounded-sm"></span> Total Traffic
                                </div>
                                <div className="flex items-center">
                                    <span className="w-3 h-3 bg-[#00F0FF] opacity-50 mr-2 rounded-sm"></span> Unique IPs
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-red-400 py-12 bg-red-900/10 rounded-xl border border-red-900/30">
                        <p>Connection failed. Server offline.</p>
                        <button
                            onClick={loadStats}
                            className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full text-white text-sm font-bold transition-colors"
                        >
                            Retry Connection
                        </button>
                    </div>
                )}

                <div className="mt-12 text-center text-[#444] text-xs font-mono">
                    <p>benull secure server • v1.0.0</p>
                </div>
            </div>
        </div>
    );
};

export default ServerStatus;
