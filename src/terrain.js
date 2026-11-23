// Procedural Infinite Terrain Generator & Biome System for Hill Climb Racing
// Supports smooth chunked splines, collectible placement, and biome themes.

export class TerrainChunk {
  constructor(startIndex, startX, width, pointSpacing, heightFn) {
    this.startIndex = startIndex;
    this.startX = startX;
    this.width = width;
    this.pointSpacing = pointSpacing;
    this.points = []; // array of { x, y, nx, ny }
    this.coins = [];  // array of { x, y, value, collected, radius }
    this.fuelCans = []; // array of { x, y, collected, radius }
    this.signPosts = []; // array of { x, y, distanceText }

    this.generate(heightFn);
  }

  generate(heightFn) {
    const numPoints = Math.ceil(this.width / this.pointSpacing) + 1;
    for (let i = 0; i <= numPoints; i++) {
      const x = this.startX + i * this.pointSpacing;
      const y = heightFn(x);
      this.points.push({ x, y, nx: 0, ny: -1 });
    }

    // Calculate surface normals
    for (let i = 0; i < this.points.length; i++) {
      const prev = this.points[Math.max(0, i - 1)];
      const next = this.points[Math.min(this.points.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      // Normal perpendicular to tangent pointing upwards (ny negative in canvas coords)
      this.points[i].nx = dy / len;
      this.points[i].ny = -dx / len;
    }
  }
}

export class Terrain {
  constructor(themeName = 'countryside') {
    this.chunkWidth = 80; // meters per chunk
    this.pointSpacing = 1.2; // meters between nodes
    this.chunks = [];
    this.activeTheme = themeName;
    this.setTheme(themeName);

    this.nextChunkIndex = 0;
    this.nextFuelCanDist = 95; // meters
    this.nextSignDist = 100;

    // Pre-generate initial chunks
    this.ensureChunks(0, 300);
  }

  setTheme(name) {
    this.activeTheme = name;
    if (name === 'desert') {
      this.theme = {
        name: 'Desert',
        gravity: 52,
        skyTop: '#ffb703',
        skyBottom: '#fb8500',
        groundTopColor: '#ffb703',
        groundBorderColor: '#d48b04',
        groundFillColor: '#b06500',
        rockColor: '#8a4e00',
        mountainColor: '#e07a5f',
        mountainColor2: '#9e2a2b',
        hasMoonStars: false,
        frictionMod: 1.05
      };
    } else if (name === 'moon') {
      this.theme = {
        name: 'Moon',
        gravity: 18, // Low lunar gravity (fun & floaty without leaving orbit)
        skyTop: '#05070f',
        skyBottom: '#101528',
        groundTopColor: '#adb5bd',
        groundBorderColor: '#6c757d',
        groundFillColor: '#343a40',
        rockColor: '#212529',
        mountainColor: '#1d2333',
        mountainColor2: '#121622',
        hasMoonStars: true,
        frictionMod: 0.95
      };
    } else if (name === 'mountain') {
      this.theme = {
        name: 'Mountain Peaks',
        gravity: 54, // Solid mountain gravity
        skyTop: '#1b263b',      // Dramatic alpine dusk
        skyBottom: '#415a77',   // Twilight mountain haze
        groundTopColor: '#e0e1dd', // Snow & frost crag rim
        groundBorderColor: '#778da9', // Weathered stone ridge
        groundFillColor: '#0d1b2a', // Dark jagged bedrock
        rockColor: '#1b263b',
        mountainColor: '#415a77',
        mountainColor2: '#27384e',
        hasMoonStars: false,
        frictionMod: 1.05
      };
    } else {
      // Default: Countryside
      this.theme = {
        name: 'Countryside',
        gravity: 52,
        skyTop: '#4ea8de',
        skyBottom: '#90e0ef',
        groundTopColor: '#52b788',
        groundBorderColor: '#2d6a4f',
        groundFillColor: '#583101',
        rockColor: '#3c2415',
        mountainColor: '#74c69d',
        mountainColor2: '#40916c',
        hasMoonStars: false,
        frictionMod: 1.0
      };
    }
  }

  heightFunction(x) {
    // Starting flat runway for first 22 meters
    if (x < 22) return 8.0;

    if (this.activeTheme === 'mountain') {
      const relX = x - 22;
      const blend = Math.min(1.0, relX / 10);
      const diff = 1.0 + Math.min(1.4, relX / 600);

      // 1. Foundation: High jagged mountain ridges & valleys (macro elevation)
      const macroRidge = Math.sin(relX * 0.022) * 6.5;

      // 2. Steep launch kickers: sharp upward ramps that launch vehicle into high airtime
      // Asymmetric sine: steep ramp face, sharp crest lip (requires mid-air brake leveling)
      const kickerPhase = relX * 0.082;
      const kicker = (Math.sin(kickerPhase) / (1 - 0.48 * Math.cos(kickerPhase))) * 3.8 * diff;

      // 3. Moguls / Camel humps: rhythm washboard peaks that buck the chassis if driven blind
      const mogulPhase = relX * 0.28;
      const mogulEnvelope = 0.5 + 0.5 * Math.sin(relX * 0.035);
      const moguls = Math.sin(mogulPhase) * 2.0 * mogulEnvelope * Math.min(1.5, diff);

      // 4. Razor cliffs & drop-offs: sudden ravines requiring slope-matching mid-air leveling
      const dropPhase = relX * 0.044 + 0.9;
      const drops = Math.sin(dropPhase) * 2.8;

      // 5. Micro bumps on rock surface
      const microRock = Math.sin(relX * 0.55) * 0.22;

      return 8.0 - (macroRidge + kicker + moguls + drops + microRock) * blend;
    }

    // Default: Rolling gentle countryside / desert hills
    const dist = x;
    const difficultyFactor = Math.min(2.2, 0.75 + (dist / 1000) * 1.25);
    const blend = Math.min(1.0, (x - 25) / 35);
    const relX = x - 25;

    let offset = 0;
    offset += Math.sin(relX * 0.038) * 3.4;
    offset += Math.sin(relX * 0.082) * 1.8;
    offset += Math.sin(relX * 0.018) * 4.2;

    if (dist > 80) {
      offset += Math.sin(relX * 0.2) * 0.45;
    }

    return 8.0 + offset * blend * difficultyFactor;
  }

  ensureChunks(minX, maxX) {
    // Generate new chunks ahead
    while (this.chunks.length === 0 || this.chunks[this.chunks.length - 1].startX + this.chunkWidth < maxX) {
      const startX = this.chunks.length === 0 ? -40 : this.chunks[this.chunks.length - 1].startX + this.chunkWidth;
      const chunk = new TerrainChunk(this.nextChunkIndex++, startX, this.chunkWidth, this.pointSpacing, (x) => this.heightFunction(x));
      this.populateChunk(chunk);
      this.chunks.push(chunk);
    }

    // Prune very old chunks far behind (keep at least 150m behind)
    while (this.chunks.length > 2 && this.chunks[0].startX + this.chunkWidth < minX - 120) {
      this.chunks.shift();
    }
  }

  populateChunk(chunk) {
    const endX = chunk.startX + chunk.width;

    // Distance signposts every 100m
    while (this.nextSignDist <= endX) {
      if (this.nextSignDist >= 50) {
        const signX = this.nextSignDist;
        const signY = this.heightFunction(signX);
        chunk.signPosts.push({
          x: signX,
          y: signY,
          distanceText: `${Math.round(this.nextSignDist)}m`
        });
      }
      this.nextSignDist += 100;
    }

    // Fuel cans every ~95m - 120m
    while (this.nextFuelCanDist <= endX) {
      if (this.nextFuelCanDist >= 60) {
        const fuelX = this.nextFuelCanDist;
        const fuelY = this.heightFunction(fuelX) - 0.75;
        chunk.fuelCans.push({
          x: fuelX,
          y: fuelY,
          collected: false,
          radius: 0.65
        });
      }
      this.nextFuelCanDist += 85 + Math.random() * 25;
    }

    // Coin clusters on hill crests and slopes
    for (let x = chunk.startX + 6; x < endX - 6; x += 18 + Math.random() * 12) {
      if (x < 20) continue;
      const pattern = Math.random();
      const numCoins = Math.floor(4 + Math.random() * 5);

      for (let i = 0; i < numCoins; i++) {
        const coinX = x + i * 1.5;
        // Arc coins following hill or floating into the air for jumps
        const groundY = this.heightFunction(coinX);
        const arcY = groundY - 0.8 - Math.sin((i / (numCoins - 1)) * Math.PI) * 1.6;

        let value = 5;
        if (pattern > 0.88) value = 500; // Diamond
        else if (pattern > 0.65) value = 100; // Gold
        else if (pattern > 0.35) value = 25;  // Silver

        chunk.coins.push({
          x: coinX,
          y: arcY,
          value: value,
          collected: false,
          radius: value === 500 ? 0.45 : 0.35
        });
      }
    }
  }

  getHeightAt(worldX) {
    // Find point in loaded chunks
    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c];
      if (worldX >= chunk.startX && worldX <= chunk.startX + chunk.width) {
        const pts = chunk.points;
        const indexFloat = (worldX - chunk.startX) / chunk.pointSpacing;
        const i0 = Math.floor(indexFloat);
        const i1 = Math.min(pts.length - 1, i0 + 1);
        if (i0 >= 0 && i0 < pts.length) {
          const t = indexFloat - i0;
          return pts[i0].y * (1 - t) + pts[i1].y * t;
        }
      }
    }
    // Fallback if beyond loaded chunks
    return this.heightFunction(worldX);
  }

