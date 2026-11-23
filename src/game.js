// Main Game Loop, Camera, Parallax Rendering, Stunts & HUD for Hill Climb Racing

import { PhysicsWorld, Vehicle, Vec2 } from './physics.js?v=14';
import { Terrain } from './terrain.js?v=14';
import { VEHICLE_CATALOG, UPGRADE_CONFIG, applyUpgradesToVehicle, renderVehicle } from './vehicle.js?v=14';
import { ParticleSystem } from './particles.js?v=14';
import { soundManager } from './audio.js?v=14';
import { garageManager, STAGE_CATALOG } from './garage.js?v=14';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.world = new PhysicsWorld();
    this.terrain = new Terrain('countryside');
    this.particles = new ParticleSystem();

    this.state = 'GARAGE'; // 'GARAGE', 'PLAYING', 'GAMEOVER', 'PAUSED'

    // Camera
    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      zoom: 1.0,
      targetZoom: 1.0
    };

    // Garage animation & crash snapshot
    this.garageTime = 0;
    this.crashSnapshot = null;

    // Stunt Tracking
    this.stuntTracker = {
      airTime: 0,
      accumulatedAngle: 0,
      lastVehicleAngle: 0,
      toastText: '',
      toastTimer: 0,
      toastColor: '#ffd700'
    };

    // Run Stats
    this.runStats = {
      distance: 0,
      coinsEarned: 0,
      stuntBonuses: 0,
      airTimeBonus: 0,
      isNewRecord: false
    };

    // Input States
    this.keys = {
      gas: false,
      brake: false
    };

    // Vehicle instantiation
    this.vehicle = null;
    this.initVehicle();

    this.lastTime = performance.now();
    this.setupListeners();
    this.resizeCanvas();
    this.updateUI();

    // Start Animation Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  initVehicle() {
    const selId = garageManager.data.selectedVehicle || 'jeep';
    const cfg = VEHICLE_CATALOG[selId];
    this.vehicle = new Vehicle({
      name: cfg.name,
      type: cfg.id,
      startX: 4,
      startY: this.terrain.getHeightAt(4) - 0.95,
      mass: cfg.mass,
      width: cfg.width,
      height: cfg.height,
      wheelRadius: cfg.wheelRadius,
      rearAnchor: cfg.rearAnchor,
      frontAnchor: cfg.frontAnchor,
      color: cfg.color,
      maxTorque: cfg.maxTorque,
      maxMotorSpeed: cfg.maxMotorSpeed,
      brakeTorque: cfg.brakeTorque,
      reverseTorque: cfg.reverseTorque,
      tireFriction: cfg.tireFriction,
      airControlTorque: cfg.airControlTorque,
      is4WD: cfg.is4WD
    });

    const upgrades = garageManager.data.upgrades[selId] || {};
    applyUpgradesToVehicle(this.vehicle, cfg, upgrades);
  }

  startRace() {
    soundManager.ensureContext();
    const selStage = garageManager.data.selectedStage || 'countryside';
    this.terrain.setTheme(selStage);
    this.terrain.reset();
    this.world.setGravity(this.terrain.theme.gravity);

    this.initVehicle();
    const startX = 5;
    const rawStartY = this.terrain.getHeightAt(startX);
    const startY = Number.isFinite(rawStartY) ? rawStartY - 0.95 : 6;
    this.vehicle.reset(startX, startY);

    this.runStats = {
      distance: 0,
      coinsEarned: 0,
      stuntBonuses: 0,
      airTimeBonus: 0,
      isNewRecord: false
    };

    this.stuntTracker = {
      airTime: 0,
      accumulatedAngle: 0,
      lastVehicleAngle: this.vehicle.angle,
      toastText: '',
      toastTimer: 0,
      toastColor: '#ffd700'
    };

    this.keys = { gas: false, brake: false };
    document.getElementById('gasPedal')?.classList.remove('active');
    document.getElementById('brakePedal')?.classList.remove('active');

    this.particles.clear();
    this.crashSnapshot = null;
    const camX = this.vehicle.pos.x * this.world.scale;
    const camY = this.vehicle.pos.y * this.world.scale;
    this.camera = {
      x: camX,
      y: camY,
      targetX: camX,
      targetY: camY,
      zoom: 1.0,
      targetZoom: 1.0
    };

    this.state = 'PLAYING';
    soundManager.startEngine();
    this.updateUI();
  }

  restartRace() {
    this.startRace();
  }

  returnToGarage() {
    soundManager.stopEngine();
    this.state = 'GARAGE';
    this.updateUI();
  }

  triggerToast(text, color = '#ffd700', duration = 2.0) {
    this.stuntTracker.toastText = text;
    this.stuntTracker.toastColor = color;
    this.stuntTracker.toastTimer = duration;
    soundManager.playStuntSound();
  }

  setupListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Keyboard controls
    const isGasKey = (e, k) => (
      e.code === 'KeyD' || e.code === 'ArrowRight' || e.code === 'KeyW' || e.code === 'ArrowUp' ||
      k === 'd' || k === 'w' || k === 'arrowright' || k === 'arrowup'
    );
    const isBrakeKey = (e, k) => (
      e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Space' ||
      k === 'a' || k === 's' || k === 'arrowleft' || k === 'arrowdown' || k === ' '
    );

    window.addEventListener('keydown', (e) => {
      soundManager.ensureContext();
      const k = e.key ? e.key.toLowerCase() : '';
      if (isGasKey(e, k)) {
        this.keys.gas = true;
        document.getElementById('gasPedal')?.classList.add('active');
      }
      if (isBrakeKey(e, k)) {
        this.keys.brake = true;
        document.getElementById('brakePedal')?.classList.add('active');
      }
      if (e.code === 'Escape' || k === 'escape') {
        if (this.state === 'PLAYING') this.state = 'PAUSED';
        else if (this.state === 'PAUSED') this.state = 'PLAYING';
        this.updateUI();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key ? e.key.toLowerCase() : '';
      if (isGasKey(e, k)) {
        this.keys.gas = false;
        document.getElementById('gasPedal')?.classList.remove('active');
      }
      if (isBrakeKey(e, k)) {
        this.keys.brake = false;
        document.getElementById('brakePedal')?.classList.remove('active');
      }
    });

    // Touch & On-screen Pedal buttons with full pointer tracking
    const bindPedal = (elemId, key) => {
      const btn = document.getElementById(elemId);
      if (!btn) return;

      let clickTimeout = null;

      const press = (e) => {
        if (e && e.cancelable) e.preventDefault();
        soundManager.ensureContext();
        if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
        this.keys[key] = true;
        btn.classList.add('active');
      };

      const release = (e) => {
        if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
        this.keys[key] = false;
        btn.classList.remove('active');
        btn.blur();
      };

      // Pointer, mouse & touch down
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('mousedown', press);
      btn.addEventListener('touchstart', press, { passive: false });

      // Click: ensure quick taps/clicks register with an active pulse of 350ms
      btn.addEventListener('click', (e) => {
        if (e && e.cancelable) e.preventDefault();
        press(e);
        clickTimeout = setTimeout(() => release(e), 350);
      });
    };

    bindPedal('gasPedal', 'gas');
    bindPedal('brakePedal', 'brake');

    // Global safety release on window: guarantees pedals NEVER stick if released anywhere!
    const clearInputs = () => {
      this.keys.gas = false;
      this.keys.brake = false;
      document.getElementById('gasPedal')?.classList.remove('active');
      document.getElementById('brakePedal')?.classList.remove('active');
    };

    window.addEventListener('pointerup', clearInputs);
    window.addEventListener('pointercancel', clearInputs);
    window.addEventListener('mouseup', clearInputs);
    window.addEventListener('touchend', clearInputs);
    window.addEventListener('touchcancel', clearInputs);
    window.addEventListener('blur', clearInputs);
    window.addEventListener('contextmenu', clearInputs);
  }

  resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.displayWidth = window.innerWidth;
    this.displayHeight = window.innerHeight;
  }

  loop(timestamp) {
    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const dt = Math.min(rawDt, 0.05); // Prevent huge delta spikes on tab-switch

    if (this.state === 'PLAYING') {
      this.update(dt);
    } else if (this.state === 'GARAGE') {
      this.garageTime = (this.garageTime || 0) + dt;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    const v = this.vehicle;

    // Apply input to throttle with Brake Priority (Smart Brake)
    if (this.keys.brake) {
      v.throttle = -1.0;
    } else if (this.keys.gas) {
      v.throttle = 1.0;
    } else {
      v.throttle = 0.0;
    }

    // High frequency physics sub-stepping (8 sub-steps per frame)
    const subSteps = 8;
    const subDt = dt / subSteps;
    for (let i = 0; i < subSteps; i++) {
      v.step(subDt, this.world, this.terrain);
    }

    // Dynamic terrain chunk expansion
    this.terrain.ensureChunks(v.pos.x - 100, v.pos.x + 250);

    // Collectibles & pickups check
    this.terrain.checkPickups(
      v,
      (coin) => {
        // Coin collected
        this.runStats.coinsEarned += coin.value;
        garageManager.addCoins(coin.value);
        soundManager.playCoinSound(coin.value);
        this.particles.emitCoinSparkle(
          coin.x * this.world.scale,
          coin.y * this.world.scale,
          coin.value === 500 ? '#00f5d4' : (coin.value === 100 ? '#ffd700' : '#e0e0e0')
        );
      },
      (fuel) => {
        // Fuel collected
        v.fuel = Math.min(100, v.fuel + 100);
        v.isOutOfFuel = false;
        soundManager.playFuelPickupSound();
        this.particles.emitFuelSplash(fuel.x * this.world.scale, fuel.y * this.world.scale);
        this.triggerToast('+100% FUEL!', '#e63946', 1.5);
      }
    );

    // Audio updates
    soundManager.updateEngine(v.rpmRatio, v.throttle > 0, v.isAnyWheelGrounded());
    if (v.fuel < 22 && !v.isOutOfFuel && !v.isCrashed) {
      soundManager.playLowFuelAlert();
    }

    // Particle emission
    if (v.isAnyWheelGrounded()) {
      for (const w of v.wheels) {
        if (w.isGrounded && Math.abs(w.slipRatio) > 0.8) {
          const wx = w.worldPos.x * this.world.scale;
          const wy = (w.worldPos.y + w.radius) * this.world.scale;
          this.particles.emitDirt(wx, wy, -w.vel.x * 0.3, -w.vel.y * 0.3, this.terrain.theme.groundFillColor);
        }
      }
    }
    // Exhaust puff
    if (v.throttle > 0 && Math.random() < 0.6) {
      const cos = Math.cos(v.angle);
      const sin = Math.sin(v.angle);
      const exX = (v.pos.x - v.width * 0.45 * cos) * this.world.scale;
      const exY = (v.pos.y - v.width * 0.45 * sin) * this.world.scale;
      this.particles.emitSmoke(exX, exY, -cos * 2, -sin * 2);
    }
    this.particles.update(dt);

    // Stunt & Flip Tracking
    const isAirborne = !v.isAnyWheelGrounded();
    if (isAirborne && !v.isCrashed) {
      this.stuntTracker.airTime += dt;

      // Track angle rotation
      let diffAngle = v.angle - this.stuntTracker.lastVehicleAngle;
      // Normalize angle difference to [-pi, pi]
      while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
      while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
      this.stuntTracker.accumulatedAngle += diffAngle;

      // Check 360 flip
      if (this.stuntTracker.accumulatedAngle <= -Math.PI * 1.95) {
        this.stuntTracker.accumulatedAngle += Math.PI * 2;
        const reward = 1000;
        this.runStats.stuntBonuses += reward;
        garageManager.addCoins(reward);
        this.triggerToast('★ BACKFLIP! +$1000 ★', '#ffd700');
      } else if (this.stuntTracker.accumulatedAngle >= Math.PI * 1.95) {
        this.stuntTracker.accumulatedAngle -= Math.PI * 2;
        const reward = 1000;
        this.runStats.stuntBonuses += reward;
        garageManager.addCoins(reward);
        this.triggerToast('★ FRONTFLIP! +$1000 ★', '#ff9e00');
      }
    } else {
      // Landed
      if (this.stuntTracker.airTime > 1.3 && !v.isCrashed) {
        const airReward = Math.round(this.stuntTracker.airTime * 120);
        this.runStats.airTimeBonus += airReward;
        garageManager.addCoins(airReward);
        this.triggerToast(`AIR TIME: ${this.stuntTracker.airTime.toFixed(1)}s (+$${airReward})`, '#48cae4', 1.8);
      }
      this.stuntTracker.airTime = 0;
      this.stuntTracker.accumulatedAngle = 0;
    }
    this.stuntTracker.lastVehicleAngle = v.angle;

    // Toast Timer
    if (this.stuntTracker.toastTimer > 0) {
      this.stuntTracker.toastTimer -= dt;
    }

    // Distance tracking
    const curDist = Math.max(0, v.pos.x - 5);
    if (curDist > this.runStats.distance) {
      this.runStats.distance = curDist;
    }

    // Check Game Over Conditions
    if (v.isCrashed || (v.isOutOfFuel && Math.hypot(v.vel.x, v.vel.y) < 0.25)) {
      if (!v.gameOverTriggered) {
        v.gameOverTriggered = true;
        soundManager.playCrashSound();
        this.particles.emitCrashDebris(v.pos.x * this.world.scale, v.pos.y * this.world.scale);

        // Record high score
        const selStage = garageManager.data.selectedStage || 'countryside';
        const isRecord = garageManager.recordDistance(selStage, this.runStats.distance);
        this.runStats.isNewRecord = isRecord;

        // Capture crash snapshot ~120ms after impact so the crash ragdoll and dust cloud are visible
        setTimeout(() => {
          this.captureCrashSnapshot();
          soundManager.playCameraClick();
        }, 120);

        setTimeout(() => {
          this.state = 'GAMEOVER';
          this.updateUI();
        }, 850);
      }
    }

    // Camera smoothing
    const scale = this.world.scale;
    const lookAhead = Math.min(200, Math.max(-50, (v.vel.x || 0) * 20));
    this.camera.targetX = (v.pos.x || 5) * scale + lookAhead;
    this.camera.targetY = (v.pos.y || 7) * scale - 40;

    const speed = Math.hypot(v.vel.x || 0, v.vel.y || 0);
    this.camera.targetZoom = Math.max(0.72, Math.min(1.05, 1.0 - (speed / 35) * 0.25));

    if (!Number.isFinite(this.camera.targetX)) this.camera.targetX = (v.pos.x || 5) * scale;
    if (!Number.isFinite(this.camera.targetY)) this.camera.targetY = (v.pos.y || 7) * scale;
    if (!Number.isFinite(this.camera.targetZoom)) this.camera.targetZoom = 1.0;

    this.camera.x += (this.camera.targetX - this.camera.x) * Math.min(1.0, dt * 5);
    this.camera.y += (this.camera.targetY - this.camera.y) * Math.min(1.0, dt * 5);
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * Math.min(1.0, dt * 4);

    if (!Number.isFinite(this.camera.x)) this.camera.x = this.camera.targetX || 200;
    if (!Number.isFinite(this.camera.y)) this.camera.y = this.camera.targetY || 200;
    if (!Number.isFinite(this.camera.zoom) || this.camera.zoom <= 0) this.camera.zoom = 1.0;
  }

  captureCrashSnapshot() {
    try {
      const w = this.canvas.width;
      const h = this.canvas.height;
      if (w <= 0 || h <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const v = this.vehicle;
      const scale = this.world.scale;

      // Screen coords of vehicle in CSS pixels
      const screenX = (v.pos.x * scale - this.camera.x) * this.camera.zoom + this.displayWidth / 2;
      const screenY = (v.pos.y * scale - this.camera.y) * this.camera.zoom + this.displayHeight / 2;

      // Convert to canvas buffer pixels
      const centerBufferX = screenX * dpr;
      const centerBufferY = screenY * dpr;

      // Crop window: 16:9 Polaroid photo
      const cropW = Math.min(w, Math.max(380 * dpr, Math.min(w * 0.8, 520 * dpr)));
      const cropH = cropW * (9 / 16);

      let srcX = centerBufferX - cropW / 2;
      let srcY = centerBufferY - cropH / 2;

      srcX = Math.max(0, Math.min(w - cropW, srcX));
      srcY = Math.max(0, Math.min(h - cropH, srcY));

      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 500;
      snapCanvas.height = Math.round(500 * (9 / 16));
      const sCtx = snapCanvas.getContext('2d');

      // Draw the cropped canvas region
      sCtx.drawImage(this.canvas, srcX, srcY, cropW, cropH, 0, 0, snapCanvas.width, snapCanvas.height);

      // Vignette effect for classic polaroid photo look
      const vig = sCtx.createRadialGradient(
        snapCanvas.width / 2, snapCanvas.height / 2, snapCanvas.height * 0.35,
        snapCanvas.width / 2, snapCanvas.height / 2, snapCanvas.height * 0.8
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.3)');
      sCtx.fillStyle = vig;
      sCtx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);

      this.crashSnapshot = snapCanvas.toDataURL('image/jpeg', 0.88);
    } catch (e) {
      console.warn('Could not generate cropped crash photo:', e);
      try {
        this.crashSnapshot = this.canvas.toDataURL('image/jpeg', 0.8);
      } catch (err) {}
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;

    ctx.clearRect(0, 0, w, h);

    if (this.state === 'GARAGE') {
      this.renderGarageShowcase(ctx, w, h);
      return;
    }

    // Parallax Sky & Background
    this.renderParallaxBackground(ctx, w, h);

    // Apply Camera Transform
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // Render Terrain & Track
    this.renderTerrainWorld(ctx);

    // Render Particles (dirt, coin sparkles, smoke)
    this.particles.render(ctx);

    // Render Vehicle & Driver
    if (this.vehicle) {
      renderVehicle(ctx, this.vehicle, this.world.scale);
    }

    ctx.restore();

    // Render In-Game HUD overlay
    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAMEOVER') {
      this.renderHUD(ctx, w, h);
    }
  }

  renderParallaxBackground(ctx, w, h) {
    const theme = this.terrain.theme;

    // Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Moon stars
    if (theme.hasMoonStars) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % w;
        const sy = (i * 61) % (h * 0.7);
        const sr = (i % 3 === 0) ? 2 : 1;
        ctx.fillRect(sx, sy, sr, sr);
      }
      // Big Earth in lunar sky
      ctx.fillStyle = '#48cae4';
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.22, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#52b788';
      ctx.beginPath();
      ctx.arc(w * 0.79, h * 0.23, 30, 0, Math.PI * 1.5);
      ctx.fill();
    }

    // Parallax Mountain & Ridge Layers
    if (this.terrain.activeTheme === 'mountain') {
      // Dramatic jagged alpine summits with snow-capped peaks
      const farOffset = (this.camera.x * 0.08) % w;
      ctx.fillStyle = theme.mountainColor2;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const peaks = [];
      for (let x = -w; x <= w * 2; x += 140) {
        const peakX = x - farOffset;
        const peakY = h * 0.58 - Math.abs(Math.sin((x + farOffset) * 0.007)) * 170;
        ctx.lineTo(peakX, peakY);
        peaks.push({ x: peakX, y: peakY });
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // White snow caps on summits
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      for (let i = 0; i < peaks.length; i++) {
        const p = peaks[i];
        if (p.y < h * 0.48) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 24, p.y + 38);
          ctx.lineTo(p.x + 24, p.y + 38);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Mid Crag Ridges Layer (0.22x scroll)
      const midOffset = (this.camera.x * 0.22) % w;
      ctx.fillStyle = theme.mountainColor;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = -w; x <= w * 2; x += 90) {
        const hillY = h * 0.72 - Math.abs(Math.sin((x + midOffset) * 0.012)) * 110;
        ctx.lineTo(x - midOffset, hillY);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    } else {
      // Far Mountains Layer (0.08x scroll)
      const farOffset = (this.camera.x * 0.08) % w;
      ctx.fillStyle = theme.mountainColor2;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = -w; x <= w * 2; x += 120) {
        const peakY = h * 0.65 - Math.sin((x + farOffset) * 0.005) * 110;
        ctx.lineTo(x - farOffset, peakY);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Mid Hills Layer (0.22x scroll)
      const midOffset = (this.camera.x * 0.22) % w;
      ctx.fillStyle = theme.mountainColor;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = -w; x <= w * 2; x += 80) {
        const hillY = h * 0.78 - Math.sin((x + midOffset) * 0.009) * 80;
        ctx.lineTo(x - midOffset, hillY);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  }

  renderTerrainWorld(ctx) {
    const scale = this.world.scale;
    const theme = this.terrain.theme;

    for (const chunk of this.terrain.chunks) {
      const pts = chunk.points;
      if (pts.length < 2) continue;

      // Ground Polygon Fill
      ctx.fillStyle = theme.groundFillColor;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * scale, pts[i].y * scale);
      }
      // Bottom closure
      const lastX = pts[pts.length - 1].x * scale;
      const firstX = pts[0].x * scale;
      ctx.lineTo(lastX, lastX + 1500);
      ctx.lineTo(firstX, lastX + 1500);
      ctx.closePath();
      ctx.fill();

      // Top Grass / Road Surface Line
      ctx.strokeStyle = theme.groundTopColor;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * scale, pts[i].y * scale);
      }
      ctx.stroke();

      // Border outline
      ctx.strokeStyle = theme.groundBorderColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Signposts
      for (const sign of chunk.signPosts) {
        const sx = sign.x * scale;
        const sy = sign.y * scale;

        // Pole
        ctx.strokeStyle = '#5a3d28';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 45);
        ctx.stroke();

        // Sign board
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.fillRect(sx - 30, sy - 70, 60, 26);
        ctx.strokeRect(sx - 30, sy - 70, 60, 26);

        // Sign text
        ctx.fillStyle = '#e63946';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sign.distanceText, sx, sy - 52);
      }

      // Collectible Coins
      for (const coin of chunk.coins) {
        if (!coin.collected) {
          this.renderCoin(ctx, coin.x * scale, coin.y * scale, coin.value);
        }
      }

      // Fuel Jerry Cans
      for (const fuel of chunk.fuelCans) {
        if (!fuel.collected) {
          this.renderFuelCan(ctx, fuel.x * scale, fuel.y * scale);
        }
      }
    }
  }

  renderCoin(ctx, cx, cy, value) {
    const pulse = Math.sin(performance.now() * 0.006 + cx) * 0.15 + 1.0;
    const r = (value === 500 ? 16 : 13) * pulse;

    ctx.save();
    ctx.translate(cx, cy);

    if (value === 500) {
      // Diamond / Gem
      ctx.fillStyle = '#00f5d4';
      ctx.strokeStyle = '#00bbf9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$500', 0, 0);
    } else {
      // Coin
      const isGold = value === 100;
      const isSilver = value === 25;
      const fillColor = isGold ? '#ffd700' : (isSilver ? '#e0e0e0' : '#cd7f32');
      const borderColor = isGold ? '#b8860b' : (isSilver ? '#9e9e9e' : '#8b4513');

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Coin value label
      ctx.fillStyle = '#333';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${value}`, 0, 0);
    }

    ctx.restore();
  }

  renderFuelCan(ctx, fx, fy) {
    const bounce = Math.sin(performance.now() * 0.005 + fx) * 5;
    ctx.save();
    ctx.translate(fx, fy + bounce);

    // Red jerry can body
    ctx.fillStyle = '#e63946';
    ctx.strokeStyle = '#1d3557';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-16, -18, 32, 36, 6);
    ctx.fill();
    ctx.stroke();

    // Handle
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.roundRect(-10, -26, 20, 9, 3);
    ctx.fill();
    ctx.stroke();

    // Spout cap
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(8, -25, 7, 7);

    // "GAS" label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAS', 0, 4);

    ctx.restore();
  }

  renderHUD(ctx, w, h) {
    const v = this.vehicle;

    // Top-left: Distance & Record
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(20, 20, 230, 80, 12);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(this.runStats.distance)} m`, 38, 56);

    const selStage = garageManager.data.selectedStage || 'countryside';
    const record = garageManager.data.highScores[selStage] || 0;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`RECORD: ${record} m`, 38, 82);

    // Top-right: Total Coins & Run Coins
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(w - 230, 20, 210, 80, 12);
    ctx.fill();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${garageManager.data.coins.toLocaleString()}`, w - 38, 56);

    ctx.fillStyle = '#52b788';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`+$${this.runStats.coinsEarned + this.runStats.stuntBonuses + this.runStats.airTimeBonus}`, w - 38, 82);

    // Top-center: Fuel Gauge
    const fuelWidth = 240;
    const fuelHeight = 22;
    const fuelX = (w - fuelWidth) / 2;
    const fuelY = 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(fuelX - 10, fuelY - 8, fuelWidth + 20, fuelHeight + 28, 10);
    ctx.fill();

    // Fuel Bar
    const fuelRatio = Math.max(0, Math.min(1.0, v.fuel / 100));
    let fuelColor = '#52b788'; // green
    if (fuelRatio < 0.25) {
      // Blinking red alert
      fuelColor = Math.sin(performance.now() * 0.015) > 0 ? '#e63946' : '#8b0000';
    } else if (fuelRatio < 0.5) {
      fuelColor = '#ffb703'; // orange
    }

    ctx.fillStyle = '#333';
    ctx.fillRect(fuelX, fuelY, fuelWidth, fuelHeight);

    ctx.fillStyle = fuelColor;
    ctx.fillRect(fuelX, fuelY, fuelWidth * fuelRatio, fuelHeight);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(fuelX, fuelY, fuelWidth, fuelHeight);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fuelRatio < 0.25 ? '⚠️ LOW FUEL ⚠️' : 'FUEL', w / 2, fuelY + fuelHeight + 14);

    // Analog Speedometer & RPM Gauge (Bottom Center)
    this.renderAnalogGauges(ctx, w / 2, h - 90, v);

    // Stunt Toast Notification (Center screen)
    if (this.stuntTracker.toastTimer > 0) {
      const alpha = Math.min(1.0, this.stuntTracker.toastTimer * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.stuntTracker.toastColor;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.font = '900 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(this.stuntTracker.toastText, w / 2, h * 0.38);
      ctx.fillText(this.stuntTracker.toastText, w / 2, h * 0.38);
      ctx.restore();
    }
  }

  renderAnalogGauges(ctx, cx, cy, v) {
    const r = 44;
    const speed = Math.hypot(v.vel.x, v.vel.y) * 3.6; // km/h
    const rpm = v.rpmRatio;

    // RPM Gauge (Left)
    this.drawGauge(ctx, cx - 60, cy, r, rpm, 'RPM', ['#52b788', '#ffb703', '#e63946']);

    // Speed Gauge (Right)
    const speedRatio = Math.min(1.0, speed / 80);
    this.drawGauge(ctx, cx + 60, cy, r, speedRatio, `${Math.round(speed)} km/h`, ['#48cae4', '#0077b6']);

    // Control Status Badge (Centered directly above gauges)
    ctx.save();
    let badgeText = 'COASTING';
    let badgeBg = 'rgba(30, 41, 59, 0.9)';
    let badgeBorder = '#64748b';
    let badgeColor = '#94a3b8';

    if (v.throttle < 0) {
      badgeText = v.vel.x > 0.35 ? 'BRAKE ⛔' : 'REVERSE ◀';
      badgeBg = 'rgba(230, 57, 70, 0.95)';
      badgeBorder = '#e63946';
      badgeColor = '#ffffff';
    } else if (v.throttle > 0) {
      badgeText = 'GAS ▶';
      badgeBg = 'rgba(42, 157, 143, 0.95)';
      badgeBorder = '#2a9d8f';
      badgeColor = '#ffffff';
    }

    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cx - 52, cy - 62, 104, 24, 12);
    } else {
      ctx.rect(cx - 52, cy - 62, 104, 24);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, cx, cy - 46);
    ctx.restore();
  }

  drawGauge(ctx, x, y, r, ratio, label, colors) {
    ctx.fillStyle = 'rgba(20, 20, 25, 0.85)';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dial arc
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, r - 8, startAngle, startAngle + (endAngle - startAngle) * ratio);
    ctx.stroke();

    // Needle
    const needleAngle = startAngle + (endAngle - startAngle) * ratio;
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(needleAngle) * (r - 12), y + Math.sin(needleAngle) * (r - 12));
    ctx.stroke();

    // Center pin
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = '#bbb';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r - 12);
  }

  renderGarageShowcase(ctx, w, h) {
    const t = this.garageTime || 0;

    // 1. Vibrant Hill Climb Sunny Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    skyGrad.addColorStop(0, '#1d70b8');
    skyGrad.addColorStop(0.35, '#3498db');
    skyGrad.addColorStop(1, '#85c1e9');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Sunny Rays & Cartoon Sun
    const sunX = w * 0.16;
    const sunY = h * 0.20;
    // Corona glow
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 110);
    sunGlow.addColorStop(0, 'rgba(255, 236, 139, 0.65)');
    sunGlow.addColorStop(1, 'rgba(255, 236, 139, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
    ctx.fill();
    // Sun body
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();

    // 3. Drifting Fluffy Cartoon Clouds
    const clouds = [
      { base: 0.08, y: 0.13, s: 1.1, sp: 10 },
      { base: 0.42, y: 0.20, s: 0.85, sp: 16 },
      { base: 0.76, y: 0.15, s: 1.25, sp: 12 }
    ];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    for (const c of clouds) {
      const cx = ((c.base * w + t * c.sp) % (w + 240)) - 120;
      const cy = h * c.y;
      const r = 24 * c.s;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.85, cy - r * 0.2, r * 0.8, 0, Math.PI * 2);
      ctx.arc(cx - r * 0.85, cy - r * 0.15, r * 0.75, 0, Math.PI * 2);
      ctx.arc(cx + r * 1.5, cy + r * 0.15, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Distant Rolling Cartoon Mountains
    ctx.fillStyle = '#52b788';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.50);
    ctx.bezierCurveTo(w * 0.2, h * 0.40, w * 0.45, h * 0.52, w * 0.7, h * 0.42);
    ctx.bezierCurveTo(w * 0.85, h * 0.38, w * 0.95, h * 0.46, w, h * 0.44);
    ctx.lineTo(w, h);
    ctx.fill();

    // 5. Midground Hills
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.56);
    ctx.bezierCurveTo(w * 0.35, h * 0.48, w * 0.65, h * 0.60, w, h * 0.52);
    ctx.lineTo(w, h);
    ctx.fill();

    // 6. Foreground Rolling Hill Pedestal where the Car Sits
    const hillCrestY = h * 0.46;
    // Brown Soil Base
    ctx.fillStyle = '#4a2c11';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, hillCrestY + 45);
    ctx.bezierCurveTo(w * 0.25, hillCrestY - 14, w * 0.75, hillCrestY - 14, w, hillCrestY + 50);
    ctx.lineTo(w, h);
    ctx.fill();

    // Dirt pebble speckles
    ctx.fillStyle = '#6e4420';
    for (let i = 0; i < 22; i++) {
      const px = (i * 73 + 30) % w;
      const py = hillCrestY + 22 + (i * 31) % 75;
      ctx.fillRect(px, py, 6, 4);
    }

    // Lush Green Grass Stripe
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1b4332';
    ctx.beginPath();
    ctx.moveTo(-10, hillCrestY + 45);
    ctx.bezierCurveTo(w * 0.25, hillCrestY - 14, w * 0.75, hillCrestY - 14, w + 10, hillCrestY + 50);
    ctx.stroke();

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#74c69d';
    ctx.beginPath();
    ctx.moveTo(-10, hillCrestY + 40);
    ctx.bezierCurveTo(w * 0.25, hillCrestY - 18, w * 0.75, hillCrestY - 18, w + 10, hillCrestY + 46);
    ctx.stroke();

    // Checkered Finish / Start Flag Pole on the right
    const flagX = w * 0.78;
    const flagY = hillCrestY + 6;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(flagX, flagY);
    ctx.lineTo(flagX, flagY - 50);
    ctx.stroke();

    // Checkered flag banner
    const fw = 30;
    const fh = 18;
    const wave = Math.sin(t * 5) * 3;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#111';
        ctx.fillRect(flagX + c * (fw / 3), flagY - 50 + r * (fh / 2) + wave * (c / 3), fw / 3, fh / 2);
      }
    }

    // Wooden "0m" Post
    const signX = w * 0.22;
    const signY = hillCrestY + 6;
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(signX - 4, signY - 42, 8, 42);
    ctx.fillStyle = '#d2a679';
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(signX - 22, signY - 46, 44, 20, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4a2810';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0 m', signX, signY - 32);

    // 7. Render Preview Vehicle with Idling Animation
    if (this.vehicle) {
      const idleBounce = Math.sin(t * 3.5) * 2;
      const carX = w / 2;
      const carY = hillCrestY - 14 + idleBounce;

      // Ground contact shadow below car
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(carX, hillCrestY + 3, 75, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Exhaust Smoke Puffs
      ctx.fillStyle = 'rgba(230, 230, 230, 0.45)';
      for (let p = 0; p < 3; p++) {
        const pAge = (t * 2 + p * 0.33) % 1;
        const px = carX - 60 - pAge * 35;
        const py = carY + 6 - pAge * 14;
        const pr = 4 + pAge * 10;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(carX, carY);
      renderVehicle(ctx, this.vehicle, 58); // Showcased at 58 scale
      ctx.restore();
    }
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
    }
    this.updateUI();
  }

  updateUI() {
    const garageScreen = document.getElementById('garageScreen');
    const gameOverModal = document.getElementById('gameOverModal');
    const pauseModal = document.getElementById('pauseModal');
    const hudControls = document.getElementById('hudControls');
    const hudTopActions = document.getElementById('hudTopActions');
    const hudPauseBtn = document.getElementById('hudPauseBtn');

    if (this.state === 'GARAGE') {
      garageScreen.style.display = 'flex';
      gameOverModal.style.display = 'none';
      pauseModal.style.display = 'none';
      hudControls.style.display = 'none';
      if (hudTopActions) hudTopActions.style.display = 'none';
      this.renderGarageDOM();
    } else if (this.state === 'PLAYING') {
      garageScreen.style.display = 'none';
      gameOverModal.style.display = 'none';
      pauseModal.style.display = 'none';
      hudControls.style.display = 'flex';
      if (hudTopActions) hudTopActions.style.display = 'flex';
      if (hudPauseBtn) hudPauseBtn.innerHTML = '<span>⏸</span> PAUSE';
      soundManager.startEngine();
    } else if (this.state === 'GAMEOVER') {
      hudControls.style.display = 'none';
      if (hudTopActions) hudTopActions.style.display = 'none';
      gameOverModal.style.display = 'flex';
      this.renderGameOverDOM();
    } else if (this.state === 'PAUSED') {
      pauseModal.style.display = 'flex';
      hudControls.style.display = 'none';
      if (hudTopActions) hudTopActions.style.display = 'flex';
      if (hudPauseBtn) hudPauseBtn.innerHTML = '<span>▶</span> RESUME';
      soundManager.stopEngine();
    }
  }

  renderGarageDOM() {
    const data = garageManager.data;
    const curVehicleId = data.selectedVehicle || 'jeep';
    const curVehicle = VEHICLE_CATALOG[curVehicleId];
    const curStageId = data.selectedStage || 'countryside';

    // Coins & Record Headers
    const coinEl = document.getElementById('garageCoinDisplay');
    if (coinEl) coinEl.innerText = `$${data.coins.toLocaleString()}`;

    const recordEl = document.getElementById('garageRecordDisplay');
    const maxRecord = Math.max(0, ...Object.values(data.highScores || {}));
    if (recordEl) recordEl.innerText = `BEST: ${maxRecord.toLocaleString()} m`;

    // Showcase Vehicle Info
    const vNameEl = document.getElementById('showcaseVehicleName');
    if (vNameEl) vNameEl.innerText = curVehicle.name.toUpperCase();

    const statPwr = document.getElementById('statBarPwr');
    const statSus = document.getElementById('statBarSus');
    const statGrp = document.getElementById('statBarGrp');
    if (statPwr) statPwr.style.width = curVehicleId === 'truck' ? '95%' : (curVehicleId === 'bike' ? '82%' : '65%');
    if (statSus) statSus.style.width = curVehicleId === 'truck' ? '92%' : (curVehicleId === 'bike' ? '55%' : '75%');
    if (statGrp) statGrp.style.width = curVehicleId === 'truck' ? '88%' : (curVehicleId === 'bike' ? '70%' : '80%');

    const vActionEl = document.getElementById('showcaseVehicleAction');
    const isCurUnlocked = data.unlockedVehicles.includes(curVehicleId);
    if (vActionEl) {
      if (isCurUnlocked) {
        vActionEl.innerHTML = '<span class="badge selected-badge">★ READY TO RACE ★</span>';
      } else {
        vActionEl.innerHTML = `<button class="btn btn-buy" id="showcaseUnlockBtn">UNLOCK FOR $${curVehicle.price.toLocaleString()}</button>`;
        document.getElementById('showcaseUnlockBtn')?.addEventListener('click', () => {
          if (garageManager.unlockVehicle(curVehicleId)) {
            soundManager.playCoinSound(100);
            this.initVehicle();
            this.renderGarageDOM();
          } else {
            alert('Not enough coins to unlock this vehicle!');
          }
        });
      }
    }

    // Vehicle Navigation (◀ Prev & Next ▶)
    const vKeys = Object.keys(VEHICLE_CATALOG);
    const curIdx = vKeys.indexOf(curVehicleId);

    const prevBtn = document.getElementById('prevVehicleBtn');
    if (prevBtn) {
      prevBtn.onclick = () => {
        const nextIdx = (curIdx - 1 + vKeys.length) % vKeys.length;
        garageManager.data.selectedVehicle = vKeys[nextIdx];
        garageManager.saveData();
        soundManager.playClickSound();
        this.initVehicle();
        this.renderGarageDOM();
      };
    }

    const nextBtn = document.getElementById('nextVehicleBtn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        const nextIdx = (curIdx + 1) % vKeys.length;
        garageManager.data.selectedVehicle = vKeys[nextIdx];
        garageManager.saveData();
        soundManager.playClickSound();
        this.initVehicle();
        this.renderGarageDOM();
      };
    }

    // Vehicle Upgrade Grid (The 4 iconic upgrades with 10-segment LED pips)
    const upGrid = document.getElementById('upgradesGrid');
    if (upGrid) {
      upGrid.innerHTML = '';
      const UPGRADE_ICONS = {
        engine: '⚙️',
        suspension: '🦿',
        tires: '🛞',
        fourWD: '⚡'
      };

      Object.keys(UPGRADE_CONFIG).forEach((upKey) => {
        const cfg = UPGRADE_CONFIG[upKey];
        const lvl = garageManager.getUpgradeLevel(curVehicleId, upKey);
        const cost = garageManager.getUpgradeCost(upKey, lvl);
        const isMax = lvl >= cfg.maxLevel;

        let ledPipsHTML = '<div class="upgrade-led-bar">';
        for (let p = 1; p <= cfg.maxLevel; p++) {
          ledPipsHTML += `<span class="led-pip ${p <= lvl ? 'active' : ''}"></span>`;
        }
        ledPipsHTML += '</div>';

        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
          <div class="upgrade-header">
            <span class="upgrade-name">${UPGRADE_ICONS[upKey] || '🔧'} ${cfg.name.toUpperCase()}</span>
            <span class="upgrade-lvl">LVL ${lvl}/${cfg.maxLevel}</span>
          </div>
          ${ledPipsHTML}
          <div class="upgrade-desc">${cfg.desc}</div>
          <button class="btn btn-upgrade ${isMax ? 'disabled' : ''}" data-up="${upKey}" ${isMax ? 'disabled' : ''}>
            ${isMax ? '★ MAXED ★' : `UPGRADE 🪙 $${cost.toLocaleString()}`}
          </button>
        `;
        upGrid.appendChild(card);
      });

      upGrid.querySelectorAll('[data-up]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (garageManager.buyUpgrade(curVehicleId, btn.dataset.up)) {
            soundManager.playUpgradeSound();
            this.initVehicle();
            this.renderGarageDOM();
          } else {
            alert('Not enough coins for this upgrade!');
          }
        });
      });
    }

    // Stage Selector Cards
    const sList = document.getElementById('stageList');
    if (sList) {
      sList.innerHTML = '';
      const STAGE_ICONS = {
        countryside: '🌲',
        desert: '🏜️',
        moon: '🌕',
        mountain: '🏔️'
      };

      Object.values(STAGE_CATALOG).forEach((s) => {
        const isUnlocked = data.unlockedStages.includes(s.id);
        const isSelected = s.id === curStageId;
        const record = data.highScores[s.id] || 0;

        const card = document.createElement('div');
        card.className = `catalog-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
        card.innerHTML = `
          <div class="card-title">${STAGE_ICONS[s.id] || '🏁'} ${s.name}</div>
          <div class="card-desc">${s.description}</div>
          <div class="card-record">🏆 RECORD: ${record.toLocaleString()}m</div>
          <div class="card-action">
            ${isUnlocked
              ? (isSelected ? '<span class="badge selected-badge">SELECTED</span>' : `<button class="btn btn-select" data-stage="${s.id}">SELECT</button>`)
              : `<button class="btn btn-buy" data-buy-s="${s.id}">UNLOCK $${s.price.toLocaleString()}</button>`}
          </div>
        `;
        sList.appendChild(card);
      });

      sList.querySelectorAll('[data-stage]').forEach((btn) => {
        btn.addEventListener('click', () => {
          soundManager.playClickSound();
          garageManager.selectStage(btn.dataset.stage);
          this.renderGarageDOM();
        });
      });
      sList.querySelectorAll('[data-buy-s]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (garageManager.unlockStage(btn.dataset.buyS)) {
            soundManager.playCoinSound(100);
            this.renderGarageDOM();
          } else {
            alert('Not enough coins!');
          }
        });
      });
    }

    // Vehicle Catalog Roster
    const vList = document.getElementById('vehicleList');
    if (vList) {
      vList.innerHTML = '';
      const VEHICLE_ICONS = {
        jeep: '🚙',
        bike: '🏍️',
        truck: '🛻'
      };

      Object.values(VEHICLE_CATALOG).forEach((v) => {
        const isUnlocked = data.unlockedVehicles.includes(v.id);
        const isSelected = v.id === curVehicleId;

        const card = document.createElement('div');
        card.className = `catalog-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
        card.innerHTML = `
          <div class="card-title">${VEHICLE_ICONS[v.id] || '🚗'} ${v.name}</div>
          <div class="card-desc">${v.description}</div>
          <div class="card-action">
            ${isUnlocked
              ? (isSelected ? '<span class="badge selected-badge">ACTIVE</span>' : `<button class="btn btn-select" data-id="${v.id}">CHOOSE</button>`)
              : `<button class="btn btn-buy" data-buy-v="${v.id}">UNLOCK $${v.price.toLocaleString()}</button>`}
          </div>
        `;
        vList.appendChild(card);
      });

      vList.querySelectorAll('[data-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          soundManager.playClickSound();
          garageManager.selectVehicle(btn.dataset.id);
          this.initVehicle();
          this.renderGarageDOM();
        });
      });
      vList.querySelectorAll('[data-buy-v]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (garageManager.unlockVehicle(btn.dataset.buyV)) {
            soundManager.playCoinSound(100);
            this.initVehicle();
            this.renderGarageDOM();
          } else {
            alert('Not enough coins!');
          }
        });
      });
    }
  }

  renderGameOverDOM() {
    const v = this.vehicle;
    const titleEl = document.getElementById('gameOverTitle');
    const reasonEl = document.getElementById('gameOverReason');
    const distEl = document.getElementById('summaryDistance');
    const coinsEl = document.getElementById('summaryCoins');
    const stuntsEl = document.getElementById('summaryStunts');
    const recordBadge = document.getElementById('newRecordBadge');
    const snapImg = document.getElementById('crashSnapshotImg');
    const snapCaption = document.getElementById('polaroidCaption');
    const snapStamp = document.getElementById('polaroidStamp');
    const snapContainer = document.getElementById('crashPhotoContainer');

    if (titleEl) titleEl.innerText = v.isCrashed ? 'DRIVER DOWN!' : 'OUT OF FUEL!';
    if (reasonEl) reasonEl.innerText = v.isCrashed ? 'Driver head touched the terrain' : 'Your gas tank emptied';
    if (distEl) distEl.innerText = `${Math.round(this.runStats.distance)} m`;
    if (coinsEl) coinsEl.innerText = `$${this.runStats.coinsEarned.toLocaleString()}`;
    if (stuntsEl) stuntsEl.innerText = `$${(this.runStats.stuntBonuses + this.runStats.airTimeBonus).toLocaleString()}`;
    if (recordBadge) recordBadge.style.display = this.runStats.isNewRecord ? 'block' : 'none';

    // Polaroid Crash Photo
    if (this.crashSnapshot && snapImg) {
      snapImg.src = this.crashSnapshot;
      if (snapContainer) snapContainer.style.display = 'flex';
      if (snapCaption) {
        snapCaption.innerText = `📸 Snapped at ${Math.round(this.runStats.distance)}m • ${v.isCrashed ? 'Driver Down!' : 'Out of Fuel!'}`;
      }
      if (snapStamp) {
        snapStamp.innerText = v.isCrashed ? 'CRASH!' : 'EMPTY!';
        snapStamp.style.color = v.isCrashed ? '#e63946' : '#f59e0b';
        snapStamp.style.borderColor = v.isCrashed ? '#e63946' : '#f59e0b';
      }
    } else if (snapContainer) {
      snapContainer.style.display = 'none';
    }
  }
}

// Global bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.__game = game;

  // Bind Start / Retry / Resume / Garage buttons
  document.getElementById('startRaceBtn')?.addEventListener('click', () => game.startRace());
  document.getElementById('retryRaceBtn')?.addEventListener('click', () => game.restartRace());
  document.getElementById('returnGarageBtn')?.addEventListener('click', () => game.returnToGarage());
  document.getElementById('hudBackBtn')?.addEventListener('click', () => game.returnToGarage());
  document.getElementById('hudPauseBtn')?.addEventListener('click', () => game.togglePause());
  document.getElementById('resumeBtn')?.addEventListener('click', () => {
    game.state = 'PLAYING';
    game.updateUI();
  });
  document.getElementById('pauseRestartBtn')?.addEventListener('click', () => game.restartRace());
  document.getElementById('pauseGarageBtn')?.addEventListener('click', () => game.returnToGarage());

  // Audio Toggle
  document.getElementById('muteToggleBtn')?.addEventListener('click', (e) => {
    const isMuted = soundManager.toggleMute();
    e.target.innerText = isMuted ? '🔇 MUTED' : '🔊 SOUND ON';
  });
});
