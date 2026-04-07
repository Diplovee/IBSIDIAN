import React, { useState } from 'react';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useModal } from './Modal';

export const VaultSetup: React.FC = () => {
  const { setActiveVault } = useVault();
  const { confirm } = useModal();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
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
      const vault = await window.api.vault.create(vaultName.trim(), selectedPath);
      setActiveVault(vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 20 }}>
      <div style={{ width: 480, maxWidth: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
            <span style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>I</span>
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Ibsidian</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Version 2026.5.0</p>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 28, fontSize: 15 }}>
          Create a vault to get started
        </p>

        {/* Folder picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Location</label>
          <button
            onClick={handlePickFolder}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left' }}
          >
            <FolderOpen size={16} color="var(--accent)" />
            <span style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-mono)', color: selectedPath ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedPath ?? 'Choose folder…'}
            </span>
          </button>
        </div>

        {/* Vault name */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Vault name</label>
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
          style={{ width: '100%', padding: '13px 20px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: selectedPath && vaultName.trim() && !isLoading ? 'pointer' : 'not-allowed', opacity: selectedPath && vaultName.trim() && !isLoading ? 1 : 0.5 }}
        >
          {isLoading ? 'Creating…' : 'Create Vault'}
        </button>
      </div>
    </div>
  );
};