  sampleGroundUnder(worldX, worldY, maxDist = 3.0) {
    const groundY = this.getHeightAt(worldX);
    const hit = (worldY + maxDist >= groundY);

    // Approximate surface normal at worldX
    const delta = 0.5;
    const yLeft = this.getHeightAt(worldX - delta);
    const yRight = this.getHeightAt(worldX + delta);
    const dx = delta * 2;
    const dy = yRight - yLeft;
    const len = Math.hypot(dx, dy) || 1;

    return {
      hit: hit,
      x: worldX,
      y: groundY,
      nx: dy / len,
      ny: -dx / len
    };
  }

  checkPickups(vehicle, onCoin, onFuel) {
    const vPos = vehicle.pos;
    const collectRadius = 1.35;

    for (const chunk of this.chunks) {
      // Check coins
      for (const coin of chunk.coins) {
        if (!coin.collected) {
          const dist = Math.hypot(coin.x - vPos.x, coin.y - vPos.y);
          if (dist < collectRadius + coin.radius) {
            coin.collected = true;
            onCoin(coin);
          }
        }
      }

      // Check fuel cans
      for (const fuel of chunk.fuelCans) {
        if (!fuel.collected) {
          const dist = Math.hypot(fuel.x - vPos.x, fuel.y - vPos.y);
          if (dist < collectRadius + fuel.radius) {
            fuel.collected = true;
            onFuel(fuel);
          }
        }
      }
    }
  }

  reset() {
    this.chunks = [];
    this.nextChunkIndex = 0;
    this.nextFuelCanDist = 95;
    this.nextSignDist = 100;
    this.ensureChunks(0, 300);
  }
}
