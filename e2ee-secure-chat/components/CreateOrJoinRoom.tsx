import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import { MAX_ROOM_ID_LENGTH } from '../constants';

const CreateOrJoinRoom: React.FC = () => {
  const [inputRoomId, setInputRoomId] = useState('');
  const { setRoomId, isSodiumReady, sodiumLoadingStatusMessage } = useChat(); // Changed from isNaClReady

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoomId.trim() && isSodiumReady) { // Changed from isNaClReady
      setRoomId(inputRoomId.trim()); // setRoomId is now async, but we don't need to await it here
    } else if (!isSodiumReady) {
        console.warn("Attempted to join room but Sodium is not ready."); 
    }
  };

  const isButtonDisabled = !inputRoomId.trim() || !isSodiumReady; // Changed from isNaClReady
  let buttonText = "Join / Create Room";
  if (!isSodiumReady && sodiumLoadingStatusMessage && sodiumLoadingStatusMessage.includes("loading...")) {
    buttonText = "Initializing Crypto...";
  } else if (!isSodiumReady && sodiumLoadingStatusMessage) {
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
            {!isSodiumReady && sodiumLoadingStatusMessage ? ( // Changed from isNaClReady
                <p className="text-yellow-400">{sodiumLoadingStatusMessage}</p>
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