import React from 'react';
import { Sidebar, Settings, MoreHorizontal } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';

export const TopBar: React.FC = () => {
  const { isSidebarCollapsed, setSidebarCollapsed } = useActivity();

  return (
    <div className="h-[48px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between px-4 shadow-sm z-40">
      <div className="flex items-center gap-3 select-none">
        {/* Icon */}
        <svg className="w-6 h-6 shrink-0" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="4" fill="#705dcf"/>
          <text x="16" y="23" fontFamily="Plus Jakarta Sans, system-ui, sans-serif" fontSize="20" fontWeight="700" fill="white" textAnchor="middle">I</text>
        </svg>
        <span className="font-bold text-[var(--text-lg)] tracking-tight select-none">Ibsidian</span>
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
