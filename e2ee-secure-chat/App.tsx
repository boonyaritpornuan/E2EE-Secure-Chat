import React from 'react';
import { ChatProvider, useChat } from './contexts/ChatContext';
import CreateOrJoinRoom from './components/CreateOrJoinRoom';
import ChatRoom from './components/ChatRoom';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import LandingPage from './components/LandingPage';
import CookieConsent from './components/CookieConsent';

const UpdateBanner: React.FC = () => {
  const { updateAvailable } = useChat();
  if (!updateAvailable) return null;

  return (
    <div className="bg-blue-600 text-white px-4 py-2 text-sm flex justify-between items-center shadow-md z-50">
      <span>
        🚀 <strong>New Update Available!</strong> A newer version of the app is ready.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100 transition-colors"
      >
        Refresh to Update
      </button>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { roomId, activeChatTarget, updateRequired } = useChat();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  if (updateRequired) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6 text-center">
        <div className="bg-red-900/20 p-8 rounded-2xl border border-red-500/30 max-w-md">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Update Required</h1>
          <p className="text-gray-300 mb-6">
            Your version of E2EE Secure Chat is outdated. <br />
            Please update to the latest version to continue using the service securely.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
          >
            Check for Updates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Soft Update Banner */}
      {/* We need to access updateAvailable from context, but AppContent is inside ChatProvider, so we can use useChat() */}
      <UpdateBanner />

      <div className="flex flex-grow overflow-hidden relative">
        {roomId && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex-grow flex flex-col relative w-full">
          {!roomId ? (
            <div className="flex-grow flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-gray-800">
              <CreateOrJoinRoom />
            </div>
          ) : (
            <ChatRoom key={`${roomId}-${activeChatTarget || 'ROOM'}`} />
          )}
        </main>
      </div>

      {!roomId && <Footer />}
    </div>
  );
};

import ServerStatus from './components/ServerStatus';

const App: React.FC = () => {
  const [showLanding, setShowLanding] = React.useState(true);
  const [showServerStatus, setShowServerStatus] = React.useState(false);

  if (showServerStatus) {
    return (
      <ChatProvider>
        <ServerStatus onBack={() => setShowServerStatus(false)} />
      </ChatProvider>
    );
  }

  if (showLanding) {
    return (
      <>
        <LandingPage
          onStart={() => setShowLanding(false)}
          onShowStats={() => setShowServerStatus(true)}
        />
        <CookieConsent />
      </>
    );
  }

  return (
    <ChatProvider>
      <AppContent />
      <CookieConsent />
    </ChatProvider>
  );
};

export default App;
