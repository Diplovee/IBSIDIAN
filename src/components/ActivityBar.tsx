import React from 'react';
import { FolderOpen, Search, Globe, SquareTerminal, Settings } from 'lucide-react';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { useActivity } from '../contexts/ActivityContext';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';

export const ActivityBar: React.FC = () => {
  const { activeActivity, toggleActivity, isSettingsOpen, openSettings } = useActivity();
  const { openTab } = useTabs();
  const { createFileRemote, refreshFileTree, nextUntitledName } = useVault();

  const handleOpenBrowser = () => openTab({ type: 'browser', title: 'New Tab', url: 'https://www.google.com' });
  const handleOpenDraw = () => {
    const name = nextUntitledName();
    createFileRemote('', name, 'excalidraw').then(() => {
      refreshFileTree();
      openTab({ type: 'draw', title: name, filePath: `${name}.excalidraw` });
    });
  };
  const handleOpenTerminal = () => openTab({ type: 'terminal', title: 'Terminal' });

  return (
    <div style={{ width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 8, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', zIndex: 50, flexShrink: 0, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
        <ActivityButton icon={<FolderOpen size={18} />} active={activeActivity === 'files'} onClick={() => toggleActivity('files')} />
        <ActivityButton icon={<Search size={18} />} active={activeActivity === 'search'} onClick={() => toggleActivity('search')} />
        <div style={{ width: 24, height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <ActivityButton icon={<Globe size={18} />} onClick={handleOpenBrowser} />
        <ActivityButton icon={<ExcalidrawIcon size={18} />} onClick={handleOpenDraw} />
        <ActivityButton icon={<SquareTerminal size={18} />} onClick={handleOpenTerminal} />
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <ActivityButton icon={<Settings size={18} />} active={isSettingsOpen} onClick={openSettings} />
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
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', border: 'none', outline: 'none',
        background: hovered && !active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'color 0.1s, background 0.1s',
      }}
    >
      {active && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--accent)' }} />}
      {icon}
    </button>
  );
};
