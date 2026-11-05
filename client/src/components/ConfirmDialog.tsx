import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ConfirmTone = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmState extends Required<ConfirmOptions> {
  tone: ConfirmTone;
}

type ConfirmResolver = (confirmed: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

const DEFAULT_LABELS = {
  confirmLabel: 'Onayla',
  cancelLabel: 'Vazgec',
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<ConfirmResolver | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }

    setState({
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || DEFAULT_LABELS.confirmLabel,
      cancelLabel: options.cancelLabel || DEFAULT_LABELS.cancelLabel,
      tone: options.tone || 'info',
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state && (
        <div className="confirm-overlay" role="presentation" onClick={() => close(false)}>
          <div
            className={`confirm-dialog confirm-dialog-${state.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-icon" aria-hidden="true">
              {state.tone === 'danger' ? '!' : state.tone === 'warning' ? '?' : 'i'}
            </div>
            <div className="confirm-content">
              <h2 id="confirm-dialog-title" className="confirm-title">{state.title}</h2>
              <p id="confirm-dialog-message" className="confirm-message">{state.message}</p>
            </div>
            <div className="confirm-actions">
              <button type="button" className="confirm-btn confirm-btn-cancel" onClick={() => close(false)}>
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={`confirm-btn confirm-btn-${state.tone}`}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used inside ConfirmProvider');
  }
  return confirm;
}
