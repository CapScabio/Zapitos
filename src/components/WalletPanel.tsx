import React, { useState, useEffect } from 'react';
import { useWebLN } from '../hooks/useWebLN';

interface WalletPanelProps {
  npub: string | null;
  balance: number; // in sats
  isRealMode: boolean;
  onToggleMode: (real: boolean) => void;
  onBalanceChange: (amount: number) => void;
}

export const WalletPanel: React.FC<WalletPanelProps> = ({
  npub,
  balance,
  isRealMode,
  onToggleMode,
  onBalanceChange,
}) => {
  const { isAvailable: weblnAvailable } = useWebLN();
  const [depositAmount, setDepositAmount] = useState<number>(50);
  const [withdrawInvoice, setWithdrawInvoice] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // States for Real Mode Deposit Invoice
  const [generatedInvoice, setGeneratedInvoice] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<any>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  // Limpiar polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  // Obtener balance real del servidor si estamos logueados en Modo Real
  useEffect(() => {
    if (isRealMode && npub) {
      fetch(`${BACKEND_URL}/api/balance/${npub}`)
        .then(res => res.json())
        .then(data => {
          // Si el balance del server es distinto, sincronizarlo
          const diff = data.balance - balance;
          if (diff !== 0) {
            onBalanceChange(diff);
          }
        })
        .catch(err => console.error('Error cargando balance del servidor:', err));
    }
  }, [isRealMode, npub]);

  const handleDepositReal = async () => {
    setLoading(true);
    setError(null);
    setGeneratedInvoice(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: depositAmount, npub: npub || 'anonimo' }),
      });

      if (!response.ok) throw new Error('No se pudo generar la factura');
      const data = await response.json();

      setGeneratedInvoice(data.pr);

      // Iniciar consulta de estado (polling) cada 2 segundos
      if (pollingInterval) clearInterval(pollingInterval);
      
      const interval = setInterval(async () => {
        try {
          const checkRes = await fetch(`${BACKEND_URL}/api/invoice/${data.paymentHash}`);
          const checkData = await checkRes.json();
          if (checkData.paid) {
            clearInterval(interval);
            setPollingInterval(null);
            setGeneratedInvoice(null);
            setActiveTab(null);
            
            // Incrementar balance
            onBalanceChange(depositAmount);
            alert(`🎉 ¡Depósito acreditado con éxito! +${depositAmount} sats`);
          }
        } catch (err) {
          console.error('Error consultando factura:', err);
        }
      }, 2000);

      setPollingInterval(interval);

    } catch (e: any) {
      setError(e.message || 'Error al conectar con la red Lightning');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawReal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawInvoice.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Si WebLN está disponible y habilitado, podemos pagar directamente
      if (weblnAvailable && window.webln) {
        try {
          await window.webln.enable();
          const response = await window.webln.sendPayment(withdrawInvoice);
          if (response.preimage) {
            // Informar al backend para restar saldo si es necesario
            await fetch(`${BACKEND_URL}/api/withdraw`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoice: withdrawInvoice, amount: depositAmount, npub }),
            });
            onBalanceChange(-depositAmount); // Restar localmente
            alert('🚀 Retiro procesado con éxito vía WebLN.');
            setWithdrawInvoice('');
            setActiveTab(null);
            return;
          }
        } catch (weblnError) {
          console.warn('WebLN payment failed, falling back to manual server-side payment', weblnError);
        }
      }

      // 2. Fallback: El servidor procesa el pago de la factura
      // Nota: Para simplificar el demo deducimos el pozo que el usuario especifica
      const response = await fetch(`${BACKEND_URL}/api/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          invoice: withdrawInvoice, 
          amount: Math.min(balance, 100), // Retirar máximo 100 o su balance en el demo
          npub 
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fallo en la transacción de retiro');

      onBalanceChange(-Math.min(balance, 100));
      alert('🚀 ¡Retiro procesado! Los satoshis fueron enviados.');
      setWithdrawInvoice('');
      setActiveTab(null);

    } catch (e: any) {
      setError(e.message || 'Error procesando el retiro.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDemoSats = () => {
    onBalanceChange(100);
  };

  return (
    <div className="pixel-card orange" style={{ maxWidth: '400px', width: '100%' }}>
      {/* Balance display */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div className="retro-text" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
          TU BALANCE:
        </div>
        <div className="retro-title" style={{ color: 'var(--accent-orange)', fontSize: '1.8rem', margin: '4px 0' }}>
          {balance} <span style={{ fontSize: '1rem' }}>SATS</span>
        </div>
        <div className="retro-text" style={{ fontSize: '0.5rem', color: isRealMode ? 'var(--primary-neon)' : 'var(--accent-teal)' }}>
          {isRealMode ? '⚡ RED LIGHTNING ACTIVA' : '🎮 MODO DEMO / VIRTUAL'}
        </div>
      </div>

      {/* Mode Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => {
            if (pollingInterval) clearInterval(pollingInterval);
            setGeneratedInvoice(null);
            onToggleMode(false);
          }}
          className={`pixel-btn ${!isRealMode ? 'teal' : ''}`}
          style={{ flex: 1, padding: '8px', fontSize: '0.6rem', justifyContent: 'center' }}
        >
          🎮 Modo Demo
        </button>
        <button
          onClick={() => onToggleMode(true)}
          className={`pixel-btn ${isRealMode ? 'orange' : ''}`}
          style={{ flex: 1, padding: '8px', fontSize: '0.6rem', justifyContent: 'center' }}
        >
          ⚡ Modo Real
        </button>
      </div>

      {/* Demo Controls */}
      {!isRealMode ? (
        <button
          onClick={handleAddDemoSats}
          className="pixel-btn teal"
          style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
        >
          ➕ Cargar 100 Sats Gratis
        </button>
      ) : (
        /* Real Mode Controls */
        <div>
          {activeTab === null ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setActiveTab('deposit'); setError(null); }}
                className="pixel-btn orange"
                style={{ flex: 1, padding: '10px', fontSize: '0.65rem', justifyContent: 'center' }}
              >
                📥 Depositar
              </button>
              <button
                onClick={() => { setActiveTab('withdraw'); setError(null); }}
                className="pixel-btn"
                style={{ flex: 1, padding: '10px', fontSize: '0.65rem', justifyContent: 'center' }}
              >
                📤 Retirar
              </button>
            </div>
          ) : (
            <div>
              {/* Back to main wallet options */}
              <button
                onClick={() => {
                  if (pollingInterval) clearInterval(pollingInterval);
                  setGeneratedInvoice(null);
                  setActiveTab(null);
                }}
                className="pixel-btn"
                style={{ padding: '4px 8px', fontSize: '0.55rem', marginBottom: '12px' }}
              >
                ◀ Volver
              </button>

              {error && (
                <div className="retro-text" style={{ color: 'var(--text-error)', marginBottom: '10px', fontSize: '0.55rem', textAlign: 'center' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Deposit tab content */}
              {activeTab === 'deposit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                  {!generatedInvoice ? (
                    <div style={{ width: '100%' }}>
                      <label className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        Cantidad a Depositar (Sats):
                      </label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        {[10, 50, 100, 500].map(amt => (
                          <button
                            key={amt}
                            onClick={() => setDepositAmount(amt)}
                            className={`pixel-btn ${depositAmount === amt ? 'orange' : ''}`}
                            style={{ flex: 1, padding: '6px', fontSize: '0.6rem', justifyContent: 'center', minWidth: '0' }}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Math.max(1, parseInt(e.target.value) || 0))}
                        className="pixel-input orange"
                        min={1}
                        style={{ textAlign: 'center', marginBottom: '12px' }}
                      />
                      <button
                        onClick={handleDepositReal}
                        className="pixel-btn orange"
                        style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                        disabled={loading}
                      >
                        {loading ? 'Generando...' : 'Generar Factura ⚡'}
                      </button>
                    </div>
                  ) : (
                    /* Invoice generated, show QR */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                      <div className="pixel-card" style={{ padding: '8px', background: '#fff', border: '2px solid #000' }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(generatedInvoice)}`}
                          alt="Lightning Invoice QR"
                          style={{ display: 'block' }}
                        />
                      </div>
                      <div className="retro-text blink" style={{ fontSize: '0.55rem', color: 'var(--accent-orange)' }}>
                        ⌛ ESPERANDO PAGO (4s MOCK AUTO-PAGO)
                      </div>
                      <textarea
                        readOnly
                        value={generatedInvoice}
                        onClick={(e) => {
                          (e.target as HTMLTextAreaElement).select();
                          document.execCommand('copy');
                          alert('Factura copiada al portapapeles.');
                        }}
                        className="pixel-input"
                        style={{ fontSize: '0.5rem', height: '50px', cursor: 'pointer', fontFamily: 'monospace' }}
                      />
                      <div className="retro-text" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        (Haz clic para copiar. En el servidor demo local, esta factura se pagará automáticamente en 4 segundos para simular la red).
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Withdraw tab content */}
              {activeTab === 'withdraw' && (
                <form onSubmit={handleWithdrawReal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Factura Lightning (Invoice / LNURL):
                    </label>
                    <textarea
                      value={withdrawInvoice}
                      onChange={(e) => setWithdrawInvoice(e.target.value)}
                      className="pixel-input"
                      placeholder="lnbc..."
                      rows={3}
                      required
                      style={{ fontSize: '0.55rem', resize: 'none', fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="pixel-btn orange"
                    style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                    disabled={loading || balance <= 0}
                  >
                    {loading ? 'Procesando...' : 'Retirar Fondos 🚀'}
                  </button>
                  {balance <= 0 && (
                    <div className="retro-text" style={{ fontSize: '0.55rem', color: 'var(--text-error)', textAlign: 'center' }}>
                      No tienes sats para retirar.
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
