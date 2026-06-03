import { useState, useEffect } from 'react';

export interface WebLNProvider {
  enable: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<{ preimage: string }>;
  makeInvoice: (args: { amount: number; defaultMemo?: string }) => Promise<{ paymentHash: string; paymentRequest: string }>;
}

declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

export function useWebLN() {
  const [provider, setProvider] = useState<WebLNProvider | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar si WebLN está disponible en el objeto window
    const checkWebLN = () => {
      if (window.webln) {
        setProvider(window.webln);
        setIsAvailable(true);
      } else {
        setIsAvailable(false);
      }
    };

    // Darle un pequeño retardo para asegurar que las extensiones se inyecten
    const timer = setTimeout(checkWebLN, 500);
    return () => clearTimeout(timer);
  }, []);

  const enable = async () => {
    if (!provider) {
      setError('WebLN no disponible. Por favor instala una extensión como Alby.');
      return false;
    }

    try {
      setError(null);
      await provider.enable();
      setIsEnabled(true);
      return true;
    } catch (e: any) {
      console.error('Error habilitando WebLN:', e);
      setError(e.message || 'El usuario rechazó la conexión.');
      return false;
    }
  };

  const sendPayment = async (invoice: string) => {
    if (!provider) throw new Error('WebLN no disponible.');
    if (!isEnabled) {
      const active = await enable();
      if (!active) throw new Error('WebLN no habilitado.');
    }
    return await provider.sendPayment(invoice);
  };

  const makeInvoice = async (amount: number, memo: string = 'Depósito en Zapitos') => {
    if (!provider) throw new Error('WebLN no disponible.');
    if (!isEnabled) {
      const active = await enable();
      if (!active) throw new Error('WebLN no habilitado.');
    }
    return await provider.makeInvoice({
      amount,
      defaultMemo: memo,
    });
  };

  return {
    isAvailable,
    isEnabled,
    error,
    enable,
    sendPayment,
    makeInvoice,
  };
}
