# Hill Climb Racing (HTML5 Canvas & Physics Engine)

**Design & Development: Mukund Kumar**
Git clone - https://github.com/shivam-jha-89/Hill-Climber-Extreme

live Demo - https://hill-climber-extreme.vercel.app/

A classic 2D physics-based arcade hill climbing racing game built from scratch using pure vanilla JavaScript and HTML5 Canvas. Experience responsive driving physics, vehicle upgrades, diverse stages, and mid-air balance controls.

---

## 🎮 Features

- **Custom 2D Vehicle Physics Engine**:
  - Dual-wheel ray/spring-damper suspension modeling.
  - Multi-contact chassis collision with terrain surface normals.
  - Articulated driver ragdoll with realistic neck-spring mechanics and head-impact detection.
  - Mid-air balance authority: tilt forward/down with **Gas** (`D` / `►`) and tilt backward/up with **Brake** (`A` / `◄`).
  - Active braking system with velocity opposition and steep incline traction adaptation.

- **4 Unique Stages**:
  - 🌲 **Countryside**: Rolling gentle green hills and starter jumps.
  - 🏜️ **Desert**: Steep sandy dunes and sandstone ridge crests.
  - 🌕 **Moon**: Low lunar gravity with floaty, high-flying airtime.
  - 🏔️ **Mountain Peaks**: Treacherous rocky ridges, steep launch kickers, camel humps, and deep ravines requiring mid-air balance to avoid crashing.

- **3 Distinct Playable Vehicles**:
  - 🚙 **Hill Climber (Jeep)**: Balanced starter 4x4.
  - 🏍️ **Motocross Bike**: Agile, lightweight, rapid mid-air rotation, but sensitive driver balance.
  - 🛻 **Monster Truck**: High ground clearance, giant bouncy wheels, and massive torque.

- **Bill's Garage Workshop & Upgrades**:
  - ⚡ **Engine**: Boosts acceleration, maximum torque, and top motor speed.
  - 🪓 **Suspension**: Enhances spring travel and shock dampening over bumpy terrain.
  - 🛞 **Tires**: Improves friction grip across steep hill inclines.
  - ⚙️ **4WD / Stability**: Distributes power across all wheels and enhances mid-air stability.

- **Stunt System & Dynamic HUD**:
  - Real-time Air Time rewards and 360° flip detection (**Backflips** and **Frontflips** with coin bonuses).
  - Analog speedometer and RPM tachometer gauges.
  - Fuel consumption gauge with scattered fuel canister pickups.
  - Instant Polaroid crash snapshot with distance, score, and retry overlay.

- **Web Audio FX**:
  - Procedural Web Audio API sound effects for engine acceleration, gear shifts, coin pickups, suspension bounces, and crashes (no external audio assets required).

---

## 🕹️ Controls

| Action | Keyboard | Touch / On-Screen |
| :--- | :--- | :--- |
| **Accelerate / Drive Forward** | `D` or `ArrowRight` | **GAS** button |
| **Brake / Reverse** | `A` or `ArrowLeft` | **BRAKE** button |
| **Air Control: Lean Forward / Nose Down** | `D` or `ArrowRight` (in air) | **GAS** button |
| **Air Control: Lean Backward / Nose Up** | `A` or `ArrowLeft` (in air) | **BRAKE** button |
| **Pause / Resume** | `Escape` or `P` | **PAUSE** button |

---

## 🚀 Getting Started

No build tools or package managers required. Simply serve the directory with any standard HTTP server:

```bash
# Using Python 3
python3 -m http.server 8080

# Or using Node http-server / npx serve
npx serve .
```

Open `http://localhost:8080` in any modern web browser.

---

## 📁 Project Structure

```
├── index.html       # Game container, arcade HUD, modals, and pedal overlays
├── style.css        # Responsive styling, arcade neon theme, and retro typography
├── .gitignore       # Git ignore rules for system artifacts
├── README.md        # Project overview and documentation
└── src/
    ├── audio.js     # Web Audio API synthesizer for engine and sound FX
    ├── game.js      # Main game loop, camera, parallax background, stunt tracker, and HUD
    ├── garage.js    # Economy manager, vehicle upgrades, and localStorage persistence
    ├── particles.js # Smoke, dirt, spark, and exhaust particle systems
    ├── physics.js   # 2D rigid-body vehicle dynamics, suspension, and ragdoll driver
    ├── terrain.js   # Procedural infinite spline terrain generation and biome themes
    └── vehicle.js   # Vehicle catalog configurations, stats, and upgrade scalers
```

---

## 📜 License

MIT License. Free to use and modify for learning and entertainment.
