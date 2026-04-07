import React from 'react';
import { Sidebar, Settings, MoreHorizontal } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';

export const TopBar: React.FC = () => {
  const { isSidebarCollapsed, setSidebarCollapsed } = useActivity();

  return (
    <div className="h-[48px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between px-4 shadow-sm z-40">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 bg-[var(--accent)] rounded-sm flex items-center justify-center text-white text-[12px] font-bold">
          I
        </div>
        <span className="font-bold text-[var(--text-lg)] tracking-tight">Ibsidian</span>
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
        >
          <Sidebar size={18} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
          <Settings size={18} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </div>
  );
};
