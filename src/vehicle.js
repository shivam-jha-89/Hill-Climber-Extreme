// Vehicle Definitions, Upgrades, and Vector Renderers for Hill Climb Racing

import { Vec2 } from './physics.js';

export const VEHICLE_CATALOG = {
  jeep: {
    id: 'jeep',
    name: 'Hill Climber',
    description: 'The iconic classic red 4x4. Balanced, forgiving, and great for all terrains.',
    price: 0, // Starter vehicle
    mass: 600,
    width: 2.3,
    height: 1.0,
    wheelRadius: 0.44,
    rearAnchor: new Vec2(-0.85, 0.25),
    frontAnchor: new Vec2(0.85, 0.25),
    color: '#e63946',
    accentColor: '#1d3557',
    maxTorque: 2400,
    maxMotorSpeed: 80,
    brakeTorque: 18000,
    reverseTorque: 2000,
    tireFriction: 1.4,
    airControlTorque: 2200,
    fuelTank: 100,
    fuelConsumptionRate: 1.25,
    is4WD: false
  },
  bike: {
    id: 'bike',
    name: 'Motocross Bike',
    description: 'Ultra-light, agile, and flips effortlessly. Watch out for the driver neck!',
    price: 7500,
    mass: 220,
    width: 1.9,
    height: 0.85,
    wheelRadius: 0.38,
    rearAnchor: new Vec2(-0.75, 0.22),
    frontAnchor: new Vec2(0.75, 0.22),
    color: '#3a86ff',
    accentColor: '#ffbe0b',
    maxTorque: 1900,
    maxMotorSpeed: 105,
    brakeTorque: 15000,
    reverseTorque: 1600,
    tireFriction: 1.5,
    airControlTorque: 2600,
    fuelTank: 100,
    fuelConsumptionRate: 1.45,
    is4WD: false
  },
  truck: {
    id: 'truck',
    name: 'Monster Truck',
    description: 'Giant bouncy wheels with immense torque and 4WD. Crushes impossible hills.',
    price: 18000,
    mass: 980,
    width: 2.8,
    height: 1.2,
    wheelRadius: 0.62,
    rearAnchor: new Vec2(-1.05, 0.28),
    frontAnchor: new Vec2(1.05, 0.28),
    color: '#2a9d8f',
    accentColor: '#e76f51',
    maxTorque: 4200,
    maxMotorSpeed: 75,
    brakeTorque: 26000,
    reverseTorque: 2800,
    tireFriction: 1.65,
    airControlTorque: 2400,
    fuelTank: 100,
    fuelConsumptionRate: 1.6,
    is4WD: true
  }
};

export const UPGRADE_CONFIG = {
  engine: {
    name: 'Engine',
    desc: 'Increases climb torque and top speed',
    maxLevel: 10,
    baseCost: 350,
    costMult: 1.65
  },
  suspension: {
    name: 'Suspension',
    desc: 'Softens impacts and keeps wheels grounded',
    maxLevel: 10,
    baseCost: 300,
    costMult: 1.6
  },
  tires: {
    name: 'Tires',
    desc: 'Enhances traction on steep inclines',
    maxLevel: 10,
    baseCost: 400,
    costMult: 1.7
  },
  fourWD: {
    name: '4WD / Air Control',
    desc: 'Increases all-wheel power and flip stability',
    maxLevel: 10,
    baseCost: 500,
    costMult: 1.75
  }
};

export function applyUpgradesToVehicle(vehicle, baseConfig, upgrades) {
  const engineLvl = upgrades.engine || 0;
  const suspLvl = upgrades.suspension || 0;
  const tiresLvl = upgrades.tires || 0;
  const fourWDLvl = upgrades.fourWD || 0;

  // Torque & Speed scaling
  vehicle.maxTorque = baseConfig.maxTorque * (1 + engineLvl * 0.08);
  vehicle.maxMotorSpeed = baseConfig.maxMotorSpeed * (1 + engineLvl * 0.05);

  // Suspension stiffness & damping tuning
  const baseK = 48000;
  const baseC = 5500;
  for (const w of vehicle.wheels) {
    w.springK = baseK * (1 + suspLvl * 0.07);
    w.damperC = baseC * (1 + suspLvl * 0.09);
  }

  // Tire friction
  vehicle.tireFriction = baseConfig.tireFriction * (1 + tiresLvl * 0.085);

  // 4WD & Air Control
  vehicle.airControlTorque = baseConfig.airControlTorque * (1 + fourWDLvl * 0.12);
  if (baseConfig.is4WD || fourWDLvl > 2) {
    vehicle.frontWheel.isDrive = true;
  }
}

