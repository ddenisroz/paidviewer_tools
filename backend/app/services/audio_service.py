import asyncio
import queue
import threading
import sounddevice as sd
import soundfile as sf
from pydub import AudioSegment
import io
import numpy as np

class AudioService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(AudioService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, 'initialized'):
            return

        print("Initializing Audio Service...")
        self.audio_queue = queue.Queue()
        self.volume = 0.7  # Default volume at 70%
        self.playback_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.playback_thread.start()
        self.initialized = True

    def add_to_queue(self, audio_path: str):
        """Add the path of a WAV file to the playback queue."""
        print(f"Adding to audio queue: {audio_path}")
        self.audio_queue.put(audio_path)

    def set_volume(self, volume: float):
        """Set the playback volume (0.0 to 1.0)."""
        self.volume = max(0.0, min(1.0, volume))

    def get_volume(self) -> float:
        """Get the current playback volume."""
        return self.volume

    def clear_queue(self) -> int:
        """Clears all items from the audio queue."""
        cleared_count = self.audio_queue.qsize()
        with self.audio_queue.mutex:
            self.audio_queue.queue.clear()
        return cleared_count

    def _process_queue(self):
        """Continuously process the audio queue."""
        while True:
            try:
                audio_path = self.audio_queue.get()
                if audio_path is None:  # Sentinel value to stop the thread if needed
                    break

                print(f"Now playing: {audio_path}")
                self._play_audio(audio_path)

                self.audio_queue.task_done()
            except Exception as e:
                print(f"Error in audio processing queue: {e}")

    def _play_audio(self, audio_path: str):
        """Play a single audio file using sounddevice."""
        try:
            audio = AudioSegment.from_wav(audio_path)

            # Apply volume adjustment
            # Convert volume (0-1 linear) to dB change
            # A volume of 1.0 is 0dB (no change), 0.5 is -6dB, 0.0 is -inf dB.
            if self.volume > 0:
                db_change = 20 * np.log10(self.volume)
                audio = audio + db_change
            else:
                audio = audio - 100 # Effectively silent

            normalized_audio = audio.apply_gain(-20.0 - audio.dBFS)

            samples = np.array(normalized_audio.get_array_of_samples()).astype(np.int16)

            sd.play(samples, samplerate=normalized_audio.frame_rate)
            sd.wait()  # Wait for the playback to finish
            print(f"Finished playing: {audio_path}")

        except Exception as e:
            print(f"Error playing audio file {audio_path}: {e}")

# Create a singleton instance
audio_service_instance = AudioService()


