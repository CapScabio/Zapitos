import React from 'react';

interface LeaderboardPlayer {
  rank: number;
  avatar: string;
  name: string;
  npub: string;
  earnings: number; // in sats
}

interface LeaderboardProps {
  currentNpub: string | null;
}

// Datos de prueba iniciales para la tabla de clasificación de la hackatón
const INITIAL_LEADERBOARD: LeaderboardPlayer[] = [
  { rank: 1, avatar: '🦎', name: 'AlbyFrog ⚡', npub: 'npub1...a8f4', earnings: 1450 },
  { rank: 2, avatar: '🚀', name: 'Zapitator', npub: 'npub1...k2l9', earnings: 980 },
  { rank: 3, avatar: '👾', name: 'NostrFrog', npub: 'npub1...m0e2', earnings: 740 },
  { rank: 4, avatar: '🐸', name: 'SapoPepe', npub: 'npub1...q5r1', earnings: 510 },
  { rank: 5, avatar: '🧙', name: 'LaWalletSapo', npub: 'npub1...t7x4', earnings: 380 },
];

export const Leaderboard: React.FC<LeaderboardProps> = ({ currentNpub }) => {
  return (
    <div className="pixel-card teal" style={{ width: '100%' }}>
      <h3 className="retro-text" style={{ color: 'var(--accent-teal)', textAlign: 'center', marginBottom: '12px' }}>
        🏆 HIGH SCORES (TOP ZAPITOS)
      </h3>
      
      <table className="pixel-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Sapo</th>
            <th>Npub</th>
            <th style={{ textAlign: 'right' }}>Sats Ganados</th>
          </tr>
        </thead>
        <tbody>
          {INITIAL_LEADERBOARD.map((player) => {
            const isMe = currentNpub && player.npub.includes(currentNpub.substring(0, 4));
            return (
              <tr 
                key={player.rank} 
                style={{ 
                  color: isMe ? 'var(--primary-neon)' : 'inherit',
                  fontWeight: isMe ? 'bold' : 'normal'
                }}
              >
                <td>{player.rank}°</td>
                <td style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{player.avatar}</span>
                  <span>{player.name}</span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{player.npub}</td>
                <td style={{ textAlign: 'right', color: 'var(--accent-orange)' }}>
                  {player.earnings} ⚡
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px', lineHeight: '1.4' }}>
        * Las ganancias se actualizan tras cada retiro y victoria en torneos de multiplayer.
      </div>
    </div>
  );
};
