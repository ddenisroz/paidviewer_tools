// src/components/ControlPanel.jsx
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';


// A simple switch component
function Switch({ isOn, handleToggle }) {
  return (
    <div 
      onClick={handleToggle}
      className={`w-14 h-8 flex items-center bg-slate-600 rounded-full p-1 cursor-pointer transition-colors duration-300 ${isOn ? 'bg-purple-500' : ''}`}
    >
      <div
        className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${isOn ? 'translate-x-6' : ''}`}
      ></div>
    </div>
  );
}


export default function ControlPanel() {
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [volume, setVolume] = useState(100);
  const api = useApi();
  const { isAuthenticated } = useAuth(); // Get auth status

  // Fetch initial state from the backend
  useEffect(() => {
    // Only fetch status if we are authenticated.
    if (isAuthenticated) {
      api.get('/api/status').then(response => {
        setIsTtsEnabled(response.data.tts_enabled);
        setVolume(response.data.volume);
      }).catch(error => console.error("Error fetching status:", error));
    }
  }, [api, isAuthenticated]); // Dependency array now includes isAuthenticated

  const handleTtsToggle = async () => {
    try {
      // We determine the new state *before* sending the request
      const newState = !isTtsEnabled;
      // We send the new state in the format the backend expects
      const response = await api.post('/api/tts/toggle', { is_enabled: newState });
      
      // Update the local state only after a successful response from the server
      if (response.data && typeof response.data.is_enabled === 'boolean') {
          setIsTtsEnabled(response.data.is_enabled);
      } else {
          // If the backend response is unexpected, fallback to the optimistic new state
          setIsTtsEnabled(newState);
      }
      
    } catch (error) {
      console.error('Error toggling TTS:', error);
      // Optional: Add user-facing error notification here
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = e.target.value;
    setVolume(newVolume);
    api.post('/api/volume', { volume: parseInt(newVolume) }).catch(error => {
      console.error("Error setting volume:", error);
      // Optional: revert volume change on error
    });
  };
  
  const handleClearQueue = () => {
    api.post('/api/queue/clear').catch(error => {
        console.error("Error clearing queue:", error)
    });
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold mb-4 text-purple-300">Bot Controls</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg">TTS Enabled:</span>
          <Switch isOn={isTtsEnabled} handleToggle={handleTtsToggle} />
        </div>
        <div className="flex items-center justify-between">
            <label htmlFor="volume-slider" className="text-lg mr-4">Volume ({volume}%):</label>
            <input
                type="range"
                id="volume-slider"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
        </div>
        <button
          onClick={handleClearQueue}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          Clear Message Queue
        </button>
      </div>
    </div>
  );
}
