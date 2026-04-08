import React, { useState, useCallback } from 'react';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { SidePanel } from './SidePanel';
import { TabBar } from './TabBar';
import { Canvas } from './Canvas';
import { CommandPalette } from './CommandPalette';
import { VaultSetup } from './VaultSetup';
import { LoadingScreen } from './LoadingScreen';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';
import { FolderX } from 'lucide-react';

const SIDEBAR_KEY = 'ibsidian-sidebar-width';
const DEFAULT_WIDTH = 240;

export const Layout: React.FC = () => {
  const { isSidebarCollapsed } = useActivity();
  const { vault, isReady, error, clearActiveVault, refreshFileTree } = useVault();
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const vaultMissing = !!error && error.includes('not found');

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setRetryFailed(false);
    try {
      await refreshFileTree();
      // If refreshFileTree throws or error stays, we detect below
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  }, [refreshFileTree]);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    return saved ? Math.max(160, Math.min(Number(saved), 600)) : DEFAULT_WIDTH;
  });

  const handleResize = useCallback((e: MouseEvent) => {
    const newWidth = Math.max(160, Math.min(e.clientX - 44, 600));
    setSidebarWidth(newWidth);
    localStorage.setItem(SIDEBAR_KEY, String(newWidth));
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMouseMove = (e: MouseEvent) => handleResize(e);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [handleResize]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary)]">
      {!isReady ? (
        <LoadingScreen />
      ) : !vault ? (
        <VaultSetup />
      ) : vaultMissing || retrying ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-primary)', padding: 40 }}>
          <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
          {retrying ? (
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: '_spin 0.8s linear infinite' }} />
          ) : (
            <FolderX size={48} color="var(--text-muted)" strokeWidth={1.5} />
          )}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              {retrying ? 'Checking vault…' : 'Vault folder not found'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              {retrying
                ? 'Trying to reach the vault folder, please wait.'
                : <>The folder <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{vault.path}</code> no longer exists.</>}
            </p>
            {retryFailed && (
              <p style={{ fontSize: 13, color: '#ef4444', marginTop: 10 }}>Still can't find the folder. It may have been moved or deleted.</p>
            )}
          </div>
          {!retrying && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleRetry}
                style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                Retry
              </button>
              <button
                onClick={clearActiveVault}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                Create new vault
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <TopBar />
          <div className="flex flex-1 overflow-hidden">
            <ActivityBar />
            {!isSidebarCollapsed && (
              <>
                <div style={{ width: sidebarWidth, minWidth: 200, maxWidth: 600 }} className="shrink-0">
                  <SidePanel />
                </div>
                <div
                  onMouseDown={startResize}
                  style={{ width: 4, cursor: 'col-resize', flexShrink: 0, background: 'transparent', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                />
              </>
            )}
            <div className="flex-1 overflow-hidden flex flex-col">
              <TabBar />
              <Canvas />
            </div>
          </div>
        </>
      )}
      <CommandPalette />
    </div>
  );
};
