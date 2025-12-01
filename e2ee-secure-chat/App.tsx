import React from 'react';
import { ChatProvider, useChat } from './contexts/ChatContext';
import CreateOrJoinRoom from './components/CreateOrJoinRoom';
import ChatRoom from './components/ChatRoom';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import LandingPage from './components/LandingPage';
import CookieConsent from './components/CookieConsent';

const AppContent: React.FC = () => {
  const { roomId, activeChatTarget } = useChat();

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Header />

      <div className="flex flex-grow overflow-hidden">
        {roomId && <Sidebar />}

        <main className="flex-grow flex flex-col relative">
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
