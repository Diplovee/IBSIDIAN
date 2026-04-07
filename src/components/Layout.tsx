import React, { useState, useCallback } from 'react';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { SidePanel } from './SidePanel';
import { TabBar } from './TabBar';
import { Canvas } from './Canvas';
import { CommandPalette } from './CommandPalette';
import { VaultSetup } from './VaultSetup';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';

const SIDEBAR_KEY = 'ibsidian-sidebar-width';
const DEFAULT_WIDTH = 240;

export const Layout: React.FC = () => {
  const { isSidebarCollapsed } = useActivity();
  const { vault } = useVault();
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
      {!vault ? (
        <VaultSetup />
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
