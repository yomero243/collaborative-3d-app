# 🏒 Collaborative 3D Air Hockey

[![Three.js](https://img.shields.io/badge/Three.js-r180+-black?style=flat-square&logo=threedotjs)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/R3F-React_Three_Fiber-61DAFB?style=flat-square&logo=react&logoColor=black)](https://docs.pmnd.rs/react-three-fiber)
[![Yjs](https://img.shields.io/badge/Yjs-CRDT-FF6B35?style=flat-square)](https://yjs.dev/)
[![WebSockets](https://img.shields.io/badge/WebSockets-Real--time-4285F4?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```
╔═══════════════════════════════════════════════════════╗
║          A I R   H O C K E Y   3 D                   ║
║          Real-time multiplayer in the browser         ║
║                                                       ║
║   [Player 1] ←───── WebSocket ─────→ [Player 2]      ║
║       │              Yjs CRDT              │          ║
║    Three.js                            Three.js       ║
║    Physics                             Physics        ║
╚═══════════════════════════════════════════════════════╝
```

> A real-time multiplayer **3D Air Hockey** game running entirely in the browser. Built with React Three Fiber, a custom Verlet physics engine, and Yjs CRDT for conflict-free state synchronization — no game server required beyond the WebSocket signaling layer.

---

## 🚀 Features

- 🎮 **Real-time Multiplayer** — low-latency synchronization via WebSockets + Yjs CRDT
- 🎱 **Custom Physics Engine** — Verlet integration with elastic collisions and Magnus spin effect
- 🖥️ **Immersive 3D Visuals** — Three.js + React Three Fiber for a futuristic arena aesthetic
- 🖱️ **Mouse/Touch Controls** — drag your mallet across the table; works on desktop and mobile
- 🐛 **Debug Tools** — toggleable trajectory prediction, hitbox visualization, and debug panel
- 🌐 **Zero Game Server** — state is distributed via CRDTs; only a lightweight WebSocket relay is needed

---

## 🏗️ Architecture

```
┌─────────────┐     WebSocket      ┌─────────────────────┐
│   Client A  │◄──────────────────►│  y-websocket server │
│  (Player 1) │                    │  (port 1234)        │
└──────┬──────┘                    └──────────┬──────────┘
       │                                      │
       │  Yjs Doc (CRDT)                      │  Yjs Doc (CRDT)
       │  ┌─────────────────────┐             │
       │  │ Y.Map: puck         │             │
       │  │ Y.Map: player1Mallet│             │
       │  │ Y.Map: player2Mallet│             │
       │  │ Y.Map: score        │             │
       │  └─────────────────────┘             │
       │                                      │
       ▼                                ┌─────┴──────┐
┌─────────────┐                         │  Client B  │
│ Three.js /  │                         │ (Player 2) │
│ R3F Scene   │                         └────────────┘
│ useFrame()  │
│ Physics tick│
└─────────────┘
```

**Data flow:** Each client runs the physics simulation locally. The **puck position and mallet positions** are synced via Yjs shared maps over WebSocket. Yjs handles merge conflicts automatically via CRDT semantics — no custom conflict resolution needed.

---

## ⚙️ Physics Engine

The physics simulation runs on a **fixed-timestep Verlet integration loop** inside `useFrame`:

### Verlet Integration
```
position_next = position + (position - position_prev) + acceleration * dt²
```
Verlet is chosen over Euler for its superior energy conservation — the puck doesn't lose speed artificially on longer frames.

### Elastic Collisions
Puck-to-mallet and puck-to-wall collisions are resolved with restitution coefficient `e = 1.0` (perfectly elastic), preserving kinetic energy and reflecting the velocity vector correctly.

### Magnus Effect (Spin)
When a mallet strikes the puck off-center, angular velocity is imparted. The **Magnus force** is then applied each tick:

```
F_magnus = ω × v_puck * magnus_coefficient
```

This causes curved trajectories after spin shots — the same physics that makes real air hockey skill-based.

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| 3D Rendering | Three.js + React Three Fiber |
| State Sync | Yjs (CRDT) + y-websocket |
| Frontend | React 19 + Vite |
| Physics | Custom Verlet engine |
| Styling | CSS Modules |

---

## 📋 Prerequisites

- Node.js 16+
- npm

---

## 🔧 Installation & Running

```bash
git clone https://github.com/yomero243/collaborative-3d-app.git
cd collaborative-3d-app
npm install
npm start
```

This starts both:
- **WebSocket server** on `ws://localhost:1234`
- **Vite dev client** on `http://localhost:5173`

Open two browser tabs (or two machines on the same network) to play.

> To run only the client: `npm run dev` (requires an external WebSocket relay)

---

## 🎮 Controls

| Input | Action |
|---|---|
| Mouse drag / Touch | Move mallet |
| `P` | Toggle trajectory prediction |
| `D` | Toggle debug panel |
| `H` | Toggle hitbox visualization |

---

## 👨‍💻 About

Built by **Gabriel** — Creative 3D Developer specializing in real-time multiplayer experiences, physics simulations, and WebGL/WebGPU rendering.

> 💼 **Available for freelance projects** — multiplayer 3D apps, interactive web experiences, real-time collaboration tools, WebGL/WebGPU, and creative coding. [Let's connect →](https://github.com/yomero243)
