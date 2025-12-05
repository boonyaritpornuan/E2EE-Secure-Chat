import React, { useEffect, useState, useMemo } from 'react';
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

const NexusStatus: React.FC<{ onBack: () => void }> = ({ onBack }) => {
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
    }, [fetchServerStats]);

    // Chart Data
    const chartData = useMemo(() => {
        if (!stats || !stats.dailyStats) return [];
        return Object.entries(stats.dailyStats)
            .map(([date, data]: [string, DailyStat]) => ({
                date,
                visits: data.visits,
                uniqueIps: data.uniqueIps
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-7); // Last 7 days
    }, [stats]);

    const maxVisits = chartData.length > 0 ? Math.max(...chartData.map(d => d.visits), 10) : 10;

    return (
        <div className="min-h-screen bg-[#050505] text-[#F5F5F7] font-sans p-6 flex flex-col items-center overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-5xl">
                <button
                    onClick={onBack}
                    className="mb-8 flex items-center text-[#86868b] hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back to Home
                </button>

                <h1 className="text-3xl font-bold mb-2 flex items-center">
                    <span className="w-3 h-3 bg-[#39FF14] rounded-full mr-3 animate-pulse shadow-[0_0_10px_#39FF14]"></span>
                    Nexus Status
                </h1>
                <p className="text-[#86868b] mb-10">Real-time metrics from the signaling nexus.</p>

                {loading && !stats ? (
                    <div className="text-center py-20 text-[#666] animate-pulse">Establishing uplink...</div>
                ) : stats ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            {/* Card 1: Active Users */}
                            <div className="bg-[#1A1A1A] border border-[#333] p-6 rounded-2xl">
                                <div className="text-[#86868b] text-sm uppercase tracking-wider mb-2">Active Uplinks</div>
                                <div className="text-4xl font-bold text-white">{stats.activeUsers}</div>
                            </div>

                            {/* Card 2: Total Visits */}
                            <div className="bg-[#1A1A1A] border border-[#333] p-6 rounded-2xl">
                                <div className="text-[#86868b] text-sm uppercase tracking-wider mb-2">Total Connections</div>
                                <div className="text-4xl font-bold text-white">{stats.totalVisits}</div>
                            </div>

                            {/* Card 3: Uptime */}
                            <div className="bg-[#1A1A1A] border border-[#333] p-6 rounded-2xl">
                                <div className="text-[#86868b] text-sm uppercase tracking-wider mb-2">Nexus Uptime</div>
                                <div className="text-4xl font-bold text-white">
                                    {Math.floor((Date.now() - stats.startTime) / 1000 / 60 / 60)}h
                                </div>
                            </div>
                        </div>

                        {/* Daily Stats Chart */}
                        <div className="bg-[#1A1A1A] p-8 rounded-[24px] border border-[#333] shadow-lg mb-10">
                            <h3 className="text-xl font-bold text-white mb-8 tracking-tight">Traffic Analysis (7 Days)</h3>

                            {chartData.length > 0 ? (
                                <div className="flex items-end justify-between h-64 space-x-2 md:space-x-4 px-2">
                                    {chartData.map((data) => {
                                        const visitHeight = Math.max((data.visits / maxVisits) * 100, 5); // Min 5% height
                                        const uniqueCount = data.uniqueIps ? data.uniqueIps.length : 0;

                                        return (
                                            <div key={data.date} className="flex-1 flex flex-col items-center group relative">
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black border border-[#333] text-xs text-white p-3 rounded-lg z-10 whitespace-nowrap shadow-xl">
                                                    <div className="font-bold mb-1">{new Date(data.date).toLocaleDateString()}</div>
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
                                                    {new Date(data.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                    </>
                ) : (
                    <div className="text-center text-red-400 py-12 bg-red-900/10 rounded-xl border border-red-900/30">
                        <p>Connection failed. Nexus offline.</p>
                        <button
                            onClick={loadStats}
                            className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full text-white text-sm font-bold transition-colors"
                        >
                            Retry Connection
                        </button>
                    </div>
                )}

                <div className="mt-12 text-center text-[#444] text-xs font-mono">
                    <p>benull secure nexus • v1.0.0</p>
                </div>
            </div>
        </div>
    );
};

export default NexusStatus;
