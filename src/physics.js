// High-precision 2D Vehicle & Suspension Physics Engine for Hill Climb Racing
// Uses sub-stepped numerical integration with spring-damper struts, tire friction, and ragdoll neck constraint.

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
  clone() { return new Vec2(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  scale(s) { this.x *= s; this.y *= s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y; }
  cross(v) { return this.x * v.y - this.y * v.x; }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  length() { return Math.hypot(this.x, this.y); }
  normalize() {
    const l = this.length();
    if (l > 1e-6) { this.x /= l; this.y /= l; }
    return this;
  }
  rotate(rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = this.x * cos - this.y * sin;
    const ry = this.x * sin + this.y * cos;
    this.x = rx; this.y = ry;
    return this;
  }
}

export class PhysicsWorld {
  constructor() {
    this.gravity = new Vec2(0, 52); // m/s^2 downwards (heavy, planted arcade feel)
    this.scale = 40; // 40 pixels per physics meter
  }

  setGravity(gy) {
    this.gravity.y = gy;
  }
}

export class Wheel {
  constructor(vehicle, localAnchor, radius = 0.44, isDrive = true) {
    this.vehicle = vehicle;
    this.localAnchor = localAnchor; // local offset from chassis COM
    this.worldPos = new Vec2();
    this.vel = new Vec2();
    this.radius = radius; // meters
    this.isDrive = isDrive;

    // Suspension characteristics
    this.restLength = 0.50; // meters
    this.minLength = 0.16;
    this.maxLength = 0.70;
    this.currentLength = this.restLength;
    this.springK = 48000; // N/m (can be upgraded)
    this.damperC = 5500;  // N/(m/s)

    // Wheel spin dynamics
    this.angle = 0;
    this.angularVel = 0;
    this.mass = 20; // kg
    this.inertia = 0.5 * this.mass * this.radius * this.radius;

    // Contact state
    this.isGrounded = false;
    this.contactPoint = new Vec2();
    this.contactNormal = new Vec2(0, -1);
    this.slipRatio = 0;
  }

  updateWorldAnchor() {
    // Transform local anchor to world coordinates
    const ch = this.vehicle;
    const cos = Math.cos(ch.angle);
    const sin = Math.sin(ch.angle);
    const ax = ch.pos.x + (this.localAnchor.x * cos - this.localAnchor.y * sin);
    const ay = ch.pos.y + (this.localAnchor.x * sin + this.localAnchor.y * cos);
    return new Vec2(ax, ay);
  }
}

export class Driver {
  constructor(vehicle) {
    this.vehicle = vehicle;
    this.neckLocalAnchor = new Vec2(0.1, -0.6); // Neck base relative to chassis COM
    this.headPos = new Vec2();
    this.headVel = new Vec2();
    this.headRadius = 0.24; // meters
    this.headMass = 6; // kg
    this.neckLength = 0.32; // distance from neck anchor to head center
    this.headAngle = 0;
    this.isDead = false;
  }

  reset() {
    this.isDead = false;
    const neckWorld = this.getNeckWorldAnchor();
    this.headPos.set(neckWorld.x, neckWorld.y - this.neckLength);
    this.headVel.set(0, 0);
    this.headAngle = this.vehicle.angle;
  }

  getNeckWorldAnchor() {
    const ch = this.vehicle;
    const cos = Math.cos(ch.angle);
    const sin = Math.sin(ch.angle);
    return new Vec2(
      ch.pos.x + (this.neckLocalAnchor.x * cos - this.neckLocalAnchor.y * sin),
      ch.pos.y + (this.neckLocalAnchor.x * sin + this.neckLocalAnchor.y * cos)
    );
  }

  update(dt, world, terrain) {
    if (this.isDead) return;

    const neckWorld = this.getNeckWorldAnchor();

    // Spring connecting head to rest position above neck
    const targetDir = new Vec2(0, -1).rotate(this.vehicle.angle);
    const targetHeadPos = new Vec2(
      neckWorld.x + targetDir.x * this.neckLength,
      neckWorld.y + targetDir.y * this.neckLength
    );

    // Stiff, responsive neck spring connecting head to rest position above neck
    const diff = new Vec2(targetHeadPos.x - this.headPos.x, targetHeadPos.y - this.headPos.y);
    const kNeck = 1200;
    const cNeck = 60;
    const relVel = new Vec2(this.headVel.x - this.vehicle.vel.x, this.headVel.y - this.vehicle.vel.y);

    const fNeckX = diff.x * kNeck - relVel.x * cNeck;
    const fNeckY = diff.y * kNeck - relVel.y * cNeck;

    this.headVel.x += (fNeckX / this.headMass) * dt;
    this.headVel.y += (fNeckY / this.headMass) * dt;

    this.headPos.x += this.headVel.x * dt;
    this.headPos.y += this.headVel.y * dt;

    // Hard mechanical limit: head stays naturally anchored to driver torso
    const dist = Math.hypot(this.headPos.x - targetHeadPos.x, this.headPos.y - targetHeadPos.y);
    if (dist > 0.12) {
      const sc = 0.12 / dist;
      this.headPos.x = targetHeadPos.x + (this.headPos.x - targetHeadPos.x) * sc;
      this.headPos.y = targetHeadPos.y + (this.headPos.y - targetHeadPos.y) * sc;
    }

    this.headAngle = this.vehicle.angle + Math.sin(diff.x * 2) * 0.3;

    // Check collision with ground terrain:
    // In Hill Climb Racing, driver ONLY dies if the vehicle flips upside down and head hits ground
    const groundY = terrain.getHeightAt(this.headPos.x);
    const isOverturned = Math.cos(this.vehicle.angle) < 0.15; // tilted > 81 degrees (upside down / on roof)
    if (isOverturned && (this.headPos.y + this.headRadius >= groundY)) {
      this.isDead = true;
    }
  }
}

export class Vehicle {
  constructor(config = {}) {
    this.name = config.name || 'Hill Climber';
    this.pos = new Vec2(config.startX || 0, config.startY || 0);
    this.vel = new Vec2(0, 0);
    this.angle = 0;
    this.angularVel = 0;

    // Chassis properties
    this.mass = config.mass || 650; // kg
    this.width = config.width || 2.4; // meters
    this.height = config.height || 0.9; // meters
    this.inertia = (1 / 12) * this.mass * (this.width * this.width + this.height * this.height) * 1.5;

    // Wheels: rear and front
    const rAnchor = config.rearAnchor || new Vec2(-0.85, 0.4);
    const fAnchor = config.frontAnchor || new Vec2(0.85, 0.4);
    const wheelRadius = config.wheelRadius || 0.42;

    this.rearWheel = new Wheel(this, rAnchor, wheelRadius, true);
    this.frontWheel = new Wheel(this, fAnchor, wheelRadius, config.is4WD || false);
    this.wheels = [this.rearWheel, this.frontWheel];

    // Driver
    this.driver = new Driver(this);
    this.driver.reset();

    // Motor & Performance stats (can be upgraded)
    this.maxTorque = config.maxTorque || 1400; // Nm
    this.maxMotorSpeed = config.maxMotorSpeed || 85; // rad/s (~60 km/h)
    this.brakeTorque = config.brakeTorque || 8500; // Nm
    this.reverseTorque = config.reverseTorque || 1600; // Nm
    this.tireFriction = config.tireFriction || 1.4;
    this.airControlTorque = config.airControlTorque || 2200; // Nm for mid-air rotation

    // Visual style
    this.color = config.color || '#e63946';
    this.type = config.type || 'jeep'; // 'jeep', 'bike', 'truck'

    // State
    this.throttle = 0; // -1 (brake) to +1 (gas)
    this.fuel = 100; // 0 to 100%
    this.fuelConsumptionRate = 1.3; // % per second base
    this.isCrashed = false;
    this.isOutOfFuel = false;
    this.rpmRatio = 0.1;
  }

  reset(x, y) {
    this.pos.set(x, y);
    this.vel.set(0, 0);
    this.angle = 0;
    this.angularVel = 0;
    this.throttle = 0;
    this.fuel = 100;
    this.isCrashed = false;
    this.isOutOfFuel = false;
    this.rpmRatio = 0.1;

    for (const w of this.wheels) {
      w.currentLength = w.restLength;
      w.vel.set(0, 0);
      w.angle = 0;
      w.angularVel = 0;
      w.isGrounded = false;
      const anchor = w.updateWorldAnchor();
      w.worldPos.set(anchor.x, anchor.y + w.restLength);
    }
    this.driver.reset();
  }

  isAnyWheelGrounded() {
    return this.rearWheel.isGrounded || this.frontWheel.isGrounded;
  }

  step(dt, world, terrain) {
    if (this.isCrashed) {
      this.throttle = 0;
    }

    // Fuel depletion
    if (this.fuel > 0 && !this.isCrashed) {
      const consumption = (this.fuelConsumptionRate + Math.abs(this.throttle) * 2.8) * dt;
      this.fuel = Math.max(0, this.fuel - consumption);
      if (this.fuel <= 0) {
        this.isOutOfFuel = true;
      }
    }

    const effectiveThrottle = (this.isOutOfFuel || this.isCrashed) ? 0 : this.throttle;

    // Calculate RPM ratio for audio & HUD
    const speed = Math.hypot(this.vel.x, this.vel.y);
    const targetRPM = Math.max(0.1, Math.min(1.0, (speed / 20) * 0.7 + Math.abs(effectiveThrottle) * 0.35));
    this.rpmRatio += (targetRPM - this.rpmRatio) * Math.min(1.0, dt * 8);

    // Forces accumulator on chassis
    let totalForce = new Vec2(world.gravity.x * this.mass, world.gravity.y * this.mass);
    let totalTorque = 0;

    // Mid-air stabilization / stunt flip torque:
    // D (Gas / Right) leans vehicle to FRONT part (clockwise)
    // A (Brake / Left) leans vehicle to BACK part (counter-clockwise)
    const isAirborne = !this.isAnyWheelGrounded();
    if (isAirborne && !this.isCrashed) {
      if (effectiveThrottle > 0) {
        // Gas in air: pitch down / lean to front part (clockwise)
        totalTorque += this.airControlTorque * effectiveThrottle;
      } else if (effectiveThrottle < 0) {
        // Brake in air: pitch up / lean to back part (counter-clockwise)
        totalTorque += this.airControlTorque * effectiveThrottle; // since throttle is negative, this adds negative counter-clockwise torque
      }
    }

    // Aerodynamic drag
    const airDrag = 0.45;
    totalForce.x -= 0.5 * airDrag * this.vel.x * Math.abs(this.vel.x);
    totalForce.y -= 0.5 * airDrag * this.vel.y * Math.abs(this.vel.y);
    totalTorque -= 1.5 * this.angularVel * Math.abs(this.angularVel);

    // Controlled downforce (keeps tires planted on crests without overpowering front suspension)
    if (!this.isCrashed && this.isAnyWheelGrounded()) {
      const forwardSpeed = Math.max(0, this.vel.x);
      const downforceMag = Math.min(this.mass * 4.5, forwardSpeed * 45);
      totalForce.y += downforceMag;
    }

    // Process each wheel and its suspension
    for (const wheel of this.wheels) {
      const anchorWorld = wheel.updateWorldAnchor();

      // Suspension vector points downwards along local chassis orientation
      const suspDir = new Vec2(0, 1).rotate(this.angle);

      // Calculate anchor velocity = chassis vel + omega x r
      const rx = anchorWorld.x - this.pos.x;
      const ry = anchorWorld.y - this.pos.y;
      const anchorVel = new Vec2(
        this.vel.x - this.angularVel * ry,
        this.vel.y + this.angularVel * rx
      );

      // Only check ground if suspension is facing downwards towards ground
      const isFacingGround = suspDir.y > 0.15;
      
      // 1-step refinement to sample ground directly under where the wheel contacts slopes
      let xRefined = anchorWorld.x + suspDir.x * wheel.restLength;
      let groundY = terrain.getHeightAt(xRefined);

      wheel.isGrounded = false;

      if (isFacingGround) {
        let toGroundY = groundY - anchorWorld.y;
        let distAlongSusp = toGroundY / Math.max(0.15, suspDir.y);
        const maxDist = wheel.maxLength + wheel.radius;

        // Ground contact active whenever ground is reachable
        if (distAlongSusp <= maxDist) {
          let targetLength = Math.max(wheel.minLength, Math.min(wheel.maxLength, distAlongSusp - wheel.radius));

          // Refine along actual compressed angle
          xRefined = anchorWorld.x + suspDir.x * targetLength;
          groundY = terrain.getHeightAt(xRefined);
          toGroundY = groundY - anchorWorld.y;
          distAlongSusp = toGroundY / Math.max(0.15, suspDir.y);
          targetLength = Math.max(wheel.minLength, Math.min(wheel.maxLength, distAlongSusp - wheel.radius));

          const compression = wheel.restLength - targetLength;
          // Bump-stop overload if anchor penetrates beyond minLength + radius
          const bumpOverload = Math.max(0, (wheel.minLength + wheel.radius) - distAlongSusp);

          wheel.isGrounded = true;
          wheel.currentLength = targetLength;
          wheel.worldPos.set(anchorWorld.x + suspDir.x * targetLength, anchorWorld.y + suspDir.y * targetLength);

          const groundInfo = terrain.sampleGroundUnder(wheel.worldPos.x, wheel.worldPos.y);
          wheel.contactPoint.set(groundInfo.x, groundInfo.y);
          wheel.contactNormal.set(groundInfo.nx, groundInfo.ny);

          // Suspension Spring-Damper Force (progressive bump-stop resistance)
          const suspVel = anchorVel.dot(suspDir);
          const bumpStopK = 140000;
          const springForceMag = Math.max(0, wheel.springK * compression + wheel.damperC * suspVel + bumpOverload * bumpStopK);

          const suspForce = new Vec2(-suspDir.x * springForceMag, -suspDir.y * springForceMag);
          totalForce.add(suspForce);
          totalTorque += rx * suspForce.y - ry * suspForce.x;

          // Ground contact normal & forward tangent
          const normal = wheel.contactNormal;
          const tangent = new Vec2(-normal.y, normal.x); // Forward along ground (+X)

          // Wheel contact point velocity
          wheel.vel.copy(anchorVel);
          const wheelLinearSpeedAtPatch = wheel.angularVel * wheel.radius;
          const groundPatchVel = anchorVel.dot(tangent);
          const slipVelocity = groundPatchVel - wheelLinearSpeedAtPatch;
          wheel.slipRatio = slipVelocity;

          // Incline angle of vehicle: > 0 uphill, < 0 downhill
          const incline = -Math.sin(this.angle);

          // Traction friction force (augmented on uphill inclines to prevent tire spinout)
          const slopeGripBonus = 1.0 + Math.max(0, incline) * 0.45;
          const normalLoad = springForceMag + (wheel.mass * world.gravity.y * 0.5);
          const maxFriction = Math.max(0, normalLoad * this.tireFriction * slopeGripBonus);
          const frictionForceMag = Math.max(-maxFriction, Math.min(maxFriction, -slipVelocity * 1100));

          const frictionForce = new Vec2(tangent.x * frictionForceMag, tangent.y * frictionForceMag);
          totalForce.add(frictionForce);

          // Balanced torque arm on chassis: prevents forward pitch bias / endo flips during braking
          const ryArm = effectiveThrottle < 0 ? 0.05 : 0.45;
          totalTorque += rx * frictionForce.y - (ry * ryArm) * frictionForce.x;

          // Reaction torque on wheel spin
          const wheelReactionTorque = -frictionForceMag * wheel.radius;
          let wheelTorque = wheelReactionTorque;

          // Braking & Drive Motor with Incline Adaptation
          if (!this.isCrashed && !this.isOutOfFuel) {
            if (effectiveThrottle > 0) {
              // UPHILL CLIMB POWER: Low-range crawling gear boosts climb torque on steep inclines
              const climbTorqueBoost = 1.0 + Math.max(0, incline) * 3.5;
              const currentMotorTorque = this.maxTorque * climbTorqueBoost;
              // On steep hills (>12 deg), all wheels provide climbing crawl traction
              const canDrive = wheel.isDrive || (incline > 0.2);

              if (canDrive && wheel.angularVel < this.maxMotorSpeed) {
                wheelTorque += currentMotorTorque * effectiveThrottle;
              }
            } else if (effectiveThrottle < 0) {
              // ACTIVE BRAKE vs REVERSE
              const isMovingForward = this.vel.x > 0.35 || wheel.angularVel > 0.35;
              if (isMovingForward) {
                // ACTIVE 4-WHEEL DISC BRAKING: clamp wheel angular velocity towards 0
                const brakeTargetTorque = Math.min(this.brakeTorque, (Math.max(0, wheel.angularVel) * wheel.inertia) / dt + 2500);
                wheelTorque -= brakeTargetTorque;

                // DOWNHILL BRAKE AUTHORITY: powerful braking force opposing forward velocity vector
                const speed = Math.hypot(this.vel.x, this.vel.y);
                if (speed > 0.3) {
                  const downhillBrakeBoost = 1.0 + Math.max(0, -incline) * 2.5;
                  const chassisBrakeForce = Math.min(maxFriction * 1.2, this.mass * 35 * downhillBrakeBoost);
                  totalForce.x -= (this.vel.x / speed) * chassisBrakeForce * 0.5;
                  totalForce.y -= (this.vel.y / speed) * chassisBrakeForce * 0.5;
                }
              } else {
                // FULL STOPPED OR REVERSING: drive in reverse smoothly
                if (wheel.isDrive && wheel.angularVel > -this.maxMotorSpeed * 0.55) {
                  wheelTorque -= this.reverseTorque * Math.abs(effectiveThrottle);
                }
              }
            } else {
              // IDLE / COASTING: Natural wheel roll resistance
              const rollResistTorque = 900;
              if (wheel.angularVel > 0.3) {
                wheelTorque -= rollResistTorque;
              } else if (wheel.angularVel < -0.3) {
                wheelTorque += rollResistTorque;
              }
            }
          }

          // Spin integration
          wheel.angularVel += (wheelTorque / wheel.inertia) * dt;
        }
      }

      if (!wheel.isGrounded) {
        // Free suspension relaxation back to rest length
        wheel.currentLength += (wheel.restLength - wheel.currentLength) * Math.min(1.0, dt * 15);
        wheel.worldPos.set(anchorWorld.x + suspDir.x * wheel.currentLength, anchorWorld.y + suspDir.y * wheel.currentLength);

        // Spin in air freely or spin up with throttle
        if (wheel.isDrive && !this.isCrashed && !this.isOutOfFuel) {
          if (effectiveThrottle > 0) {
            wheel.angularVel += (this.maxTorque * 0.3 / wheel.inertia) * dt;
          } else if (effectiveThrottle < 0) {
            wheel.angularVel += (this.brakeTorque * 0.3 * effectiveThrottle / wheel.inertia) * dt;
          }
        }
        // Rolling air resistance on spin
        wheel.angularVel *= Math.max(0, 1 - 0.5 * dt);
      }

      wheel.angularVel = Math.max(-120, Math.min(120, wheel.angularVel));
      wheel.angle += wheel.angularVel * dt;
    }

    // Chassis pitch stabilization when any wheel is grounded (prevents forward flips/nosedives & rear flipouts)
    if (this.isAnyWheelGrounded() && !this.isCrashed) {
      const gRearY = terrain.getHeightAt(this.pos.x - 0.85);
      const gFrontY = terrain.getHeightAt(this.pos.x + 0.85);
      const groundSlopeAngle = Math.atan2(gFrontY - gRearY, 1.7);
      const angleDiff = this.angle - groundSlopeAngle;
      const restoreStrength = effectiveThrottle < 0 ? 38000 : 26000;
      const dampingStrength = effectiveThrottle < 0 ? 2400 : 1800;
      // Stable leveling restoring torque keeps chassis aligned with terrain slope
      totalTorque -= angleDiff * restoreStrength + this.angularVel * dampingStrength;
    }

    // Chassis linear integration (Newton-Euler)
    const accelX = totalForce.x / this.mass;
    const accelY = totalForce.y / this.mass;

    this.vel.x += accelX * dt;
    this.vel.y += accelY * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // Active downhill retarding & engine compression when coasting
    if (effectiveThrottle === 0 && this.isAnyWheelGrounded() && !this.isCrashed) {
      const incline = -Math.sin(this.angle);
      const speed = Math.hypot(this.vel.x, this.vel.y);
      if (speed > 0.25) {
        const downhillRetard = Math.max(0, -incline) * 6.0 * dt;
        const coastDecel = (3.5 * dt) + downhillRetard;
        const decelFactor = Math.max(0, 1 - coastDecel / speed);
        this.vel.x *= decelFactor;
        this.vel.y *= decelFactor;
      } else if (speed > 0) {
        this.vel.x *= Math.max(0, 1 - 8 * dt);
        this.vel.y *= Math.max(0, 1 - 8 * dt);
      }
    }

    // Safety guards against non-finite values
    if (!Number.isFinite(this.vel.x) || !Number.isFinite(this.vel.y)) {
      this.vel.set(0, 0);
    }
    if (!Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.y)) {
      this.pos.set(5, 7);
    }
    if (!Number.isFinite(this.angle) || !Number.isFinite(this.angularVel)) {
      this.angle = 0;
      this.angularVel = 0;
    }

    // Chassis angular integration
    const angularAccel = totalTorque / this.inertia;
    this.angularVel += angularAccel * dt;
    this.angle += this.angularVel * dt;

    // Multi-point chassis collision with terrain (bumpers, belly, roof)
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);

    const corners = [
      { x: this.width * 0.45, y: this.height * 0.25, isRoof: false },
      { x: -this.width * 0.45, y: this.height * 0.25, isRoof: false },
      { x: 0, y: this.height * 0.3, isRoof: false },
      { x: this.width * 0.35, y: -this.height * 0.55, isRoof: true },
      { x: -this.width * 0.35, y: -this.height * 0.55, isRoof: true }
    ];

    for (const c of corners) {
      const cx = this.pos.x + (c.x * cosA - c.y * sinA);
      const cy = this.pos.y + (c.x * sinA + c.y * cosA);
      const gY = terrain.getHeightAt(cx);

      if (cy > gY) {
        const penetration = cy - gY;
        this.pos.y -= penetration * 0.5;
        if (this.vel.y > 0) this.vel.y *= -0.15;

        // Skid plate normal load & upward anti-nosedive torque
        const normalLoad = penetration * 20000;
        if (!c.isRoof) {
          const armX = c.x * cosA - c.y * sinA;
          totalTorque -= armX * normalLoad * dt * 15;
        }

        const maxFriction = normalLoad * 0.35;
        const frictionForce = Math.min(maxFriction, Math.abs(this.vel.x) * this.mass * 8) * dt;
        if (this.vel.x > 0) this.vel.x = Math.max(0, this.vel.x - frictionForce / this.mass);
        else if (this.vel.x < 0) this.vel.x = Math.min(0, this.vel.x + frictionForce / this.mass);
        this.angularVel *= Math.max(0.5, 1 - 4 * dt);

        if (c.isRoof) {
          const isOverturned = Math.cos(this.angle) < 0.15;
          if (isOverturned) {
            this.driver.isDead = true;
            this.isCrashed = true;
          }
        }
      }
    }

    // Driver update & collision
    this.driver.update(dt, world, terrain);
    if (this.driver.isDead) {
      this.isCrashed = true;
    }
  }

  vehicleAngle(a) {
    return a;
  }
}