// Vehicle Renderer (Canvas 2D)
export function renderVehicle(ctx, vehicle, scale) {
  const chX = vehicle.pos.x * scale;
  const chY = vehicle.pos.y * scale;

  ctx.save();
  ctx.translate(chX, chY);
  ctx.rotate(vehicle.angle);

  // Render vehicle body
  if (vehicle.type === 'bike') {
    renderBikeChassis(ctx, vehicle, scale);
  } else if (vehicle.type === 'truck') {
    renderTruckChassis(ctx, vehicle, scale);
  } else {
    renderJeepChassis(ctx, vehicle, scale);
  }

  // Render Driver Body & Torso inside vehicle
  renderDriverTorso(ctx, vehicle, scale);

  ctx.restore();

  // Render Suspension Struts & Wheels in world coordinates
  renderSuspensionAndWheels(ctx, vehicle, scale);

  // Render Driver Head & Helmet
  renderDriverHead(ctx, vehicle, scale);
}

function renderJeepChassis(ctx, vehicle, scale) {
  const w = vehicle.width * scale;
  const h = vehicle.height * scale;

  // Main red tub
  ctx.fillStyle = vehicle.color;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(-w * 0.48, -h * 0.35, w * 0.96, h * 0.7, 10);
  ctx.fill();
  ctx.stroke();

  // Hood & Grill
  ctx.fillStyle = '#b71c1c';
  ctx.beginPath();
  ctx.rect(w * 0.22, -h * 0.3, w * 0.26, h * 0.6);
  ctx.fill();
  ctx.stroke();

  // Headlight
  ctx.fillStyle = '#ffea00';
  ctx.beginPath();
  ctx.arc(w * 0.48, -h * 0.1, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Roll cage (black tubes)
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Rear bar
  ctx.moveTo(-w * 0.35, -h * 0.35);
  ctx.lineTo(-w * 0.35, -h * 0.85);
  // Roof bar
  ctx.lineTo(w * 0.05, -h * 0.85);
  // Windshield pillar
  ctx.lineTo(w * 0.22, -h * 0.35);
  ctx.stroke();

  // Spare wheel on back
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-w * 0.5, -h * 0.15, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Steering wheel
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.15, -h * 0.38);
  ctx.lineTo(w * 0.1, -h * 0.55);
  ctx.stroke();
}

function renderBikeChassis(ctx, vehicle, scale) {
  const w = vehicle.width * scale;
  const h = vehicle.height * scale;

  ctx.strokeStyle = vehicle.color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Frame triangles
  ctx.beginPath();
  ctx.moveTo(-w * 0.35, h * 0.1);
  ctx.lineTo(0, -h * 0.35); // tank
  ctx.lineTo(w * 0.35, -h * 0.55); // handle stem
  ctx.lineTo(w * 0.1, h * 0.15); // bottom engine
  ctx.closePath();
  ctx.stroke();

  // Gas tank
  ctx.fillStyle = vehicle.color;
  ctx.beginPath();
  ctx.ellipse(-w * 0.05, -h * 0.35, w * 0.2, h * 0.22, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Seat
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(-w * 0.38, -h * 0.42, w * 0.25, 12, 5);
  ctx.fill();

  // Handlebars
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, -h * 0.5);
  ctx.lineTo(w * 0.25, -h * 0.72);
  ctx.lineTo(w * 0.22, -h * 0.75);
  ctx.stroke();

  // Exhaust pipe
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.1);
  ctx.lineTo(-w * 0.35, h * 0.05);
  ctx.lineTo(-w * 0.45, -h * 0.1);
  ctx.stroke();
}

