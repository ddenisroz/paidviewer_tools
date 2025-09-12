// src/components/ControlPanel.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [volume, setVolume] = useState(0.5); // Store volume as a float [0, 1]
  const [temperature, setTemperature] = useState(0.3);  // Lower default to reduce repetition
  const [stability, setStability] = useState(0.7);      // Higher default for stability
  const [error, setError] = useState('');
  const api = useApi();
  const { isAuthenticated } = useAuth();
  const debounceTimeoutRef = useRef(null);


  // Fetches the current status from the backend and updates the state
  const fetchStatus = useCallback(async () => {
    if (isAuthenticated) {
      try {
        setError('');
        const response = await api.get('/api/status');
        setIsTtsEnabled(response.data.is_enabled);
        setVolume(response.data.volume);
        setTemperature(response.data.temperature);
        setStability(response.data.stability);
      } catch (err) {
        console.error("Error fetching status:", err);
        setError('Could not fetch bot status.');
      }
    }
  }, [api, isAuthenticated]);

  // Fetch initial state on component mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleTtsToggle = async () => {
    try {
      setError('');
      const newState = !isTtsEnabled;
      await api.post('/api/tts/toggle', { is_enabled: newState });
      // Refetch the state from the server to ensure consistency
      await fetchStatus();
    } catch (err) {
      console.error('Error toggling TTS:', err);
      setError('Failed to toggle TTS.');
      // Optionally refetch status on error to revert optimistic UI changes
      await fetchStatus();
    }
  };

  const handleVolumeChange = async (e) => {
    const newVolumeAsInt = parseInt(e.target.value, 10);
    const newVolumeAsFloat = newVolumeAsInt / 100.0;
    
    // Update UI optimistically for smoother slider experience
    setVolume(newVolumeAsFloat);

    try {
      setError('');
      await api.post('/api/volume', { volume: newVolumeAsFloat });
      // No need to refetch here if we trust the optimistic update,
      // but refetching would be safer for consistency. Let's keep it simple for now.
    } catch (err) {
      console.error("Error setting volume:", err);
      setError('Failed to set volume.');
      // On error, refetch the true state from the server
      await fetchStatus();
    }
  };

  const handleGenerationChange = (newTemp, newStability) => {
    // Update UI optimistically
    setTemperature(newTemp);
    setStability(newStability);

    // Clear the previous timeout if it exists
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set a new timeout to send the request after 500ms of inactivity
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        setError('');
        await api.post('/api/generation', { temperature: newTemp, stability: newStability });
      } catch (err) {
        console.error("Error setting generation params:", err);
        setError('Failed to update generation settings.');
        await fetchStatus(); // Revert on error
      }
    }, 500);
  };
  
  const handleClearQueue = async () => {
    try {
        setError('');
        await api.post('/api/queue/clear');
        // Optionally show a confirmation message to the user
    } catch (err) {
        console.error("Error clearing queue:", err)
        setError('Failed to clear queue.');
    }
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold mb-4 text-purple-300">Bot Controls</h2>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg text-slate-200">Enable TTS Bot</span>
          <Switch isOn={isTtsEnabled} handleToggle={handleTtsToggle} />
        </div>
        <div className="space-y-2">
            <label htmlFor="volume-slider" className="text-lg text-slate-200 mr-4">Volume ({Math.round(volume * 100)}%)</label>
            <input
                type="range"
                id="volume-slider"
                min="0"
                max="100"
                value={Math.round(volume * 100)}
                onChange={handleVolumeChange}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
        </div>
         <div className="space-y-2">
            <label htmlFor="temp-slider" className="text-lg text-slate-200 mr-4">Creativity ({Math.round(temperature * 100)}%)</label>
            <p className="text-sm text-slate-400">Higher values make speech more expressive, but less predictable. Settings apply to your channel only.</p>
            <input
                type="range"
                id="temp-slider"
                min="0"
                max="100"
                value={Math.round(temperature * 100)}
                onChange={(e) => handleGenerationChange(parseInt(e.target.value, 10) / 100.0, stability)}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
        </div>
         <div className="space-y-2">
            <label htmlFor="stability-slider" className="text-lg text-slate-200 mr-4">Stability ({Math.round(stability * 100)}%)</label>
            <p className="text-sm text-slate-400">Higher values make speech more stable, but can sound robotic. Lower values can sound more emotional, but risk artifacts.</p>
            <input
                type="range"
                id="stability-slider"
                min="0"
                max="100"
                value={Math.round(stability * 100)}
                onChange={(e) => handleGenerationChange(temperature, parseInt(e.target.value, 10) / 100.0)}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
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
