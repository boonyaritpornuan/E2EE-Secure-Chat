import React, { useEffect, useState } from 'react';

interface LandingPageProps {
    onStart: () => void;
    onShowStats: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onShowStats }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleDownload = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            setDeferredPrompt(null);
        } else {
            alert('To install, please use the "Add to Home Screen" option in your browser menu.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
            {/* Navbar */}
            <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto w-full">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <span className="text-xl font-bold tracking-tight">SecureChat</span>
                </div>
                <div className="space-x-4">
                    <button onClick={onStart} className="text-gray-300 hover:text-white transition">Web Version</button>
                    <button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full transition font-medium">
                        Download App
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="flex-grow flex flex-col items-center justify-center text-center px-4 py-20 relative overflow-hidden">
                {/* Abstract Background Elements */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    The Browser is Your<br />Secure Fortress.
                </h1>
                <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mb-10">
                    End-to-end encrypted messaging that lives in your browser. No tracking, no servers reading your chats. Just you and your friends.
                </p>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
                    <button onClick={handleDownload} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-blue-500/30 transition transform hover:-translate-y-1 flex items-center justify-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download for Desktop
                    </button>
                    <button onClick={onStart} className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white text-lg font-semibold rounded-full border border-gray-700 transition transform hover:-translate-y-1">
                        Launch in Browser
                    </button>
                </div>
                <p className="mt-4 text-sm text-gray-500">Available on Windows, macOS, Linux, iOS, and Android via PWA.</p>
            </header>

            {/* Features Section */}
            <section className="py-20 bg-gray-800/50">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Feature 1 */}
                    <div className="text-center group">
                        <div className="w-20 h-20 mx-auto bg-gray-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition duration-300 border border-gray-700">
                            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-white">End-to-End Encrypted</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Your messages are encrypted on your device and only decrypted by the recipient. We can't read them even if we wanted to.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="text-center group">
                        <div className="w-20 h-20 mx-auto bg-gray-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition duration-300 border border-gray-700">
                            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-white">Lightning Fast</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Powered by WebSockets and optimized P2P file transfer. Send large files in seconds, not minutes.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="text-center group">
                        <div className="w-20 h-20 mx-auto bg-gray-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition duration-300 border border-gray-700">
                            <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-white">No Installation Required</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Works directly in your browser. Or install it as a PWA for a native-like experience on any device.
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 text-center text-gray-600 text-sm">
                <p>&copy; {new Date().getFullYear()} SecureChat. Built for privacy.</p>
                <button
                    onClick={onShowStats}
                    className="mt-2 text-xs text-gray-700 hover:text-gray-500 transition-colors"
                >
                    Server Status
                </button>
            </footer>
        </div>
    );
};

export default LandingPage;
