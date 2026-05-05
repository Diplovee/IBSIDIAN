import React, { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';

export const VaultSetup: React.FC = () => {
  const { setActiveVault } = useVault();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    window.api.app.homeDir().then(setSelectedPath).catch(() => {});
  }, []);
  const [vaultName, setVaultName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickFolder = async () => {
    const path = await window.api.vault.selectFolder();
    if (path) { setSelectedPath(path); setError(null); }
  };

  const handleCreateVault = async () => {
    if (!selectedPath || !vaultName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const [vault] = await Promise.all([
        window.api.vault.create(vaultName.trim(), selectedPath),
        new Promise(r => setTimeout(r, 1200)),
      ]);
      setActiveVault(vault as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault.');
      setIsLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    const path = await window.api.vault.selectFolder();
    if (path) {
      const name = path.split(/[/\\]/).pop() || 'Project';
      const vault = { id: Math.random().toString(36).substr(2, 9), name, path };
      setIsLoading(true);
      try {
        await window.api.vault.open(vault);
        setActiveVault(vault as any);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open folder.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 40 }}>

      {/* Icon + branding */}
      <img src="/favicon.svg" alt="Ibsidian" style={{ width: 96, height: 96, marginBottom: 24, borderRadius: 16 }} />
      <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>Ibsidian</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, marginBottom: 48 }}>Version 2026.5.2</p>

      {/* Form */}
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          <button
            onClick={handleOpenFolder}
            disabled={isLoading}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
          >
            <FolderOpen size={24} color="var(--accent)" />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Open folder</div>
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 16px', borderRadius: 12, border: '1.5px solid var(--accent-soft)', background: 'var(--accent-soft)', cursor: 'default' }}>
            <img src="/favicon.svg" alt="" style={{ width: 24, height: 24 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>New vault</div>
          </div>
        </div>

        {/* Folder picker */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Location for new vault</label>
          <button
            onClick={handlePickFolder}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left' }}
          >
            <FolderOpen size={16} color="var(--accent)" />
            <span style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-mono)', color: selectedPath ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedPath ?? 'Choose parent folder…'}
            </span>
          </button>
        </div>

        {/* Vault name */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Vault name</label>
          <input
            type="text"
            value={vaultName}
            onChange={e => setVaultName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && selectedPath && vaultName.trim()) handleCreateVault(); }}
            placeholder="My Notes"
            autoFocus
            style={{ width: '100%', padding: '11px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }}
          />
        </div>

        {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' }}>{error}</p>}

        <button
          onClick={handleCreateVault}
          disabled={!selectedPath || !vaultName.trim() || isLoading}
          style={{ width: '100%', padding: '12px 20px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: selectedPath && vaultName.trim() && !isLoading ? 'pointer' : 'not-allowed', opacity: selectedPath && vaultName.trim() && !isLoading ? 1 : 0.5 }}
        >
          {isLoading ? 'Creating…' : 'Create Vault'}
        </button>
      </div>
    </div>
  );
};
