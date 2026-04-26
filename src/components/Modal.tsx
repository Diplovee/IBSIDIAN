import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ─────────────────────────────────────────────────────────────────

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}

interface ChooseOption {
  label: string;
  value: string;
  description?: string;
  danger?: boolean;
}

interface ChooseOptions {
  title: string;
  message?: string;
  options: ChooseOption[];
  cancelLabel?: string;
}

interface AlertOptions {
  title: string;
  message?: string;
}

interface ModalContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  choose: (opts: ChooseOptions) => Promise<string | null>;
  alert: (opts: AlertOptions) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalContextType>({
  confirm: async () => false,
  prompt: async () => null,
  choose: async () => null,
  alert: async () => {},
});

export const useModal = () => useContext(ModalContext);

// ── Internal state ────────────────────────────────────────────────────────

type ModalState =
  | { type: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { type: 'prompt';  opts: PromptOptions;  resolve: (v: string | null) => void }
  | { type: 'choose';  opts: ChooseOptions;  resolve: (v: string | null) => void }
  | { type: 'alert';   opts: AlertOptions;   resolve: () => void }
  | null;

// ── Provider ──────────────────────────────────────────────────────────────

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ModalState>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> =>
    new Promise(resolve => setModal({ type: 'confirm', opts, resolve })), []);

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> =>
    new Promise(resolve => setModal({ type: 'prompt', opts, resolve })), []);

  const choose = useCallback((opts: ChooseOptions): Promise<string | null> =>
    new Promise(resolve => setModal({ type: 'choose', opts, resolve })), []);

  const alert = useCallback((opts: AlertOptions): Promise<void> =>
    new Promise(resolve => setModal({ type: 'alert', opts, resolve })), []);

  const close = () => setModal(null);

  return (
    <ModalContext.Provider value={{ confirm, prompt, choose, alert }}>
      {children}
      <AnimatePresence>
        {modal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000 }}
              onClick={() => { if (modal.type === 'confirm') modal.resolve(false); else modal.resolve(null); close(); }}
            />
            {/* Modal */}
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9001, pointerEvents: 'none' }}>
              <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ pointerEvents: 'auto', width: 380, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', padding: '20px 20px 16px' }}
              >
                {modal.type === 'confirm'
                  ? <ConfirmModal modal={modal} onClose={close} />
                  : modal.type === 'prompt'
                  ? <PromptModal modal={modal} onClose={close} />
                  : modal.type === 'choose'
                  ? <ChooseModal modal={modal} onClose={close} />
                  : <AlertModal modal={modal} onClose={close} />}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
};

// ── Confirm modal ─────────────────────────────────────────────────────────

const ConfirmModal: React.FC<{ modal: Extract<ModalState, { type: 'confirm' }>; onClose: () => void }> = ({ modal, onClose }) => {
  const { opts, resolve } = modal;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { resolve(true); onClose(); }
      if (e.key === 'Escape') { resolve(false); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [resolve, onClose]);

  return (
    <>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: opts.message ? 8 : 20 }}>
        {opts.title}
      </p>
      {opts.message && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
          {opts.message}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <ModalBtn label={opts.cancelLabel ?? 'Cancel'} onClick={() => { resolve(false); onClose(); }} />
        <ModalBtn label={opts.confirmLabel ?? 'Confirm'} primary danger={opts.danger} onClick={() => { resolve(true); onClose(); }} autoFocus />
      </div>
    </>
  );
};

// ── Prompt modal ──────────────────────────────────────────────────────────

const PromptModal: React.FC<{ modal: Extract<ModalState, { type: 'prompt' }>; onClose: () => void }> = ({ modal, onClose }) => {
  const { opts, resolve } = modal;
  const [value, setValue] = useState(opts.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { resolve(null); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [resolve, onClose]);

  const submit = () => { if (value.trim()) { resolve(value.trim()); onClose(); } };

  return (
    <>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: opts.message ? 6 : 12 }}>
        {opts.title}
      </p>
      {opts.message && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>{opts.message}</p>
      )}
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder={opts.placeholder}
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginBottom: 16, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <ModalBtn label="Cancel" onClick={() => { resolve(null); onClose(); }} />
        <ModalBtn label={opts.confirmLabel ?? 'OK'} primary onClick={submit} disabled={!value.trim()} />
      </div>
    </>
  );
};

// ── Choose modal ─────────────────────────────────────────────────────────

const ChooseModal: React.FC<{ modal: Extract<ModalState, { type: 'choose' }>; onClose: () => void }> = ({ modal, onClose }) => {
  const { opts, resolve } = modal;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { resolve(null); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [resolve, onClose]);

  return (
    <>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: opts.message ? 6 : 12 }}>
        {opts.title}
      </p>
      {opts.message && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          {opts.message}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {opts.options.map(option => (
          <button
            key={option.value}
            onClick={() => { resolve(option.value); onClose(); }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 3,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${option.danger ? '#fecaca' : 'var(--border)'}`,
              background: 'var(--bg-secondary)',
              color: option.danger ? '#ef4444' : 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.1s, border-color 0.1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = option.danger ? '#fca5a5' : 'var(--accent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
              e.currentTarget.style.borderColor = option.danger ? '#fecaca' : 'var(--border)';
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>{option.label}</span>
            {option.description && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{option.description}</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModalBtn label={opts.cancelLabel ?? 'Cancel'} onClick={() => { resolve(null); onClose(); }} />
      </div>
    </>
  );
};

// ── Alert modal ───────────────────────────────────────────────────────────

const AlertModal: React.FC<{ modal: Extract<ModalState, { type: 'alert' }>; onClose: () => void }> = ({ modal, onClose }) => {
  const { opts, resolve } = modal;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') { resolve(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [resolve, onClose]);

  return (
    <>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: opts.message ? 8 : 20 }}>
        {opts.title}
      </p>
      {opts.message && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
          {opts.message}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModalBtn label="OK" primary onClick={() => { resolve(); onClose(); }} autoFocus />
      </div>
    </>
  );
};

// ── Button ────────────────────────────────────────────────────────────────

const ModalBtn: React.FC<{ label: string; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; autoFocus?: boolean }> =
  ({ label, onClick, primary, danger, disabled, autoFocus }) => {
    const [h, setH] = useState(false);
    const bg = primary
      ? danger ? (h ? '#dc2626' : '#ef4444') : (h ? 'var(--accent-hover)' : 'var(--accent)')
      : h ? 'var(--bg-hover)' : 'var(--bg-secondary)';

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        autoFocus={autoFocus}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        style={{ padding: '7px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: primary ? 'none' : '1px solid var(--border)', cursor: disabled ? 'not-allowed' : 'pointer', background: bg, color: primary ? '#fff' : 'var(--text-primary)', opacity: disabled ? 0.5 : 1, transition: 'background 0.1s', outline: 'none' }}
      >
        {label}
      </button>
    );
  };
