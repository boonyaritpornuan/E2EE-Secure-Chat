import React from 'react';
import { ChatProvider, useChat } from './contexts/ChatContext';
import CreateOrJoinRoom from './components/CreateOrJoinRoom';
import ChatRoom from './components/ChatRoom';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';

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

const App: React.FC = () => {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
};

export default App;
