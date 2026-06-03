import React, { useState, useEffect } from 'react';

export interface NostrProfile {
  npub: string;
  name: string;
  avatar: string;
}

interface NostrLoginProps {
  onLogin: (profile: NostrProfile) => void;
  onLogout: () => void;
  currentProfile: NostrProfile | null;
}

const RETRO_AVATARS = [
  '🐸', '🦖', '🐢', '🐊', '🦎', '🐍', '🐙', '👾', '🚀', '🧙'
];

export const NostrLogin: React.FC<NostrLoginProps> = ({ onLogin, onLogout, currentProfile }) => {
  const [hasExtension, setHasExtension] = useState<boolean>(false);
  const [manualName, setManualName] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🐸');
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.hasOwnProperty('nostr') || (window as any).nostr) {
        setHasExtension(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleNostrLogin = async () => {
    try {
      setError(null);
      if (!(window as any).nostr) {
        setError('Extensión de Nostr no detectada.');
        return;
      }
      
      const pubkey = await (window as any).nostr.getPublicKey();
      // Simular npub corto para visualización
      // npubShort variable removed as it is not used in mock flow
      
      // Intentar obtener perfil (Mock/Relay)
      let name = `Sapito_${pubkey.substring(0, 4)}`;
      let avatar = '🐸';

      try {
        // En un caso real consultaríamos un relay (NIP-01/05), aquí simulamos con datos rápidos
        // ya que la red puede tardar o bloquearse en entornos cerrados.
        // Si hay metadatos guardados los tomamos.
      } catch (e) {
        console.warn('No se pudo obtener metadatos de Nostr, usando mock.', e);
      }

      onLogin({
        npub: pubkey,
        name,
        avatar,
      });
    } catch (e: any) {
      console.error('Error en Nostr Login:', e);
      setError(e.message || 'El usuario canceló el inicio de sesión.');
    }
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setError('Por favor ingresa un nombre.');
      return;
    }
    setError(null);
    const mockPubkey = 'npub_demo_' + Math.random().toString(36).substring(2, 10);
    onLogin({
      npub: mockPubkey,
      name: manualName,
      avatar: selectedAvatar,
    });
  };

  if (currentProfile) {
    return (
      <div className="pixel-card teal" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px' }}>
        <div style={{ fontSize: '2rem' }}>{currentProfile.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="retro-text" style={{ color: 'var(--accent-teal)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {currentProfile.name}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {currentProfile.npub.substring(0, 12)}...
          </div>
        </div>
        <button onClick={onLogout} className="pixel-btn" style={{ padding: '6px 10px', fontSize: '0.6rem' }}>
          Salir
        </button>
      </div>
    );
  }

  return (
    <div className="pixel-card teal" style={{ maxWidth: '400px', width: '100%' }}>
      <h3 className="retro-text" style={{ color: 'var(--accent-teal)', marginBottom: '12px', textAlign: 'center' }}>
        ACCESO NOSTR
      </h3>
      
      {error && (
        <div className="retro-text" style={{ color: 'var(--text-error)', marginBottom: '12px', fontSize: '0.6rem', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {!isManualMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={handleNostrLogin} 
            className="pixel-btn teal" 
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={!hasExtension}
          >
            🔌 Conectar Nostr Extension
          </button>
          
          {!hasExtension && (
            <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
              (No se detectó extensión como Alby, Amber o nos2x)
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '2px dashed var(--bg-card-hover)' }} />
            <span className="retro-text" style={{ padding: '0 8px', fontSize: '0.55rem', color: 'var(--text-muted)' }}>O</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '2px dashed var(--bg-card-hover)' }} />
          </div>

          <button 
            onClick={() => setIsManualMode(true)} 
            className="pixel-btn" 
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.65rem' }}
          >
            📝 Entrar con Sapo Manual
          </button>
        </div>
      ) : (
        <form onSubmit={handleManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Nombre de tu Sapito:
            </label>
            <input 
              type="text" 
              value={manualName} 
              onChange={(e) => setManualName(e.target.value)} 
              className="pixel-input" 
              placeholder="Ej. SapoPepe" 
              maxLength={15}
            />
          </div>

          <div>
            <label className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Elige tu Avatar Retro:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', padding: '6px 0' }}>
              {RETRO_AVATARS.map(avatar => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`pixel-btn ${selectedAvatar === avatar ? 'teal' : ''}`}
                  style={{ 
                    padding: '8px', 
                    fontSize: '1.2rem', 
                    borderWidth: '2px',
                    boxShadow: selectedAvatar === avatar ? 'none' : '2px 2px 0px #000'
                  }}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button 
              type="button" 
              onClick={() => setIsManualMode(false)} 
              className="pixel-btn" 
              style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: '0.65rem' }}
            >
              Atrás
            </button>
            <button 
              type="submit" 
              className="pixel-btn teal" 
              style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: '0.65rem' }}
            >
              Entrar 🚀
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
