import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { SidePanel } from './SidePanel';
import { Canvas } from './Canvas';
import { CommandPalette } from './CommandPalette';
import { SettingsModal } from './SettingsModal';
import { FileSwitcher } from './FileSwitcher';
import { VaultSetup } from './VaultSetup';
import { LoadingScreen } from './LoadingScreen';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import type { BrowserTabGroup, Pane, Tab } from '../types';
import { FolderX } from 'lucide-react';

const SIDEBAR_KEY = 'ibsidian-sidebar-width';
const DEFAULT_WIDTH = 240;
const TABS_KEY_PREFIX = 'ibsidian-tabs:';
const UPDATE_AVAILABLE_KEY = 'ibsidian:update-available';

export const Layout: React.FC = () => {
  const { isSidebarCollapsed } = useActivity();
  const { vault, isReady, error, clearActiveVault, refreshFileTree } = useVault();
  const { tabs, activeTabId, restoreTabs, browserGroups, panes, activePaneId, paneSizes, splitDirection } = useTabs();
  const hydratedTabsKeyRef = useRef<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const updateCheckedRef = useRef(false);
  const vaultMissing = !!error && error.includes('not found');

  const tabsStorageKey = vault ? `${TABS_KEY_PREFIX}${vault.path}` : null;

  useEffect(() => {
    if (!vault || !tabsStorageKey) {
      hydratedTabsKeyRef.current = null;
      restoreTabs([], null, []);
      return;
    }

    try {
      const saved = localStorage.getItem(tabsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { tabs?: Tab[]; activeTabId?: string | null; browserGroups?: BrowserTabGroup[]; panes?: Pane[]; activePaneId?: string; paneSizes?: number[]; splitDirection?: 'horizontal' | 'vertical' | 'right-stack' | 'left-stack' };
        const savedTabs = Array.isArray(parsed.tabs)
          ? parsed.tabs.filter(tab => tab && typeof tab.id === 'string' && typeof tab.type === 'string' && typeof tab.title === 'string')
          : [];
        const savedGroups = Array.isArray(parsed.browserGroups)
          ? parsed.browserGroups.filter(group => group && typeof group.id === 'string' && typeof group.name === 'string' && typeof group.color === 'string')
          : [];
        const savedPanes = Array.isArray(parsed.panes)
          ? parsed.panes.filter(pane => pane && typeof pane.id === 'string' && (typeof pane.activeTabId === 'string' || pane.activeTabId === null))
          : [{ id: 'main', activeTabId: null }];
        const savedActivePaneId = typeof parsed.activePaneId === 'string' ? parsed.activePaneId : 'main';
        const savedPaneSizes = Array.isArray(parsed.paneSizes)
          ? parsed.paneSizes.filter(size => typeof size === 'number' && Number.isFinite(size) && size > 0)
          : [1];
        const savedSplitDirection = parsed.splitDirection === 'vertical' || parsed.splitDirection === 'right-stack' || parsed.splitDirection === 'left-stack'
          ? parsed.splitDirection
          : 'horizontal';
        restoreTabs(savedTabs, typeof parsed.activeTabId === 'string' ? parsed.activeTabId : null, savedGroups, savedPanes, savedActivePaneId, savedPaneSizes, savedSplitDirection);
      } else {
        restoreTabs([], null, []);
      }
    } catch {
      restoreTabs([], null, []);
    }

    hydratedTabsKeyRef.current = tabsStorageKey;
  }, [tabsStorageKey, vault, restoreTabs]);

  useEffect(() => {
    if (!tabsStorageKey || hydratedTabsKeyRef.current !== tabsStorageKey) return;
    localStorage.setItem(tabsStorageKey, JSON.stringify({ tabs, activeTabId, browserGroups, panes, activePaneId, paneSizes, splitDirection }));
  }, [tabsStorageKey, tabs, activeTabId, browserGroups, panes, activePaneId, paneSizes, splitDirection]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setRetryFailed(false);
    const [result] = await Promise.allSettled([
      refreshFileTree(),
      new Promise(r => setTimeout(r, 1500)),
    ]);
    if (result.status === 'rejected') setRetryFailed(true);
    setRetrying(false);
  }, [refreshFileTree]);

  useEffect(() => {
    if (!isReady || updateCheckedRef.current) return;
    updateCheckedRef.current = true;

    const runUpdateCheck = async () => {
      try {
        const check = await window.api.app.checkForUpdates();
        if (!check.supported || !check.updateAvailable) {
          localStorage.setItem(UPDATE_AVAILABLE_KEY, 'false');
          window.dispatchEvent(new CustomEvent('ibsidian:update-status-changed'));
          return;
        }

        localStorage.setItem(UPDATE_AVAILABLE_KEY, 'true');
        window.dispatchEvent(new CustomEvent('ibsidian:update-status-changed'));

        const shouldUpdate = window.confirm('Ibsidian update available. Update now?');
        if (!shouldUpdate) return;

        const result = await window.api.app.applyUpdate();
        window.alert(result.message);
        if (result.ok) {
          localStorage.setItem(UPDATE_AVAILABLE_KEY, 'false');
          window.dispatchEvent(new CustomEvent('ibsidian:update-status-changed'));
          const shouldRestart = window.confirm('Update installed. Restart now?');
          if (shouldRestart) await window.api.app.restart();
        }
      } catch (error) {
        console.warn('Update check failed', error);
      }
    };

    void runUpdateCheck();
  }, [isReady]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-primary)' }}>
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
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <ActivityBar />
            {!isSidebarCollapsed && (
              <>
                <div style={{ width: sidebarWidth, minWidth: 200, maxWidth: 600, flexShrink: 0 }}>
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
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Canvas />
            </div>
          </div>
        </>
      )}
      <SettingsModal />
      <CommandPalette />
      <FileSwitcher />
    </div>
  );
};
