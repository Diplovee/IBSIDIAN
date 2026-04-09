import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { SettingsView } from './SidePanel';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings } = useActivity();

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSettingsOpen, closeSettings]);

  if (!isSettingsOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', paddingLeft: 16, paddingRight: 16, background: 'rgba(0,0,0,0.25)' }}
      onClick={closeSettings}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 660, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</span>
          <button
            onClick={closeSettings}
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}
          >
            <X size={14} color="var(--bg-primary)" />
          </button>
        </div>
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <SettingsView showTitle={false} />
        </div>
      </div>
    </div>
  );
};