function renderTruckChassis(ctx, vehicle, scale) {
  const w = vehicle.width * scale;
  const h = vehicle.height * scale;

  ctx.fillStyle = vehicle.color;
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 4;

  // Giant cab
  ctx.beginPath();
  ctx.roundRect(-w * 0.45, -h * 0.4, w * 0.9, h * 0.7, 12);
  ctx.fill();
  ctx.stroke();

  // Cabin roof
  ctx.fillStyle = '#e76f51';
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.4);
  ctx.lineTo(-w * 0.25, -h * 0.85);
  ctx.lineTo(w * 0.1, -h * 0.85);
  ctx.lineTo(w * 0.25, -h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Giant chrome bumper
  ctx.fillStyle = '#ddd';
  ctx.fillRect(w * 0.42, -h * 0.15, 14, 25);
  ctx.strokeRect(w * 0.42, -h * 0.15, 14, 25);

  // Roof lights
  ctx.fillStyle = '#ffb703';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(-w * 0.18 + i * 14, -h * 0.9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function renderDriverTorso(ctx, vehicle, scale) {
  const w = vehicle.width * scale;
  const h = vehicle.height * scale;

  // Blue driver jacket
  ctx.fillStyle = '#1d3557';
  ctx.beginPath();
  ctx.ellipse(-w * 0.05, -h * 0.52, 14, 18, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Driver arm reaching forward
  ctx.strokeStyle = '#1d3557';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, -h * 0.55);
  ctx.lineTo(w * 0.1, -h * 0.48);
  ctx.stroke();
}

function renderSuspensionAndWheels(ctx, vehicle, scale) {
  for (const wheel of vehicle.wheels) {
    const anchor = wheel.updateWorldAnchor();
    const ax = anchor.x * scale;
    const ay = anchor.y * scale;
    const wx = wheel.worldPos.x * scale;
    const wy = wheel.worldPos.y * scale;

    // Draw suspension shock strut (spring coil)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(wx, wy);
    ctx.stroke();

    // Spring details
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 3;
    const segments = 6;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const px = ax + (wx - ax) * t;
      const py = ay + (wy - ay) * t;
      const side = (i % 2 === 0 ? 1 : -1) * 7;
      ctx.lineTo(px + side, py);
    }
    ctx.lineTo(wx, wy);
    ctx.stroke();

    // Draw Wheel
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wheel.angle);

    const r = wheel.radius * scale;

    // Tire rubber
    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Knobby tire treads
    ctx.fillStyle = '#333';
    const numTreads = 12;
    for (let i = 0; i < numTreads; i++) {
      const angle = (i / numTreads) * Math.PI * 2;
      const tx = Math.cos(angle) * (r - 3);
      const ty = Math.sin(angle) * (r - 3);
      ctx.fillRect(tx - 3, ty - 3, 6, 6);
    }

    // Rim
    ctx.fillStyle = '#bbb';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rim spokes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const spokeAngle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(spokeAngle) * r * 0.5, Math.sin(spokeAngle) * r * 0.5);
      ctx.stroke();
    }

    // Center hub cap
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function renderDriverHead(ctx, vehicle, scale) {
  const driver = vehicle.driver;
  const hx = driver.headPos.x * scale;
  const hy = driver.headPos.y * scale;
  const r = driver.headRadius * scale;

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(driver.headAngle);

  // Helmet shell
  ctx.fillStyle = driver.isDead ? '#666' : '#f4a261';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Helmet visor (glass reflection)
  ctx.fillStyle = driver.isDead ? '#333' : '#1d3557';
  ctx.beginPath();
  ctx.arc(r * 0.25, -r * 0.1, r * 0.5, -0.6, 0.8);
  ctx.fill();

  // Visor highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(r * 0.3, -r * 0.15, r * 0.35, -0.4, 0.2);
  ctx.stroke();

  ctx.restore();
}
