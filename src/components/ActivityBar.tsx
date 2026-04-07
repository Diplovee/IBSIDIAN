import React from 'react';
import { FolderOpen, Search, Globe, PenLine, SquareTerminal, Settings } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useTabs } from '../contexts/TabsContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ActivityBar: React.FC = () => {
  const { activeActivity, toggleActivity } = useActivity();
  const { openTab } = useTabs();

  const handleOpenBrowser = () => openTab({ type: 'browser', title: 'New Tab', url: 'https://www.google.com' });
  const handleOpenDraw = () => openTab({ type: 'draw', title: 'Untitled Drawing', filePath: 'drawing.excalidraw' });
  const handleOpenTerminal = () => openTab({ type: 'terminal', title: 'Terminal' });

  return (
    <div className="w-[48px] h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col items-center py-3 z-50">
      <div className="flex flex-col gap-2 w-full items-center">
        <ActivityButton 
          icon={<FolderOpen size={20} />} 
          active={activeActivity === 'files'} 
          onClick={() => toggleActivity('files')} 
        />
        <ActivityButton 
          icon={<Search size={20} />} 
          active={activeActivity === 'search'} 
          onClick={() => toggleActivity('search')} 
        />
        <div className="w-8 h-[1px] bg-[var(--border)] my-2" />
        <ActivityButton 
          icon={<Globe size={20} />} 
          onClick={handleOpenBrowser} 
        />
        <ActivityButton 
          icon={<PenLine size={20} />} 
          onClick={handleOpenDraw} 
        />
        <ActivityButton 
          icon={<SquareTerminal size={20} />} 
          onClick={handleOpenTerminal} 
        />
      </div>

      <div className="mt-auto flex flex-col items-center w-full">
        <ActivityButton 
          icon={<Settings size={20} />} 
          active={activeActivity === 'settings'} 
          onClick={() => toggleActivity('settings')} 
        />
      </div>
    </div>
  );
};

interface ActivityButtonProps {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

const ActivityButton: React.FC<ActivityButtonProps> = ({ icon, active, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-150 relative",
        "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        active && "text-[var(--accent)]"
      )}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--accent)]" />}
      {icon}
    </button>
  );
};
