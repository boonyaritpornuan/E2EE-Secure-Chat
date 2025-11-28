import React, { useState, useEffect } from 'react';

const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie-consent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 shadow-2xl z-50 animate-slide-up">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-gray-300 text-sm">
                    <p>
                        We use cookies to ensure you get the best experience on our website.
                        By continuing to use this site, you agree to our use of cookies.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleAccept}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md text-sm font-medium transition"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
