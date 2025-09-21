#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audio converter for F5-TTS requirements
Converts uploaded audio to F5-TTS compatible format
"""

import logging
import tempfile
import os
from pathlib import Path
from typing import Optional
import soundfile as sf
import numpy as np
import librosa
from pydub import AudioSegment

logger = logging.getLogger(__name__)

# F5-TTS requirements
TARGET_SAMPLE_RATE = 16000  # 16kHz
TARGET_CHANNELS = 1  # Mono
TARGET_BIT_DEPTH = 16  # 16-bit
TARGET_DURATION_MIN = 3.0  # Minimum 3 seconds
TARGET_DURATION_MAX = 10.0  # Maximum 10 seconds

def convert_audio_for_f5tts(input_path: str, output_path: str) -> bool:
    """
    Convert audio file to F5-TTS compatible format
    
    Requirements:
    - Format: WAV
    - Sample rate: 16kHz
    - Channels: Mono (1 channel)
    - Bit depth: 16-bit
    - Duration: 3-10 seconds
    - Quality: Clean, no noise
    
    Args:
        input_path: Path to input audio file
        output_path: Path to save converted audio file
        
    Returns:
        bool: True if conversion successful, False otherwise
    """
    try:
        logger.info(f"Converting audio: {input_path} -> {output_path}")
        
        # Check if input file exists and has content
        if not os.path.exists(input_path):
            logger.error(f"Input file does not exist: {input_path}")
            return False
            
        if os.path.getsize(input_path) == 0:
            logger.error(f"Input file is empty: {input_path}")
            return False
        
        # Load audio with librosa (handles various formats)
        try:
            audio_data, original_sr = librosa.load(input_path, sr=None, mono=False)
        except Exception as e:
            logger.error(f"Failed to load audio file {input_path}: {e}")
            return False
        
        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = librosa.to_mono(audio_data)
            logger.info("Converted stereo to mono")
        
        # Resample to 16kHz
        if original_sr != TARGET_SAMPLE_RATE:
            audio_data = librosa.resample(
                audio_data, 
                orig_sr=original_sr, 
                target_sr=TARGET_SAMPLE_RATE
            )
            logger.info(f"Resampled from {original_sr}Hz to {TARGET_SAMPLE_RATE}Hz")
        
        # Check duration
        duration = len(audio_data) / TARGET_SAMPLE_RATE
        logger.info(f"Audio duration: {duration:.2f} seconds")
        
        if duration < TARGET_DURATION_MIN:
            logger.warning(f"Audio too short ({duration:.2f}s < {TARGET_DURATION_MIN}s)")
            # Pad with silence
            silence_samples = int((TARGET_DURATION_MIN - duration) * TARGET_SAMPLE_RATE)
            audio_data = np.concatenate([audio_data, np.zeros(silence_samples)])
            logger.info(f"Padded to {TARGET_DURATION_MIN}s")
        elif duration > TARGET_DURATION_MAX:
            logger.warning(f"Audio too long ({duration:.2f}s > {TARGET_DURATION_MAX}s)")
            # Trim to maximum duration
            max_samples = int(TARGET_DURATION_MAX * TARGET_SAMPLE_RATE)
            audio_data = audio_data[:max_samples]
            logger.info(f"Trimmed to {TARGET_DURATION_MAX}s")
        
        # Normalize audio (prevent clipping)
        max_val = np.max(np.abs(audio_data))
        if max_val > 0:
            audio_data = audio_data / max_val * 0.95  # Leave some headroom
            logger.info(f"Normalized audio (max was {max_val:.3f})")
        
        # Convert to 16-bit integer
        audio_data = (audio_data * 32767).astype(np.int16)
        
        # Save as WAV file
        sf.write(
            output_path,
            audio_data,
            TARGET_SAMPLE_RATE,
            subtype='PCM_16',
            format='WAV'
        )
        
        logger.info(f"Successfully converted audio to F5-TTS format: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error converting audio: {e}", exc_info=True)
        return False

def validate_audio_for_f5tts(file_path: str) -> tuple[bool, str]:
    """
    Validate if audio file meets F5-TTS requirements
    
    Args:
        file_path: Path to audio file
        
    Returns:
        tuple: (is_valid, error_message)
    """
    try:
        # Load audio
        audio_data, sr = librosa.load(file_path, sr=None, mono=False)
        
        # Check sample rate
        if sr != TARGET_SAMPLE_RATE:
            return False, f"Sample rate must be {TARGET_SAMPLE_RATE}Hz, got {sr}Hz"
        
        # Check channels
        if len(audio_data.shape) > 1 and audio_data.shape[0] > 1:
            return False, "Audio must be mono (1 channel)"
        
        # Check duration
        duration = len(audio_data) / sr
        if duration < TARGET_DURATION_MIN:
            return False, f"Audio too short ({duration:.2f}s < {TARGET_DURATION_MIN}s minimum)"
        if duration > TARGET_DURATION_MAX:
            return False, f"Audio too long ({duration:.2f}s > {TARGET_DURATION_MAX}s maximum)"
        
        # Check if audio is not silent
        if np.max(np.abs(audio_data)) < 0.001:
            return False, "Audio appears to be silent or too quiet"
        
        return True, "Audio meets F5-TTS requirements"
        
    except Exception as e:
        return False, f"Error validating audio: {str(e)}"

def get_audio_info(file_path: str) -> dict:
    """
    Get audio file information
    
    Args:
        file_path: Path to audio file
        
    Returns:
        dict: Audio information
    """
    try:
        audio_data, sr = librosa.load(file_path, sr=None, mono=False)
        
        return {
            "sample_rate": sr,
            "channels": 1 if len(audio_data.shape) == 1 else audio_data.shape[0],
            "duration": len(audio_data) / sr,
            "samples": len(audio_data),
            "max_amplitude": float(np.max(np.abs(audio_data))),
            "rms": float(np.sqrt(np.mean(audio_data**2))),
            "is_mono": len(audio_data.shape) == 1 or audio_data.shape[0] == 1
        }
    except Exception as e:
        logger.error(f"Error getting audio info: {e}")
        return {}

if __name__ == "__main__":
    # Test the converter
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python audio_converter.py <input_file> <output_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"Converting {input_file} to F5-TTS format...")
    success = convert_audio_for_f5tts(input_file, output_file)
    
    if success:
        print(f"✅ Conversion successful: {output_file}")
        
        # Validate the result
        is_valid, message = validate_audio_for_f5tts(output_file)
        print(f"Validation: {message}")
        
        # Show audio info
        info = get_audio_info(output_file)
        print(f"Audio info: {info}")
    else:
        print("❌ Conversion failed")
        sys.exit(1)
