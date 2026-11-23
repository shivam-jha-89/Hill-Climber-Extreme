// Particle System for Hill Climb Racing
// Exhaust smoke, dirt kickup, coin sparkles, fuel bursts, and crash effects.

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emitSmoke(x, y, vx, vy, color = 'rgba(200, 200, 200, 0.6)') {
    this.particles.push({
      x, y,
      vx: vx + (Math.random() - 0.5) * 0.8,
      vy: vy + (Math.random() - 0.5) * 0.8 - 0.5,
      radius: 4 + Math.random() * 4,
      growthRate: 14,
      alpha: 0.6,
      decay: 1.2,
      color: color,
      type: 'smoke'
    });
  }

  emitDirt(x, y, vx, vy, color = '#583101') {
    this.particles.push({
      x, y,
      vx: vx + (Math.random() - 0.5) * 4,
      vy: vy - 1 - Math.random() * 3,
      radius: 2 + Math.random() * 3,
      growthRate: -0.5,
      alpha: 0.9,
      decay: 1.8,
      color: color,
      type: 'dirt'
    });
  }

  emitCoinSparkle(x, y, color = '#ffd700') {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 2,
        growthRate: -2,
        alpha: 1.0,
        decay: 2.2,
        color: color,
        type: 'sparkle'
      });
    }
  }

  emitFuelSplash(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4,
        growthRate: -2,
        alpha: 1.0,
        decay: 2.0,
        color: '#e63946',
        type: 'fuel'
      });
    }
  }

  emitCrashDebris(x, y) {
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        radius: 3 + Math.random() * 4,
        growthRate: -1,
        alpha: 1.0,
        decay: 1.1,
        color: Math.random() > 0.5 ? '#e63946' : '#222',
        type: 'debris'
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 40; // in canvas pixels
      p.y += p.vy * dt * 40;
      p.radius += p.growthRate * dt;
      p.alpha -= p.decay * dt;

      if (p.type === 'dirt' || p.type === 'debris') {
        p.vy += 12 * dt; // gravity on dirt
      }

      if (p.alpha <= 0 || p.radius <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}
