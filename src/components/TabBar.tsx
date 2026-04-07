import React from 'react';
import { X, Plus, FileText, Globe, PenLine, SquareTerminal } from 'lucide-react';
import { useTabs } from '../contexts/TabsContext';
import { TabType } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, openTab } = useTabs();

  const getIcon = (type: TabType) => {
    switch (type) {
      case 'note': return <FileText size={14} />;
      case 'browser': return <Globe size={14} />;
      case 'draw': return <PenLine size={14} />;
      case 'terminal': return <SquareTerminal size={14} />;
      default: return <FileText size={14} />;
    }
  };

  return (
    <div className="h-[44px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center overflow-x-auto no-scrollbar z-30">
      <div className="flex h-full">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
              "h-full flex items-center gap-2 px-4 min-w-[140px] max-w-[240px] cursor-pointer border-r border-[var(--border)] transition-all duration-150 group",
              activeTabId === tab.id 
                ? "bg-[var(--bg-primary)] border-b-2 border-b-[var(--accent)] text-[var(--text-primary)]" 
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            )}
          >
            <span className={activeTabId === tab.id ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>
              {getIcon(tab.type)}
            </span>
            <span className="text-[var(--text-sm)] font-medium truncate flex-1">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "p-1 rounded-sm hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors",
                activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      
      <button 
        onClick={() => openTab({ type: 'note', title: 'Untitled', filePath: 'untitled.md' })}
        className="h-full px-4 flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors border-r border-[var(--border)]"
      >
        <Plus size={18} />
      </button>
    </div>
  );
};
