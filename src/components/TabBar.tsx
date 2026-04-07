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
    <div className="h-[36px] bg-[var(--bg-secondary)] flex items-stretch overflow-x-auto no-scrollbar z-30 border-b border-[var(--border)]">
      <div className="flex h-full">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            style={{ paddingLeft: 14, paddingRight: 10, gap: 8, minWidth: 120, maxWidth: 200 }}
            className={cn(
              "h-full flex items-center cursor-pointer border-r border-[var(--border)] transition-colors duration-100 group relative",
              activeTabId === tab.id
                ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
            )}
          >
            <span style={{ flexShrink: 0 }} className={activeTabId === tab.id ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}>
              {getIcon(tab.type)}
            </span>
            <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              style={{ width: 16, height: 16, flexShrink: 0 }}
              className={cn(
                "flex items-center justify-center rounded-sm hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors",
                activeTabId === tab.id ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100"
              )}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => openTab({ type: 'note', title: 'Untitled', filePath: 'untitled.md' })}
        className="ml-auto mr-2 my-1 px-2 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] active:bg-[var(--bg-active)] transition-colors"
        style={{ height: 'calc(100% - 8px)' }}
      >
        <Plus size={16} />
      </button>
    </div>
  );
};
