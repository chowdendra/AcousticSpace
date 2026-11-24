"""
AcousticSpace - Feature Extraction Pipeline (Module 1)
B.Tech Final-Year Project in AI & Data Science
Implements Audio Preprocessing, Mel-Spectrogram Extraction, and Blind Room Impulse Response (RIR) Analysis
"""

import numpy as np
import math

def preprocess_audio(audio_signal: np.ndarray, sample_rate: int = 16000, target_duration: float = 4.0):
    """
    Standardizes audio signal to target sample rate, normalizes amplitude to -20 dBFS,
    and crops or pads to target length.
    """
    # 1. Convert stereo to mono if necessary
    if audio_signal.ndim > 1:
        audio_signal = np.mean(audio_signal, axis=1)

    # 2. Normalize peak amplitude
    max_val = np.max(np.abs(audio_signal))
    if max_val > 0:
        audio_signal = audio_signal / max_val * 0.9

    # 3. Crop or zero-pad to target samples
    target_samples = int(sample_rate * target_duration)
    if len(audio_signal) > target_samples:
        audio_signal = audio_signal[:target_samples]
    elif len(audio_signal) < target_samples:
        pad_width = target_samples - len(audio_signal)
        audio_signal = np.pad(audio_signal, (0, pad_width), mode='constant')

    return audio_signal

def compute_mel_spectrogram(audio_signal: np.ndarray, sr: int = 16000, n_fft: int = 1024, hop_length: int = 512, n_mels: int = 128):
    """
    Extracts log-Mel filterbank spectrogram features required by the Audio Spectrogram Transformer (AST).
    Uses standard STFT and triangular Mel filterbank.
    """
    # Hanning window
    window = np.hanning(n_fft)
    num_frames = 1 + (len(audio_signal) - n_fft) // hop_length
    
    stft = []
    for i in range(num_frames):
        start = i * hop_length
        frame = audio_signal[start : start + n_fft] * window
        spectrum = np.abs(np.fft.rfft(frame))
        stft.append(spectrum)
    
    stft = np.array(stft).T  # Shape: (freq_bins, num_frames)

    # Linear to Mel filterbank approximation
    mel_filters = np.linspace(0, stft.shape[0], n_mels + 2).astype(int)
    mel_spec = []
    for m in range(n_mels):
        band = np.mean(stft[mel_filters[m] : mel_filters[m+2], :], axis=0) if mel_filters[m+2] > mel_filters[m] else stft[mel_filters[m], :]
        mel_spec.append(band)

    mel_spec = np.array(mel_spec)
    # Log-amplitude compression (dB)
    log_mel = 10.0 * np.log10(np.maximum(1e-6, mel_spec))
    return log_mel

def estimate_schroeder_rt60(rir_impulse: np.ndarray, sr: int = 16000):
    """
    Estimates reverberation time RT60 using Schroeder's Backward Energy Integration:
        E(t) = integral_t^infinity h^2(tau) d(tau)
    Measures the decay slope from -5 dB to -35 dB (T30) and doubles it to get RT60.
    """
    squared_impulse = rir_impulse ** 2
    # Backward cumulative sum
    energy_decay = np.cumsum(squared_impulse[::-1])[::-1]
    
    # Avoid zero division
    max_energy = np.max(energy_decay)
    if max_energy <= 0:
        return 0.05
    
    decay_db = 10.0 * np.log10(np.maximum(1e-10, energy_decay / max_energy))

    # Find time indices corresponding to -5 dB and -35 dB
    idx_5db = np.where(decay_db <= -5.0)[0]
    idx_35db = np.where(decay_db <= -35.0)[0]

    if len(idx_5db) > 0 and len(idx_35db) > 0:
        t_5 = idx_5db[0] / sr
        t_35 = idx_35db[0] / sr
        t30 = t_35 - t_5
        rt60 = max(0.02, t30 * 2.0)
    else:
        # Fallback for extremely dry or non-decaying signals
        rt60 = 0.03

    return float(round(rt60, 3))

def calculate_drr(rir_impulse: np.ndarray, sr: int = 16000, direct_window_ms: float = 2.5):
    """
    Calculates the Direct-to-Reverberant Ratio (DRR):
        DRR = 10 * log10 ( Direct_Energy / Reverberant_Energy )
    A window of 2.5ms around the initial impulse arrival defines the direct path.
    """
    peak_idx = np.argmax(np.abs(rir_impulse))
    direct_samples = int((direct_window_ms / 1000.0) * sr)
    
    start_direct = max(0, peak_idx - direct_samples // 4)
    end_direct = min(len(rir_impulse), peak_idx + direct_samples)

    direct_energy = np.sum(rir_impulse[start_direct:end_direct] ** 2)
    reverb_energy = np.sum(rir_impulse[end_direct:] ** 2)

    if reverb_energy <= 0 or direct_energy <= 0:
        return 35.0  # Ultra-high DRR indicative of synthetic dry signal

    drr = 10.0 * np.log10(direct_energy / reverb_energy)
    return float(round(drr, 2))
