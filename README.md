# 🐸 Zapitos Arcade ⚡

[![Hackathon](https://img.shields.io/badge/La_Crypta-Gaming_Hackathon_%2304-brightgreen?style=press-start-2p&logo=bitcoin)](https://lacrypta.dev/hackathons/zaps)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Zapitos Arcade** is an 8-bit retro-styled gaming platform where players can bet and win Satoshis (Bitcoin via Lightning Network) and log in using their Nostr identity. Built as a entry for **La Crypta Dev's Hackatón #04 (GAMING)** in June 2026.

[Español abajo 🇪🇸](#español)

---

## 🎮 The Games

Zapitos features 4 frog-themed mini-games—two single-player and two real-time multiplayer:

### 1. 🏺 Lucky Amphoras (*Ánforas de la Suerte*) - Single Player
Climb a 10-row grid of amphoras. 
*   **Rows 1-5:** 2 safe paths, 1 trap (66.6% success rate).
*   **Rows 6-10:** The odds flip! 1 safe path, 2 traps (33.3% success rate).
*   Risk your stake to reach the top. Maximum payout is capped at **2.0x** (double your bet) at Row 10 to ensure a balanced game economy. Cash out at any row!

### 2. 🪰 Fly Catcher (*Atrapa-Moscas*) - Single Player
An interactive HTML5 Canvas arcade shooter.
*   Every tap shoots the frog's tongue at insects and costs **1 sat** from your active pool.
*   Eat flies to recover and win: Common Fly (`🪰` = +2 sats), Mosquito (`🦟` = +3 sats), Gold Beetle (`🪲` = +5 sats).
*   Avoid toxic Bees (`🐝` = -5 sats). Cash out your pool at any time before running out of shots!

### 3. 👥 Fly Feast (*Charco Rápido*) - Multiplayer
Real-time synchronized PvP fly-catching arena.
*   Pay a 10-sat entrance fee to join the lobby.
*   When 2-4 players join, flies spawn across the swamp.
*   The first player to click the fly catches it. The player with the most flies at the end of 10 rounds wins the **100% of the lobby's pool**!

### 4. 🏁 Frog Race (*Carrera de Sapitos*) - Multiplayer
A rhythm-tapping race to the finish line.
*   Pay the entrance fee and compete in parallel water lanes.
*   Click the "JUMP" button (or press Space) when the oscillating indicator hits the green target zone.
*   Your progress is synchronized in real-time. The first frog to cross the finish line wins the entire pool.

> [!NOTE]
> **Offline Bot Sandbox:** If the WebSocket server is down or you are playing on a serverless deploy (e.g. Vercel) without a dedicated backend, both multiplayer games will automatically enable an **AI Bot mode**. Simulated AI frogs will join the lobby, allowing judges and players to test the game loops instantly.

---

## ⚡ Tech Stack & Features

*   **Frontend:** React 19, Vite, TypeScript, Canvas API.
*   **Styling:** Custom 8-bit visual styles in CSS Vanilla (no Tailwind) with CRT scanline filters, retro gaming fonts (`Press Start 2P`), and glassmorphism cards.
*   **Backend:** Node.js, Express, Socket.io (real-time state synchronization).
*   **Bitcoin Integration:**
    *   **WebLN** support (automatic deposits/withdrawals with 1-click using Alby/LaWallet extension).
    *   Dynamic Lightning Invoice QR rendering & status polling.
    *   Mock Lightning Server: Automatically processes simulated payments in Demo Mode in 4 seconds for sandbox testing.
*   **Nostr Identity:** NIP-07 extension login to fetch your name, avatar, and npub, with manual fallback profile configuration.
*   **Audio:** Custom 8-bit sound effects (bleeps, coin collect, explosion noises) generated dynamically in-browser via the **Web Audio API** (no heavy sound assets).

---

## 🚀 Quickstart

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/CapScabio/Zapitos.git
    cd Zapitos
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run Client and Server concurrently in Development:**
    ```bash
    npm run dev:all
    ```
    This launches:
    *   The frontend Vite application at `http://localhost:5173`
    *   The Socket.io backend server at `http://localhost:3001`

---

<a name="español"></a>

## 🇪🇸 Descripción en Español

**Zapitos Arcade** es una plataforma de minijuegos web con estética retro de **8-bits** donde los jugadores apuestan y ganan Satoshis (Bitcoin a través de Lightning Network) e inician sesión de manera descentralizada con su identidad de Nostr. Proyecto desarrollado para la **Hackatón #04 (GAMING)** de La Crypta Dev (Junio 2026).

### Características Principales:
1.  **🏺 Ánforas de la Suerte (Individual):** Subida de 10 filas de vasijas. Mayor dificultad a partir de la fila 6 (solo 1 de 3 es segura). Ganancia máxima de 2.0x.
2.  **🪰 Atrapa-Moscas (Individual):** Juego en Canvas de apuntar y disparar la lengua. Cada clic descuenta 1 sat del pozo. Caza moscas para ganar sats y esquiva abejas.
3.  **👥 Charco Rápido (Multijugador PvP):** Compite contra otros sapos por comer moscas. El ganador se lleva el 100% del pozo acumulado.
4.  **🏁 Carrera de Sapitos (Multijugador):** Sincroniza saltos rítmicos en una barra de calibración para cruzar la meta primero.
5.  **Billetera y Nostr:** Integración nativa con WebLN, QR de facturas Lightning y autenticación NIP-07. Incluye un **Modo Demo** y **Modo Sandbox con Bots** para pruebas rápidas sin fricciones.

---

## 🍻 Créditos

Creado por el **Capitán del Scabio**, ¡salud y libertad! 🍻⚡

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
