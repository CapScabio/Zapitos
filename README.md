# 🐸 Zapitos Arcade ⚡

[![Hackathon](https://img.shields.io/badge/La_Crypta-Gaming_Hackathon_%2304-brightgreen?style=press-start-2p&logo=bitcoin)](https://lacrypta.dev/hackathons/zaps)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/Demo-Vercel-orange?style=flat&logo=vercel)](https://zapitos.vercel.app/)

**Zapitos Arcade** es una plataforma web y móvil (PWA) de minijuegos retro de 8-bits donde los jugadores apuestan y ganan Satoshis (Bitcoin a través de Lightning Network) e inician sesión de manera descentralizada con su identidad de Nostr. Proyecto desarrollado para la **Hackatón #04 (GAMING)** de La Crypta Dev (Junio 2026).

🎮 **Juega la demo en vivo ahora:** [zapitos.vercel.app](https://zapitos.vercel.app/)

---

## 🎮 El Catálogo de Minijuegos

La plataforma cuenta con 9 juegos temáticos de sapitos en total: 7 juegos individuales (Single Player) de riesgo calibrado y cobro en caliente, y 2 juegos multijugador (PvP) sincronizados en tiempo real.

### 🕹️ Juegos Individuales (Single Player)

#### 1. 🏺 Ánforas de la Suerte (*Lucky Amphoras*)
Sube un camino de 10 filas de vasijas de barro (3 vasijas por fila).
*   **Filas 1-5:** 2 vasijas seguras y 1 trampa (66.6% de éxito).
*   **Filas 6-10:** ¡Dificultad invertida! 1 vasija segura y 2 trampas (33.3% de éxito).
*   **Wagers:** Apuestas tu pozo para llegar a la cima. La recompensa máxima en la fila 10 está capada a **2.0x** de tu apuesta para proteger la economía. ¡Puedes hacer *Cash Out* (Cobrar) tras cualquier fila exitosa!

#### 2. 🪰 Atrapa-Moscas (*Fly Catcher*)
Un arcade dinámico en Canvas de apuntar y disparar con la lengua del sapito.
*   Pagas una entrada para ingresar al charco. Cada lengüetazo disparado cuesta **1 sat** de tu pozo activo.
*   Caza insectos para recuperar y ganar sats: Mosca Común (`🪰` = +2 sats), Mosquito (`🦟` = +3 sats) y Escarabajo Dorado (`🪲` = +5 sats).
*   Esquiva a las Abejas venenosas (`🐝` = -5 sats). ¡Cobra tu pozo en caliente en cualquier momento!

#### 3. 🦅 Defensa del Estanque (*Pond Defense*)
Juego de defensa satírico: *¡El estanque patrio no se vende!*
*   Serpientes libertarias amarillas con rayas negras avanzan desde la derecha intentando privatizar el estanque y vendérselo al Águila de EE.UU. que acecha arriba.
*   Haz saltar al sapo para pisar las serpientes (+3 sats al pozo).
*   **Multiplicador de Combo Aéreo:** Si encadenas pisadas sobre enemigos en el aire sin tocar el suelo, incrementas un combo (`Combo x2`, `x3`, etc.) multiplicando tus ganancias. Al tocar tierra, se reinicia.
*   Si una serpiente entra al estanque, daña su barra de vida. Si llega a 0, el águila privatiza el estanque (¡VENDIDO! EE.UU. 🇺🇸) y pierdes tu pozo.

#### 4. 🏃‍♂️ Sapo Run
Juego de carrera infinito de scroll lateral en Canvas estilo *Chrome Dino*.
*   El sapito corre automáticamente sobre nenúfares flotantes en el pantano.
*   Toca la pantalla o presiona Espacio para saltar. Cuenta con **Doble Salto** (puedes pulsar una segunda vez en el aire para superar abismos imposibles).
*   Caza moscas (`🪰` = +1 sat) y escarabajos (`🪲` = +3 sats) en el trayecto.
*   Si chocas contra cangrejos/culebras o caes al agua profunda, es Game Over. Cobra tus sats acumulados cuando decidas no arriesgar más.

#### 5. 🧱 Sapo Stack
Juego de habilidad y reflejos de apilamiento vertical en Canvas (estilo *Stacker* de arcade).
*   Plataformas flotantes de nenúfares oscilan de lado a lado y debes detenerlas a tiempo para construir una torre estable sobre la base.
*   Cada piso colocado con precisión incrementa tu multiplicador exponencialmente (`x1.15`, `x1.35`, `x1.60`, `x1.95` hasta un máximo de **8.0x** en el piso 10).
*   Si detienes el bloque desalineado, se recortarán los bordes reduciendo su tamaño. Si le erras por completo, la torre cae y pierdes. Cobra tus sats acumulados en cualquier piso.

#### 6. ⛏️ Sapo Miner
Excavación estratégica en una grilla de barro de 5x5 inspirada en *Buscaminas* y *Mines*.
*   El pantano esconde tesoros: hay exactamente **1 culebra (🐍) por fila** (5 culebras ocultas en total) y 20 lombrices deliciosas (🪱).
*   **Modo Marcador (🚩):** Puedes alternar entre el modo *Excavar ⛏️* y *Marcar 🚩*.
*   Para completar el juego y coronar la victoria total con un pago masivo de **270.0x**, debes desenterrar las 20 lombrices y marcar correctamente la posición de las 5 culebras con banderas. Si desentierras una culebra directamente, pierdes el pozo. Cobra tus sats acumulados en cualquier turno.

#### 7. 🛸 Swamp Invaders
Shooter retro de scroll vertical en pantalla extendida de 480px de alto.
*   Insectos robóticos invasores descienden en hileras balanceándose de lado a lado.
*   Te desplazas horizontalmente y disparas la lengua del sapito hacia arriba. Cada disparo cuesta **1 sat** de tu pozo.
*   Destruye a los invasores para sumar sats a tu pozo: Drones (`🤖` = +2 sats), Avispas acorazadas (`🐝` = +4 sats, requieren 2 golpes) y el OVNI Jefe (`🛸` = +15 sats, requiere 3 golpes).
*   Evita que los invasores toquen el suelo o que el pozo llegue a 0. Cobra tu botín acumulado cuando quieras.

---

### 👥 Juegos Multijugador (Real-Time PvP)

#### 8. 👥 Charco Rápido (*Fly Feast*)
Competición sincronizada por WebSockets en tiempo real.
*   Los sapos entran a una misma sala pagando una entrada de 10 sats.
*   Las moscas aparecen de forma aleatoria en el charco y el jugador que haga clic más rápido se la come.
*   El sapito que atrape más moscas al cabo de 10 rondas se corona ganador y se lleva el **100% del pozo acumulado** de todas las entradas.
*   *Modo Sandbox:* Si juegas de forma local o sin servidor activo, se activa el modo contra bots con IA automática.

#### 9. 🏁 Carrera de Sapitos (*Frog Race*)
Carrera de velocidad y ritmo por carriles de agua sincronizada por WebSockets.
*   Paga tu entrada y compite en tiempo real contra otros jugadores.
*   Presiona saltar (o Espacio) justo en el momento en que la aguja oscilante pase por la zona verde de calibración para avanzar rápido.
*   El primer sapito en cruzar la meta reclama el pozo completo. Cuenta con soporte offline de bots con IA para pruebas.

---

## ⚡ Integración de Bitcoin (Lightning Network) y Nostr

*   **WebLN Integrado:** Conexión nativa con extensiones de navegador (Alby, LaWallet, etc.) para depósitos y retiros en 1 solo clic.
*   **Facturas QR Dinámicas:** Si no posees extensión, genera códigos QR de facturas Lightning con consulta de estado en tiempo real.
*   **Nostr Identity (NIP-07):** Inicia sesión con tu extensión Nostr para cargar tu nombre, avatar y npub. Si eres un jurado o no tienes extensión, puedes usar el **Modo Sapo Manual** para crear un perfil de prueba al instante.
*   **Modo Demo:** Juega sin arriesgar fondos reales cargando sats virtuales gratis con un solo clic.

---

## 📱 PWA (Progressive Web App) y Soporte Móvil

Zapitos Arcade está completamente optimizado para su instalación en celulares Android:
*   Se añade soporte PWA a través de `vite-plugin-pwa`.
*   Al abrir el enlace en Chrome para Android, aparecerá el banner de instalación.
*   Se ejecuta a pantalla completa en modo `standalone` con orientación fija `portrait`, ocultando la barra del navegador para emular una aplicación nativa.
*   Todos los juegos incluyen botones y controles táctiles adaptados para jugar cómodamente en smartphones.

---

## 🚀 Instalación Local

1.  **Clonar repositorio:**
    ```bash
    git clone https://github.com/CapScabio/Zapitos.git
    cd Zapitos
    ```
2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
3.  **Ejecutar cliente y servidor de WebSocket simultáneamente:**
    ```bash
    npm run dev:all
    ```
    *   Cliente: `http://localhost:5173`
    *   Servidor WebSocket: `http://localhost:3001`

---

## 🍻 Créditos

Creado por el **Capitán del Scabio**, ¡salud y libertad! 🍻⚡

---

## 📜 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
