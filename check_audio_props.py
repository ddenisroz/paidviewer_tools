import sys
from pydub import AudioSegment
from pydub.utils import mediainfo
import os

def analyze_audio(file_path):
    try:
        if not os.path.exists(file_path):
            print(f"Error: File not found at '{file_path}'")
            return

        info = mediainfo(file_path)
        audio = AudioSegment.from_file(file_path)

        duration_seconds = len(audio) / 1000.0
        sample_rate = info.get('sample_rate', 'N/A')
        channels = info.get('channels', 'N/A')
        bit_rate = info.get('bit_rate', 'N/A')

        print(f"--- Audio File Analysis ---")
        print(f"File: {os.path.basename(file_path)}")
        print(f"Duration: {duration_seconds:.2f} seconds")
        print(f"Sample Rate: {sample_rate} Hz")
        print(f"Channels: {channels}")
        print(f"---------------------------")

        if float(sample_rate) < 22050:
            print(f"Warning: Sample rate is {sample_rate} Hz, which is below the recommended 22050 Hz. This can significantly degrade quality.")
        if int(channels) != 1:
            print(f"Warning: Audio is not mono (it has {channels} channels). Stereo samples can sometimes confuse the model.")
        if duration_seconds < 5:
            print(f"Warning: The audio sample is very short ({duration_seconds:.2f} seconds). The model may not have enough data to create a good clone (recommended > 10 seconds).")
        print()

    except Exception as e:
        print(f"Error analyzing file '{file_path}': {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for path in sys.argv[1:]:
             analyze_audio(path)
    else:
        print("Please provide one or more file paths.")


