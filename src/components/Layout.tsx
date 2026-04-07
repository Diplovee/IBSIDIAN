import React from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { SidePanel } from './SidePanel';
import { TabBar } from './TabBar';
import { Canvas } from './Canvas';
import { CommandPalette } from './CommandPalette';
import { useActivity } from '../contexts/ActivityContext';

export const Layout: React.FC = () => {
  const { isSidebarCollapsed } = useActivity();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary)]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <div className="flex-1 overflow-hidden">
          <Group orientation="horizontal">
            {!isSidebarCollapsed && (
              <>
                <Panel defaultSize={25} minSize={15} maxSize={80}>
                  <SidePanel />
                </Panel>
                <Separator className="w-1 group relative bg-transparent cursor-col-resize">
                  <div className="absolute inset-y-0 left-1/2 w-[1px] -translate-x-1/2 bg-[var(--border)] group-hover:bg-[var(--accent)] transition-colors" />
                </Separator>
              </>
            )}
            <Panel>
              <div className="flex flex-col h-full overflow-hidden">
                <TabBar />
                <Canvas />
              </div>
            </Panel>
          </Group>
        </div>
      </div>
      <CommandPalette />
    </div>
  );
};
