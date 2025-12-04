import React, { useEffect, useState } from 'react';

interface LandingPageProps {
    onStart: () => void;
    onShowStats: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onShowStats }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        } else {
            // If PWA is not installable (e.g. already installed or not supported), just start the app
            onStart();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#000000] text-[#F5F5F7] font-sans selection:bg-[#39FF14] selection:text-black overflow-x-hidden">

            {/* 1. The Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-[#050505]/80 backdrop-blur-md border-b border-white/5">
                <div className="flex items-center">
                    <span className="text-2xl font-bold tracking-tight text-white">benull</span>
                    <span className="text-[#39FF14] text-2xl leading-none">.</span>
                </div>
                <a
                    href="https://github.com/boonyarit-man/E2EE-Secure-Chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#86868b] hover:text-white transition-colors"
                    aria-label="Source Code"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                </a>
            </header>

            {/* 2. Hero Section */}
            <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 pb-10">
                {/* Subtle Energy Flow Animation Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#39FF14]/5 rounded-full blur-[100px] animate-pulse"></div>
                </div>

                <div className="relative z-10 max-w-4xl mx-auto space-y-8">
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-tight bg-gradient-to-b from-white to-[#86868b] bg-clip-text text-transparent animate-float">
                        Speak Freely.<br />Leave No Trace.
                    </h1>
                    <p className="text-xl md:text-2xl text-[#86868b] font-light max-w-2xl mx-auto">
                        End-to-end encrypted, serverless communication. <br className="hidden md:block" />
                        Exists only in the moment.
                    </p>

                    <button
                        onClick={onStart}
                        className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center mx-auto gap-2"
                    >
                        Start Secure Chat
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
                            <line x1="7" y1="17" x2="17" y2="7"></line>
                            <polyline points="7 7 17 7 17 17"></polyline>
                        </svg>
                    </button>
                </div>

                {/* 3. The Trust Ticker */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                    <div className="flex flex-wrap justify-center gap-4 text-xs md:text-sm text-[#444] font-medium uppercase tracking-widest">
                        <span>Powered by WebRTC</span>
                        <span className="text-[#39FF14]">•</span>
                        <span>AES-GCM 256-bit Encryption</span>
                        <span className="text-[#39FF14]">•</span>
                        <span>No Database</span>
                        <span className="text-[#39FF14]">•</span>
                        <span>Open Source</span>
                    </div>
                </div>
            </section>

            {/* 4. The Infographic: "The Invisible Tunnel" */}
            <section className="py-24 px-4 bg-[#0a0a0a] relative overflow-hidden">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white">The Invisible Tunnel</h2>

                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left Side: Others */}
                        <div className="glass-panel p-8 rounded-3xl opacity-50 hover:opacity-100 transition-opacity duration-500">
                            <div className="text-center mb-8">
                                <h3 className="text-xl font-bold text-[#86868b] mb-2">Others</h3>
                                <p className="text-sm text-[#666]">Centralized. Stored. Vulnerable.</p>
                            </div>
                            <div className="flex justify-between items-center relative h-32">
                                {/* User A */}
                                <div className="flex flex-col items-center z-10">
                                    <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center mb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                </div>

                                {/* Central Server */}
                                <div className="flex flex-col items-center z-10">
                                    <div className="w-16 h-16 rounded-xl bg-[#222] border border-red-900/30 flex items-center justify-center mb-2 relative">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-900/80 rounded-full flex items-center justify-center border border-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* User B */}
                                <div className="flex flex-col items-center z-10">
                                    <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center mb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                </div>

                                {/* Path Lines */}
                                <div className="absolute top-1/2 left-12 right-1/2 h-[1px] bg-red-900/50 -translate-y-8"></div>
                                <div className="absolute top-1/2 left-1/2 right-12 h-[1px] bg-red-900/50 -translate-y-8"></div>
                            </div>
                        </div>

                        {/* Right Side: benull. */}
                        <div className="glass-premium p-8 rounded-3xl border-[#39FF14]/20 shadow-[0_0_30px_rgba(57,255,20,0.05)]">
                            <div className="text-center mb-8">
                                <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                                    benull<span className="text-[#39FF14]">.</span>
                                </h3>
                                <p className="text-sm text-[#39FF14]">Direct. Encrypted. Ephemeral.</p>
                            </div>
                            <div className="flex justify-between items-center relative h-32">
                                {/* User A */}
                                <div className="flex flex-col items-center z-10">
                                    <div className="w-12 h-12 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                </div>

                                {/* The Lock (Center) */}
                                <div className="flex flex-col items-center z-10 animate-pulse">
                                    <div className="w-10 h-10 rounded-full bg-[#050505] border border-[#39FF14] flex items-center justify-center shadow-[0_0_20px_rgba(57,255,20,0.4)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    </div>
                                </div>

                                {/* User B */}
                                <div className="flex flex-col items-center z-10">
                                    <div className="w-12 h-12 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                </div>

                                {/* Laser Beam */}
                                <div className="absolute top-1/2 left-14 right-14 h-[2px] bg-[#39FF14]/20 -translate-y-6 overflow-hidden">
                                    <div className="h-full bg-[#39FF14] animate-laser shadow-[0_0_10px_#39FF14]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. Features Grid: "The Bento Box" */}
            <section className="py-24 px-4">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Card 1: Zero Knowledge (Large) */}
                    <div className="md:col-span-2 glass-premium p-10 rounded-[32px] hover:bg-[#1A1A1A]/60 transition-colors duration-300 group">
                        <div className="w-14 h-14 bg-[#333] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#39FF14] transition-colors duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:text-black transition-colors"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Zero Knowledge Architecture</h3>
                        <p className="text-[#86868b] leading-relaxed">
                            We don’t know who you are, who you talk to, or what you say. We couldn't hand over data even if forced.
                            Your identity is a mathematical ghost.
                        </p>
                    </div>

                    {/* Card 2: Military-Grade E2EE */}
                    <div className="glass-premium p-10 rounded-[32px] hover:bg-[#1A1A1A]/60 transition-colors duration-300 group">
                        <div className="w-14 h-14 bg-[#333] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#39FF14] transition-colors duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:text-black transition-colors"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4">Military-Grade E2EE</h3>
                        <p className="text-[#86868b] text-sm leading-relaxed">
                            Secured with AES-GCM 256-bit encryption before leaving your device.
                        </p>
                    </div>

                    {/* Card 3: No Sign-up */}
                    <div className="glass-premium p-10 rounded-[32px] hover:bg-[#1A1A1A]/60 transition-colors duration-300 group">
                        <div className="w-14 h-14 bg-[#333] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#39FF14] transition-colors duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:text-black transition-colors"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4">No Sign-up Required</h3>
                        <p className="text-[#86868b] text-sm leading-relaxed">
                            Frictionless anonymity. Just generate a link and share. No email, no phone, no account.
                        </p>
                    </div>

                    {/* Card 4: The Kill Switch */}
                    <div className="md:col-span-2 glass-premium p-10 rounded-[32px] hover:bg-[#1A1A1A]/60 transition-colors duration-300 group">
                        <div className="w-14 h-14 bg-[#333] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-500 transition-colors duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:text-white transition-colors"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">The "Kill Switch"</h3>
                        <p className="text-[#86868b] leading-relaxed">
                            Close the tab, and the encryption keys are destroyed instantly. The conversation ceases to exist, leaving no digital footprint.
                        </p>
                    </div>
                </div>
            </section>

            {/* 6. Omnipresent Access (PWA) */}
            <section className="py-24 px-4 text-center bg-[#050505]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Available Everywhere.<br />Installed Nowhere.</h2>
                    <p className="text-xl text-[#86868b] mb-12 font-light">
                        Add to your home screen for an app-like experience,<br />without the app store tracking.
                    </p>

                    <div className="flex flex-wrap justify-center gap-6">
                        {/* iOS Button */}
                        <button onClick={handleInstallClick} className="flex flex-col items-center group">
                            <div className="w-48 h-14 bg-[#1A1A1A] border border-[#333] rounded-xl flex items-center justify-center gap-3 group-hover:border-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white"><path d="M17.7 7.7c-.3-2.3-2-4-4.3-4.3v-1c0-1.1.9-2 2-2s2 .9 2 2h1c0-1.7-1.3-3-3-3s-3 1.3-3 3v1c-2.3.3-4 2-4.3 4.3h-1v2h1c.3 2.3 2 4 4.3 4.3v1c0 1.1-.9 2-2 2s-2-.9-2-2h-1c0 1.7 1.3 3 3 3s3-1.3 3-3v-1c2.3-.3 4-2 4.3-4.3h1v-2h-1zm-4.7 4.3c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z" /></svg>
                                <span className="font-bold">iOS / iPadOS</span>
                            </div>
                            <span className="text-[10px] text-[#666] mt-2 uppercase tracking-wide group-hover:text-[#39FF14] transition-colors">Share &gt; Add to Home Screen</span>
                        </button>

                        {/* Android Button */}
                        <button onClick={handleInstallClick} className="flex flex-col items-center group">
                            <div className="w-48 h-14 bg-[#1A1A1A] border border-[#333] rounded-xl flex items-center justify-center gap-3 group-hover:border-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4213 13.8533 8.0004 12 8.0004c-1.8533 0-3.5902.4209-5.1367.9497L4.8409 5.4471a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" /></svg>
                                <span className="font-bold">Android</span>
                            </div>
                            <span className="text-[10px] text-[#666] mt-2 uppercase tracking-wide group-hover:text-[#39FF14] transition-colors">Menu &gt; Install App</span>
                        </button>

                        {/* Desktop Button */}
                        <button onClick={onStart} className="flex flex-col items-center group">
                            <div className="w-48 h-14 bg-[#1A1A1A] border border-[#333] rounded-xl flex items-center justify-center gap-3 group-hover:border-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                <span className="font-bold">Desktop / Web</span>
                            </div>
                            <span className="text-[10px] text-[#666] mt-2 uppercase tracking-wide group-hover:text-[#39FF14] transition-colors">Works in any browser</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* 7. Footer */}
            <footer className="py-12 px-6 border-t border-white/5 bg-[#050505] text-sm">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left">
                        <h4 className="font-bold text-white mb-1">benull.</h4>
                        <p className="text-[#666]">Designed for silence.</p>
                    </div>

                    <div className="flex gap-8 text-[#86868b]">
                        <a href="https://github.com/boonyarit-man/E2EE-Secure-Chat" className="hover:text-white transition-colors">GitHub</a>
                        <span className="hover:text-white transition-colors cursor-pointer" title="We don't collect anything.">Privacy Policy</span>
                        <span className="hover:text-white transition-colors cursor-pointer" onClick={onShowStats}>Server Status</span>
                    </div>

                    <div className="text-[#444] text-xs">
                        © {new Date().getFullYear()} benull.org. Open source and auditable.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
