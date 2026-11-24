/**
 * AcousticSpace - Audio Samples & Synthetic Room Convolution Engine
 * Generates realistic synthetic speech signals & room acoustic profiles using Web Audio API
 */

class AudioSamplesManager {
  constructor() {
    this.audioCtx = null;
    this.sampleProfiles = {
      'genuine-room': {
        name: 'Genuine Human Speech - Living Room Enclosure',
        filename: 'genuine_human_livingroom_mic1.wav',
        duration: 3.85,
        sampleRate: 16000,
        verdict: 'AUTHENTIC HUMAN SPEECH',
        verdictType: 'real',
        fakeProb: 3.6,
        realProb: 96.4,
        coherence: 91.2,
        rt60: 0.48,
        drr: 12.4,
        edt: 0.39,
        summary: 'Acoustic reflections are mathematically coupled with vocal tract formant harmonics. Energy decay exhibits classic Sabine-Schroeder exponential decay (R² = 0.98).',
        anomalies: [],
        findings: [
          { type: 'ok', title: 'Harmonic Formant vs Reverberation Alignment', detail: 'Vocal pitch changes correspond consistently with acoustic room decay frequencies. No unnatural phase jump.' },
          { type: 'ok', title: 'Diffuseness & Late Reflection Density', detail: 'Reflection density scales quadratically N(t) ∝ t², authentic for a 3D enclosed space.' },
          { type: 'ok', title: 'Room Boundary Temporal Continuity', detail: 'Continuous ambient room tone and stationary acoustic transfer function across the entire 3.85s duration.' }
        ]
      },
      'synthetic-elevenlabs': {
        name: 'ElevenLabs AI Voice - Zero Room Acoustics',
        filename: 'elevenlabs_v2_clean_neutral.wav',
        duration: 3.50,
        sampleRate: 16000,
        verdict: 'POTENTIALLY SYNTHETIC / DEEPFAKE',
        verdictType: 'fake',
        fakeProb: 95.8,
        realProb: 4.2,
        coherence: 12.8,
        rt60: 0.02,
        drr: 34.6,
        edt: 0.01,
        summary: 'CRITICAL ANOMALY: Complete absence of physical room boundary reflections. Direct-to-reverberant ratio (+34.6 dB) indicates a mathematical acoustic vacuum impossible in real rooms.',
        anomalies: [
          { start: 0.0, end: 3.5, label: 'Unnatural Zero-Reverb Dry Vocoder Signal' }
        ],
        findings: [
          { type: 'warn', title: 'Acoustic Vacuum / Missing Room Transfer Function', detail: 'Sound energy attenuates instantly to zero (<15ms) when phonation stops. Natural indoor enclosures maintain reverberant tails.' },
          { type: 'warn', title: 'Abnormal Direct-to-Reverberant Ratio (DRR)', detail: 'Measured DRR is +34.6 dB. Natural speech at standard conversational distance (1m) typically yields +8 to +15 dB.' },
          { type: 'warn', title: 'AST Transformer Feature Match', detail: 'Patch embedding matches synthetic neural vocoder latent artifacts from diffusion/flow-matching architectures.' }
        ]
      },
      'synthetic-valle-reverb': {
        name: 'VALL-E AI Clone - Artificial Reverb Mismatch',
        filename: 'valle_cloned_with_reverb_fx.wav',
        duration: 4.10,
        sampleRate: 16000,
        verdict: 'POTENTIALLY SYNTHETIC / DEEPFAKE',
        verdictType: 'fake',
        fakeProb: 91.2,
        realProb: 8.8,
        coherence: 22.4,
        rt60: 0.94,
        drr: 4.2,
        edt: 0.81,
        summary: 'ACOUSTIC MISMATCH: Audio contains artificial reverberation overlay, but the reverb tail is mathematically decoupled from the speaker formant frequencies and room absorption physics.',
        anomalies: [
          { start: 1.1, end: 2.8, label: 'Phase Incoherence & Metallic Comb Filtering' }
        ],
        findings: [
          { type: 'warn', title: 'Phoneme-Reverb Decoupling', detail: 'High-frequency sibilants (/s/, /t/) lack expected high-frequency surface absorption, revealing synthetic algorithmic convolution.' },
          { type: 'warn', title: 'Comb Filtering & Static Delay Lines', detail: 'Cepstral analysis reveals periodic spectral nulls characteristic of low-order artificial delay lines rather than true 3D spatial scattering.' },
          { type: 'ok', title: 'Vocal Prosody Naturalness', detail: 'Prosody and pitch mimic human speech, but underlying spatial acoustics fail forensic validation.' }
        ]
      },
      'spliced-attack': {
        name: 'Spliced Attack - Acoustic Boundary Jump',
        filename: 'politician_intercept_spliced_attack.wav',
        duration: 4.20,
        sampleRate: 16000,
        verdict: 'ACOUSTIC ANOMALY / SPLICED AUDIO',
        verdictType: 'anomaly',
        fakeProb: 88.5,
        realProb: 11.5,
        coherence: 38.6,
        rt60: 0.32,
        drr: 18.2,
        edt: 0.28,
        summary: 'SPLICING DETECTED: Sudden shift in acoustic environment at t = 2.12s. First half recorded in conference room (RT60: 0.52s), followed by an inserted synthetic sentence with zero reverb.',
        anomalies: [
          { start: 2.12, end: 3.45, label: 'Spliced Injection: DRR Jump +16 dB' }
        ],
        findings: [
          { type: 'warn', title: 'Room Transfer Discontinuity at 02.12s', detail: 'Ambient noise floor drops by 18 dB and early reflection pattern disappears abruptly between phonemes.' },
          { type: 'warn', title: 'Acoustic Boundary Mismatch', detail: 'Source sound transitions from 120m³ room reflections directly into anechoic characteristics without physical transition.' },
          { type: 'ok', title: 'Initial Segment Authentic', detail: 'Segment [0.0s - 2.1s] displays coherent human speech acoustics.' }
        ]
      }
    };
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Synthesizes audio buffer for preset sample demonstrations
   */
  generateSampleAudioBuffer(sampleKey) {
    const ctx = this.initAudioContext();
    const profile = this.sampleProfiles[sampleKey] || this.sampleProfiles['genuine-room'];
    const duration = profile.duration;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    // Fundamental speech harmonics simulation
    const f0 = sampleKey.includes('female') ? 220 : 130; // pitch
    const formants = [
      { freq: 700, bw: 100, amp: 1.0 },   // F1
      { freq: 1220, bw: 120, amp: 0.6 },  // F2
      { freq: 2600, bw: 150, amp: 0.35 }  // F3
    ];

    // Room parameters based on preset
    let rt60 = profile.rt60;
    let drr = profile.drr;
    let decayRate = 6.91 / Math.max(0.01, rt60); // decay constant for -60dB

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;

      // Base speech syllables modulation
      const syllableEnv = 0.5 * (1 + Math.sin(2 * Math.PI * 3.2 * t)) * Math.max(0, Math.sin(Math.PI * t / duration));
      
      // Pitch pulse
      let voiceSignal = 0;
      for (let h = 1; h <= 12; h++) {
        const harmonicFreq = f0 * h + Math.sin(6 * Math.PI * t) * 2;
        let harmAmp = 1 / h;
        // Apply formant resonant weighting
        for (const f of formants) {
          const dist = Math.abs(harmonicFreq - f.freq);
          if (dist < f.bw * 2) {
            harmAmp += f.amp * Math.exp(-0.5 * Math.pow(dist / f.bw, 2));
          }
        }
        voiceSignal += Math.sin(2 * Math.PI * harmonicFreq * t) * harmAmp;
      }
      voiceSignal *= 0.15 * syllableEnv;

      // Spliced attack modulation
      let currentSampleSampleRate = decayRate;
      let isSplicedZone = false;
      if (sampleKey === 'spliced-attack' && t >= 2.12 && t <= 3.45) {
        isSplicedZone = true;
        currentSampleSampleRate = 6.91 / 0.02; // sudden drop to dry
      }

      // Environmental Room Reflections
      let roomReverb = 0;
      if (sampleKey === 'synthetic-elevenlabs' || isSplicedZone) {
        // Almost dry - pure vocoder output
        roomReverb = 0;
      } else if (sampleKey === 'synthetic-valle-reverb') {
        // Artificial metallic reverb (mismatched delay comb)
        const delay1 = Math.floor(i - sampleRate * 0.045);
        const delay2 = Math.floor(i - sampleRate * 0.085);
        if (delay1 > 0) roomReverb += channel[delay1] * 0.45;
        if (delay2 > 0) roomReverb += channel[delay2] * 0.35;
        // metallic ring
        roomReverb += Math.sin(2 * Math.PI * 1450 * t) * 0.015 * syllableEnv;
      } else {
        // Natural Living Room / Lecture Hall early reflections + decay
        const earlyDelays = [0.012, 0.025, 0.041, 0.068];
        const earlyGains = [0.4, 0.28, 0.18, 0.12];
        for (let d = 0; d < earlyDelays.length; d++) {
          const delayIdx = Math.floor(i - sampleRate * earlyDelays[d]);
          if (delayIdx > 0) {
            roomReverb += channel[delayIdx] * earlyGains[d] * Math.exp(-currentSampleSampleRate * earlyDelays[d]);
          }
        }
        // Ambient room noise floor
        roomReverb += (Math.random() - 0.5) * 0.003;
      }

      channel[i] = voiceSignal + roomReverb * 0.5;
    }

    return { buffer, profile };
  }
}

window.AudioSamplesManager = AudioSamplesManager;
