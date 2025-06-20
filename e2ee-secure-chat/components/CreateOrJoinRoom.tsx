
import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import { MAX_ROOM_ID_LENGTH } from '../constants';

const CreateOrJoinRoom: React.FC = () => {
  const [inputRoomId, setInputRoomId] = useState('');
  const { setRoomId, isNaClReady, naclLoadingStatusMessage } = useChat();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoomId.trim() && isNaClReady) {
      setRoomId(inputRoomId.trim());
    } else if (!isNaClReady) {
        // ChatContext's setRoomId will also show a system message if called when not ready
        console.warn("Attempted to join room but NaCl is not ready."); 
    }
  };

  const isButtonDisabled = !inputRoomId.trim() || !isNaClReady;
  let buttonText = "Join / Create Room";
  if (!isNaClReady && naclLoadingStatusMessage && naclLoadingStatusMessage.includes("loading...")) {
    buttonText = "Initializing Crypto...";
  } else if (!isNaClReady && naclLoadingStatusMessage) {
    buttonText = "Crypto Failed to Load";
  }


  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-2xl">
      <h2 className="text-3xl font-bold text-center text-teal-400">Join or Create Room</h2>
      <form onSubmit={handleJoinRoom} className="space-y-6">
        <div>
          <label htmlFor="roomId" className="block text-sm font-medium text-gray-300">
            Room ID
          </label>
          <input
            id="roomId"
            name="roomId"
            type="text"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value.slice(0, MAX_ROOM_ID_LENGTH))}
            placeholder="Enter a Room ID"
            className="mt-1 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm text-gray-100"
            maxLength={MAX_ROOM_ID_LENGTH}
            aria-describedby="roomId-description"
          />
          <div id="roomId-description" className="mt-2 text-xs text-gray-500 h-6"> {/* Reserve space for message */}
            {!isNaClReady && naclLoadingStatusMessage ? (
                <p className="text-yellow-400">{naclLoadingStatusMessage}</p>
            ) : (
                <p>Share this ID with your peer. Max {MAX_ROOM_ID_LENGTH} characters.</p>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={isButtonDisabled}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-live="polite"
        >
          {buttonText}
        </button>
      </form>
    </div>
  );
};

export default CreateOrJoinRoom;
