import React, { useState, useCallback } from 'react';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { SidePanel } from './SidePanel';
import { TabBar } from './TabBar';
import { Canvas } from './Canvas';
import { CommandPalette } from './CommandPalette';
import { useActivity } from '../contexts/ActivityContext';

export const Layout: React.FC = () => {
  const { isSidebarCollapsed } = useActivity();
  const [sidebarWidth, setSidebarWidth] = useState(300);

  const handleResize = useCallback((e: MouseEvent) => {
    const newWidth = e.clientX - 48; // Account for ActivityBar width
    setSidebarWidth(Math.max(200, Math.min(newWidth, 600)));
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
              className="w-1 cursor-col-resize hover:bg-[var(--accent)] transition-colors shrink-0"
            />
          </>
        )}
        <div className="flex-1 overflow-hidden flex flex-col">
          <TabBar />
          <Canvas />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
};
