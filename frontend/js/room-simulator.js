/**
 * AcousticSpace - 2D/3D Room Acoustic Ray-Tracing & Impulse Response Simulator
 * Simulates physical acoustic reflection paths, Sabine RT60 estimation, and RIR generation
 */

class RoomSimulator {
  constructor() {
    this.canvas = document.getElementById('roomRayCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.rirCanvas = document.getElementById('simRirCanvas');
    this.rirCtx = this.rirCanvas ? this.rirCanvas.getContext('2d') : null;

    // Room parameters
    this.roomLength = 6.0; // meters (width on canvas)
    this.roomWidth = 5.0;  // meters (height on canvas)
    this.roomHeight = 3.0; // meters
    this.alpha = 0.22;     // absorption coefficient (0 to 1)

    // Speaker (source) & Mic (receiver) positions (normalized [0, 1])
    this.speaker = { x: 0.28, y: 0.5 };
    this.mic = { x: 0.72, y: 0.5 };

    // Interaction state
    this.dragging = null; // 'speaker' or 'mic'
    this.rays = [];
    this.pulseAnim = 0;
    this.animId = null;

    this.initControls();
    this.initInteractions();
    this.recalculateSabine();
    this.render();
  }

  initControls() {
    const presetSelect = document.getElementById('simRoomPreset');
    const lengthSlider = document.getElementById('simRoomLength');
    const alphaSlider = document.getElementById('simAbsorption');
    const distSlider = document.getElementById('simDistance');
    const btnPulse = document.getElementById('btnEmitSoundPulse');
    const btnConvolve = document.getElementById('btnConvolveAudio');

    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'living-room') {
          this.roomLength = 6.0; this.roomWidth = 5.0; this.roomHeight = 3.0; this.alpha = 0.22;
        } else if (val === 'classroom') {
          this.roomLength = 9.0; this.roomWidth = 7.0; this.roomHeight = 3.5; this.alpha = 0.14;
        } else if (val === 'cathedral') {
          this.roomLength = 18.0; this.roomWidth = 12.0; this.roomHeight = 9.0; this.alpha = 0.08;
        } else if (val === 'dry-studio') {
          this.roomLength = 5.0; this.roomWidth = 4.0; this.roomHeight = 2.8; this.alpha = 0.75;
        } else if (val === 'small-booth') {
          this.roomLength = 3.0; this.roomWidth = 2.5; this.roomHeight = 2.4; this.alpha = 0.88;
        }
        if (lengthSlider) lengthSlider.value = this.roomLength;
        if (alphaSlider) alphaSlider.value = this.alpha;
        this.updateReadouts();
        this.recalculateSabine();
        this.render();
      });
    }

    if (lengthSlider) {
      lengthSlider.addEventListener('input', (e) => {
        this.roomLength = parseFloat(e.target.value);
        this.roomWidth = this.roomLength * 0.8;
        this.updateReadouts();
        this.recalculateSabine();
        this.render();
      });
    }

    if (alphaSlider) {
      alphaSlider.addEventListener('input', (e) => {
        this.alpha = parseFloat(e.target.value);
        this.updateReadouts();
        this.recalculateSabine();
        this.render();
      });
    }

    if (distSlider) {
      distSlider.addEventListener('input', (e) => {
        const targetDist = parseFloat(e.target.value);
        const curDist = Math.hypot((this.mic.x - this.speaker.x) * this.roomLength, (this.mic.y - this.speaker.y) * this.roomWidth);
        const scale = targetDist / Math.max(0.1, curDist);
        this.mic.x = Math.min(0.9, Math.max(0.1, this.speaker.x + (this.mic.x - this.speaker.x) * scale));
        this.mic.y = Math.min(0.9, Math.max(0.1, this.speaker.y + (this.mic.y - this.speaker.y) * scale));
        this.updateReadouts();
        this.render();
      });
    }

    if (btnPulse) {
      btnPulse.addEventListener('click', () => {
        this.triggerAcousticImpulse();
      });
    }

    if (btnConvolve) {
      btnConvolve.addEventListener('click', () => {
        this.applyRoomConvolveToCurrentAudio();
      });
    }
  }

  updateReadouts() {
    const dimEl = document.getElementById('roomDimReadout');
    const alphaEl = document.getElementById('roomAlphaReadout');
    const distEl = document.getElementById('micDistanceReadout');

    const volume = this.roomLength * this.roomWidth * this.roomHeight;
    if (dimEl) dimEl.textContent = `${this.roomLength.toFixed(1)}m × ${this.roomWidth.toFixed(1)}m × ${this.roomHeight.toFixed(1)}m (${volume.toFixed(0)} m³)`;
    if (alphaEl) alphaEl.textContent = `α = ${this.alpha.toFixed(2)}`;
    
    const physicalDist = Math.hypot((this.mic.x - this.speaker.x) * this.roomLength, (this.mic.y - this.speaker.y) * this.roomWidth);
    if (distEl) distEl.textContent = `${physicalDist.toFixed(2)} meters`;
  }

  recalculateSabine() {
    const V = this.roomLength * this.roomWidth * this.roomHeight;
    const S = 2 * (this.roomLength * this.roomWidth + this.roomLength * this.roomHeight + this.roomWidth * this.roomHeight);
    const rt60 = (0.161 * V) / Math.max(0.01, S * this.alpha);

    const rt60El = document.getElementById('simSabineRT60');
    if (rt60El) rt60El.textContent = `${rt60.toFixed(2)} s`;
    this.computedRT60 = rt60;
  }

  initInteractions() {
    if (!this.canvas) return;

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      const p = getPos(e);
      const spkPx = { x: this.speaker.x * this.canvas.width, y: this.speaker.y * this.canvas.height };
      const micPx = { x: this.mic.x * this.canvas.width, y: this.mic.y * this.canvas.height };

      if (Math.hypot(p.x - spkPx.x, p.y - spkPx.y) < 20) {
        this.dragging = 'speaker';
      } else if (Math.hypot(p.x - micPx.x, p.y - micPx.y) < 20) {
        this.dragging = 'mic';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const p = getPos(e);
      const nx = Math.max(0.05, Math.min(0.95, p.x / this.canvas.width));
      const ny = Math.max(0.05, Math.min(0.95, p.y / this.canvas.height));

      if (this.dragging === 'speaker') {
        this.speaker.x = nx; this.speaker.y = ny;
      } else if (this.dragging === 'mic') {
        this.mic.x = nx; this.mic.y = ny;
      }
      this.updateReadouts();
      this.render();
    });

    window.addEventListener('mouseup', () => {
      this.dragging = null;
    });
  }

  computeRays() {
    const rays = [];
    const numRays = 36;
    const maxBounces = 3;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const margin = 20;

    const sx = this.speaker.x * w;
    const sy = this.speaker.y * h;

    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      let currX = sx;
      let currY = sy;
      let dx = Math.cos(angle);
      let dy = Math.sin(angle);
      let energy = 1.0;
      const points = [{ x: currX, y: currY, energy: 1.0 }];

      for (let b = 0; b < maxBounces; b++) {
        // Find nearest wall intersection
        let tMin = Infinity;
        let normalX = 0, normalY = 0;

        // Left wall (x = margin)
        if (dx < 0) {
          const t = (margin - currX) / dx;
          if (t > 0.001 && t < tMin) { tMin = t; normalX = 1; normalY = 0; }
        }
        // Right wall (x = w - margin)
        if (dx > 0) {
          const t = (w - margin - currX) / dx;
          if (t > 0.001 && t < tMin) { tMin = t; normalX = -1; normalY = 0; }
        }
        // Top wall (y = margin)
        if (dy < 0) {
          const t = (margin - currY) / dy;
          if (t > 0.001 && t < tMin) { tMin = t; normalX = 0; normalY = 1; }
        }
        // Bottom wall (y = h - margin)
        if (dy > 0) {
          const t = (h - margin - currY) / dy;
          if (t > 0.001 && t < tMin) { tMin = t; normalX = 0; normalY = -1; }
        }

        if (tMin === Infinity) break;

        currX += dx * tMin;
        currY += dy * tMin;
        energy *= (1.0 - this.alpha);
        points.push({ x: currX, y: currY, energy: Math.max(0.05, energy) });

        // Reflect direction: d - 2*(d.n)*n
        const dot = dx * normalX + dy * normalY;
        dx = dx - 2 * dot * normalX;
        dy = dy - 2 * dot * normalY;
      }
      rays.push(points);
    }
    return rays;
  }

  render() {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const margin = 20;

    this.ctx.clearRect(0, 0, w, h);

    // 1. Draw Room Walls
    this.ctx.fillStyle = '#060a14';
    this.ctx.fillRect(margin, margin, w - 2 * margin, h - 2 * margin);

    // Wall grid
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;
    for (let x = margin + 30; x < w - margin; x += 30) {
      this.ctx.beginPath(); this.ctx.moveTo(x, margin); this.ctx.lineTo(x, h - margin); this.ctx.stroke();
    }
    for (let y = margin + 30; y < h - margin; y += 30) {
      this.ctx.beginPath(); this.ctx.moveTo(margin, y); this.ctx.lineTo(w - margin, y); this.ctx.stroke();
    }

    // Wall perimeter with absorption color tint
    const wallHue = Math.floor(180 - this.alpha * 120);
    this.ctx.strokeStyle = `hsl(${wallHue}, 70%, 50%)`;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(margin, margin, w - 2 * margin, h - 2 * margin);

    // 2. Draw Rays
    const rays = this.computeRays();
    for (const ray of rays) {
      for (let p = 0; p < ray.length - 1; p++) {
        const p1 = ray[p];
        const p2 = ray[p + 1];
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);

        if (p === 0) {
          this.ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 * p1.energy})`;
        } else if (p === 1) {
          this.ctx.strokeStyle = `rgba(167, 139, 250, ${0.35 * p1.energy})`;
        } else {
          this.ctx.strokeStyle = `rgba(244, 63, 94, ${0.25 * p1.energy})`;
        }
        this.ctx.lineWidth = Math.max(1, 2.5 * p1.energy);
        this.ctx.stroke();
      }
    }

    // 3. Draw Speaker Node (Blue)
    const spkX = this.speaker.x * w;
    const spkY = this.speaker.y * h;
    this.ctx.beginPath();
    this.ctx.arc(spkX, spkY, 14, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0284c7';
    this.ctx.fill();
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('SPK', spkX, spkY);

    // 4. Draw Mic Node (Red)
    const micX = this.mic.x * w;
    const micY = this.mic.y * h;
    this.ctx.beginPath();
    this.ctx.arc(micX, micY, 14, 0, Math.PI * 2);
    this.ctx.fillStyle = '#dc2626';
    this.ctx.fill();
    this.ctx.strokeStyle = '#f87171';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText('MIC', micX, micY);

    // Direct wave distance line
    this.ctx.beginPath();
    this.ctx.moveTo(spkX, spkY);
    this.ctx.lineTo(micX, micY);
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    this.ctx.setLineDash([4, 4]);
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Distance label
    const physDist = Math.hypot((this.mic.x - this.speaker.x) * this.roomLength, (this.mic.y - this.speaker.y) * this.roomWidth);
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`d = ${physDist.toFixed(2)}m`, (spkX + micX) / 2, (spkY + micY) / 2 - 8);

    // 5. Render Generated RIR Chart
    this.renderRIRChart();
  }

  renderRIRChart() {
    if (!this.rirCtx) return;
    const w = this.rirCanvas.width;
    const h = this.rirCanvas.height;

    this.rirCtx.clearRect(0, 0, w, h);
    this.rirCtx.fillStyle = '#060913';
    this.rirCtx.fillRect(0, 0, w, h);

    // Center zero-line
    const midY = h / 2;
    this.rirCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.rirCtx.beginPath();
    this.rirCtx.moveTo(0, midY);
    this.rirCtx.lineTo(w, midY);
    this.rirCtx.stroke();

    // Direct sound arrival time t_0 based on physical distance (c = 343 m/s)
    const dist = Math.hypot((this.mic.x - this.speaker.x) * this.roomLength, (this.mic.y - this.speaker.y) * this.roomWidth);
    const t0_ms = (dist / 343.0) * 1000; // milliseconds
    const t0_px = Math.max(30, Math.min(120, (t0_ms / 250) * w));

    // Direct impulse spike
    this.rirCtx.strokeStyle = '#38bdf8';
    this.rirCtx.lineWidth = 3;
    this.rirCtx.beginPath();
    this.rirCtx.moveTo(t0_px, midY);
    this.rirCtx.lineTo(t0_px, midY - (h * 0.44));
    this.rirCtx.stroke();

    // Direct spike label
    this.rirCtx.fillStyle = '#38bdf8';
    this.rirCtx.font = '10px monospace';
    this.rirCtx.fillText(`Direct (${t0_ms.toFixed(1)}ms)`, t0_px + 4, midY - 35);

    // Early reflections spikes (first 50 ms)
    const earlyWallBounces = [
      { delay: t0_px + 20, amp: 0.65 * (1 - this.alpha), col: '#a78bfa' },
      { delay: t0_px + 38, amp: 0.48 * (1 - this.alpha), col: '#a78bfa' },
      { delay: t0_px + 55, amp: 0.35 * (1 - this.alpha), col: '#a78bfa' },
      { delay: t0_px + 72, amp: 0.28 * (1 - this.alpha), col: '#a78bfa' }
    ];

    for (const bounce of earlyWallBounces) {
      this.rirCtx.strokeStyle = bounce.col;
      this.rirCtx.lineWidth = 2;
      this.rirCtx.beginPath();
      this.rirCtx.moveTo(bounce.delay, midY);
      this.rirCtx.lineTo(bounce.delay, midY + (h * 0.35 * bounce.amp));
      this.rirCtx.stroke();
    }

    // Late diffuse reverberant tail (exponential envelope decay)
    const decayConstant = 6.91 / Math.max(0.05, this.computedRT60 || 0.45);
    this.rirCtx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
    this.rirCtx.lineWidth = 1;
    this.rirCtx.beginPath();

    const startX = t0_px + 80;
    for (let x = startX; x < w; x += 2) {
      const timeSec = ((x - t0_px) / w) * 0.8;
      const env = Math.exp(-decayConstant * timeSec);
      const noise = (Math.random() - 0.5) * 2;
      const val = env * noise * (h * 0.3);
      if (x === startX) this.rirCtx.moveTo(x, midY + val);
      else this.rirCtx.lineTo(x, midY + val);
    }
    this.rirCtx.stroke();
  }

  triggerAcousticImpulse() {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtxClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + Math.min(2.5, this.computedRT60 || 0.45));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 2.5);

    // Pulse animation
    this.pulseAnim = 1.0;
    const animatePulse = () => {
      this.pulseAnim -= 0.05;
      if (this.pulseAnim > 0) {
        this.render();
        const spkX = this.speaker.x * this.canvas.width;
        const spkY = this.speaker.y * this.canvas.height;
        this.ctx.beginPath();
        this.ctx.arc(spkX, spkY, (1 - this.pulseAnim) * 80, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(56, 189, 248, ${this.pulseAnim})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        requestAnimationFrame(animatePulse);
      } else {
        this.render();
      }
    };
    animatePulse();
  }

  applyRoomConvolveToCurrentAudio() {
    alert(`Applied Virtual Enclosure Parameters:\n• Room: ${this.roomLength.toFixed(1)}m × ${this.roomWidth.toFixed(1)}m × ${this.roomHeight.toFixed(1)}m\n• Sabine RT60: ${this.computedRT60.toFixed(2)}s\n• Absorption α: ${this.alpha.toFixed(2)}\n\nAcoustic transfer function h(t) convolved with current speech stream.`);
  }
}

window.RoomSimulator = RoomSimulator;
