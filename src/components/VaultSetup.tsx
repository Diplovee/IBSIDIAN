import React, { useState } from 'react';
import { FolderOpen, Home, FileText, Download, Folder, ChevronRight } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useModal } from './Modal';

interface FolderOption {
  name: string;
  path: string;
  icon: React.ReactNode;
}

const commonFolders: FolderOption[] = [
  { name: 'Home', path: '/home/diplov', icon: <Home size={20} /> },
  { name: 'Documents', path: '/home/diplov/Documents', icon: <FileText size={20} /> },
  { name: 'Downloads', path: '/home/diplov/Downloads', icon: <Download size={20} /> },
  { name: 'Desktop', path: '/home/diplov/Desktop', icon: <Folder size={20} /> },
];

export const VaultSetup: React.FC = () => {
  const { setActiveVault } = useVault();
  const { confirm } = useModal();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [vaultName, setVaultName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectFolder = (path: string) => {
    setSelectedPath(path);
    setMode('create');
  };

  const handleCreateVault = async () => {
    if (!selectedPath) {
      await confirm({
        title: 'Error',
        message: 'Please select a folder.',
        confirmLabel: 'OK',
        cancelLabel: ''
      });
      return;
    }

    if (!vaultName.trim()) {
      await confirm({
        title: 'Error',
        message: 'Please enter a vault name.',
        confirmLabel: 'OK',
        cancelLabel: ''
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: vaultName, path: selectedPath })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create vault');
      }

      const vault = await response.json();
      setActiveVault(vault);
    } catch (err) {
      await confirm({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to create vault. Please try again.',
        confirmLabel: 'OK',
        cancelLabel: ''
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 20 }}>
      <div style={{ width: 640, maxWidth: '100%' }}>
        {/* Header with Icon and Version */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)'
          }}>
            <span style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>I</span>
          </div>
          <div>
            <h1 style={{ 
              fontSize: 28, 
              fontWeight: 700, 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.5px'
            }}>
              Ibsidian
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Version 2026.4.1
            </p>
          </div>
        </div>

        <p style={{ 
          textAlign: 'center', 
          color: 'var(--text-secondary)', 
          marginBottom: 24,
          fontSize: 15
        }}>
          Select a folder to use as your vault
        </p>

        {mode === 'select' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {commonFolders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => handleSelectFolder(folder.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 20px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.background = 'var(--accent-soft)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
              >
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)'
                }}>
                  {folder.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {folder.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {folder.path}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            ))}
          </div>
        ) : (
          <div style={{ 
            padding: 24, 
            borderRadius: 12, 
            border: '1px solid var(--border)', 
            background: 'var(--bg-secondary)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderOpen size={20} color="var(--accent)" />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Selected folder</span>
              </div>
              <button
                onClick={() => { setMode('select'); setSelectedPath(null); }}
                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Change
              </button>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              padding: 12, 
              borderRadius: 8, 
              background: 'var(--bg-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--text-primary)'
            }}>
              {selectedPath}
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div style={{ marginTop: 24 }}>
            <label style={{ 
              display: 'block', 
              fontSize: 14, 
              fontWeight: 500, 
              color: 'var(--text-secondary)', 
              marginBottom: 8 
            }}>
              Vault name
            </label>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="My Notes"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'var(--font-sans)'
              }}
            />
          </div>
        )}

        {mode === 'create' && (
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              onClick={() => { setMode('select'); setSelectedPath(null); }}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                fontSize: 14,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)'
              }}
            >
              Back
            </button>
            <button
              onClick={handleCreateVault}
              disabled={!vaultName.trim() || isLoading}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: 'white',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: vaultName.trim() && !isLoading ? 'pointer' : 'not-allowed',
                opacity: vaultName.trim() && !isLoading ? 1 : 0.5,
                fontFamily: 'var(--font-sans)'
              }}
            >
              {isLoading ? 'Creating...' : 'Create Vault'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};