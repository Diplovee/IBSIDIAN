import React from 'react';
import { Sidebar, Settings, MoreHorizontal } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';

export const TopBar: React.FC = () => {
  const { isSidebarCollapsed, setSidebarCollapsed } = useActivity();

  return (
    <div className="h-[44px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between px-3 z-40 shrink-0">
      <div className="flex items-center gap-2" style={{ paddingLeft: 6 }}>
        <div className="w-5 h-5 rounded-[4px] flex items-center justify-center text-white text-[13px] font-bold shrink-0 select-none" style={{ backgroundColor: '#7c3aed' }}>
          I
        </div>
        <span className="font-semibold text-[14px] text-[var(--text-primary)] tracking-tight">Ibsidian</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Sidebar size={16} />
        </button>
        <button className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <Settings size={16} />
        </button>
        <button className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
};
