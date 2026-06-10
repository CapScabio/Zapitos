import React from 'react';

interface GameItem {
  id: string;
  title: string;
  emoji: string;
  type: 'Individual' | 'Multijugador';
  description: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
}

interface DashboardProps {
  onSelectGame: (gameId: string) => void;
}

const GAMES_LIST: GameItem[] = [
  {
    id: 'lucky_amphoras',
    title: 'ÁNFORAS DE LA SUERTE',
    emoji: '🏺',
    type: 'Individual',
    description: 'Sube las 10 filas de vasijas. Las filas 6 a 10 duplican el riesgo pero puedes doblar tus sats (max 2x). ¡Elige con cuidado!',
    difficulty: 'Medio',
  },
  {
    id: 'fly_catcher',
    title: 'ATRAPA-MOSCAS',
    emoji: '🪰',
    type: 'Individual',
    description: 'Caza moscas en un charco arcade. Cada disparo de lengua cuesta 1 sat. ¡Atrapa moscas y cobra tu botín antes de que te piquen las abejas!',
    difficulty: 'Fácil',
  },
  {
    id: 'pond_defense',
    title: 'DEFENSA DEL ESTANQUE',
    emoji: '🦅',
    type: 'Individual',
    description: '¡El estanque no se vende! Salta y aplasta las serpientes libertarias antes de que lo privaticen y lo entreguen al águila.',
    difficulty: 'Medio',
  },
  {
    id: 'sapo_run',
    title: 'SAPO RUN',
    emoji: '🏃‍♂️',
    type: 'Individual',
    description: 'Runner infinito en Canvas. Salta plataformas y come moscas (🪰=+1, 🪲=+3) esquivando culebras. ¡Cobra antes de caer al agua!',
    difficulty: 'Medio',
  },
  {
    id: 'sapo_stack',
    title: 'SAPO STACK',
    emoji: '🧱',
    type: 'Individual',
    description: 'Apila nenúfares flotantes con precisión de ritmo. Cada piso exitoso aumenta tu multiplicador de sats. ¡Cobra antes de errarle!',
    difficulty: 'Fácil',
  },
  {
    id: 'sapo_miner',
    title: 'SAPO MINER',
    emoji: '⛏️',
    type: 'Individual',
    description: 'Excava en una cuadrícula de barro de 5x5. Encuentra lombrices jugosas (🪱) para subir el pozo. ¡Evita las 3 culebras (🐍)!',
    difficulty: 'Fácil',
  },
  {
    id: 'swamp_invaders',
    title: 'SWAMP INVADERS',
    emoji: '🛸',
    type: 'Individual',
    description: 'Defiende la laguna de oleadas de insectos robóticos en este shooter retro. Cada disparo cuesta 1 sat. 🤖=+2, 🐝=+4, 🛸=+15.',
    difficulty: 'Difícil',
  },
  {
    id: 'fly_feast',
    title: 'CHARCO RÁPIDO (FEAST)',
    emoji: '👥',
    type: 'Multijugador',
    description: 'Enfréntate a otros sapitos. El que coma más moscas se lleva el 100% del pozo acumulado de la sala. ¡Velocidad de clics pura!',
    difficulty: 'Difícil',
  },
  {
    id: 'frog_race',
    title: 'CARRERA DE SAPITOS',
    emoji: '🏁',
    type: 'Multijugador',
    description: 'Carrera rítmica por carriles. Presiona saltar justo en la zona verde para avanzar rápido. ¡Cruza la meta y reclama el pozo!',
    difficulty: 'Medio',
  },
];

export const Dashboard: React.FC<DashboardProps> = ({ onSelectGame }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* Baner Principal de la Hackatón */}
      <div 
        className="pixel-card" 
        style={{ 
          background: 'var(--bg-swamp)', 
          textAlign: 'center', 
          padding: '24px 16px',
          border: '4px solid var(--accent-orange)'
        }}
      >
        <h1 className="retro-title" style={{ fontSize: '1.8rem', color: 'var(--primary-neon)' }}>
          🐸 ZAPITOS ARCADE ⚡
        </h1>
        <p className="retro-subtitle" style={{ color: 'var(--accent-orange)', marginTop: '8px', fontSize: '0.7rem' }}>
          MINIJUEGOS POR SATOSHIS PARA LA HACKATÓN #04 (GAMING) DE LA CRYPTA
        </p>
      </div>

      {/* Grid de Minijuegos */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '16px' 
        }}
      >
        {GAMES_LIST.map((game) => {
          const isMultiplayer = game.type === 'Multijugador';
          return (
            <div 
              key={game.id} 
              className={`pixel-card ${isMultiplayer ? 'orange' : 'teal'}`}
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span 
                    className="retro-text" 
                    style={{ 
                      fontSize: '0.5rem', 
                      color: isMultiplayer ? 'var(--accent-orange)' : 'var(--accent-teal)',
                      background: 'var(--bg-dark)',
                      padding: '4px 8px',
                      borderRadius: '2px'
                    }}
                  >
                    {game.type}
                  </span>
                  <span 
                    className="retro-text" 
                    style={{ 
                      fontSize: '0.5rem', 
                      color: 'var(--text-muted)' 
                    }}
                  >
                    DIF: {game.difficulty}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
                  <span style={{ fontSize: '2.5rem' }}>{game.emoji}</span>
                  <h3 
                    className="retro-text" 
                    style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-light)', 
                      lineHeight: '1.4' 
                    }}
                  >
                    {game.title}
                  </h3>
                </div>

                <p 
                  style={{ 
                    fontSize: '0.85rem', 
                    color: 'var(--text-muted)', 
                    lineHeight: '1.5',
                    marginTop: '8px'
                  }}
                >
                  {game.description}
                </p>
              </div>

              <button
                onClick={() => onSelectGame(game.id)}
                className={`pixel-btn ${isMultiplayer ? 'orange' : 'teal'}`}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                🎮 JUGAR AHORA
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
};
