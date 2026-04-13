import React, { useEffect, useState } from 'react';
import { FolderOpen, Search, Globe, SquareTerminal, Settings, Library as LibraryIcon } from 'lucide-react';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { ClaudeIcon, CodexIcon, PiIcon, ProductivityIcon } from './AgentIcons';
import { useActivity } from '../contexts/ActivityContext';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { LibraryModal } from './LibraryModal';
import type { AgentKey } from '../types';

const AGENT_META: Record<AgentKey, { icon: React.ReactNode; title: string; command?: string }> = {
  claude:       { icon: <ClaudeIcon size={18} />,       title: 'Claude',       command: 'claude\n' },
  codex:        { icon: <CodexIcon size={18} />,        title: 'Codex',        command: 'codex\n'  },
  pi:           { icon: <PiIcon size={18} />,           title: 'Pi',           command: 'pi\n'     },
  productivity: { icon: <ProductivityIcon size={18} />, title: 'Productivity'                      },
};

const PRODUCTIVITY_CODEX_MODELS = [
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
] as const;
const DEFAULT_PRODUCTIVITY_CODEX_MODEL = 'gpt-5.2';

const normalizeProductivityCodexModel = (model: string | null | undefined) => {
  if (PRODUCTIVITY_CODEX_MODELS.some(option => option.id === model)) return model as string;
  return DEFAULT_PRODUCTIVITY_CODEX_MODEL;
};

export const ActivityBar: React.FC = () => {
  const { activeActivity, toggleActivity, isSettingsOpen, openSettings } = useActivity();
  const { openTab } = useTabs();
  const { createFileRemote, refreshFileTree, nextUntitledName } = useVault();
  const { settings } = useAppSettings();
  const [showLibrary, setShowLibrary] = useState(false);
  const [codexModelMenu, setCodexModelMenu] = useState<{ x: number; y: number; selectedModel: string } | null>(null);
  const agents = settings.agents ?? { claude: true, codex: true, pi: true, productivity: true, order: ['claude', 'codex', 'pi', 'productivity'] as AgentKey[] };
  const order: AgentKey[] = agents.order?.length ? agents.order : ['claude', 'codex', 'pi', 'productivity'];

  const handleOpenBrowser = () => openTab({ type: 'browser', title: 'New Tab', url: 'about:blank', groupId: '' });
  const handleOpenDraw = () => {
    const name = nextUntitledName();
    createFileRemote('', name, 'excalidraw').then(() => {
      refreshFileTree(undefined, { showLoading: false });
      openTab({ type: 'draw', title: name, filePath: `${name}.excalidraw` });
    });
  };
  const handleOpenTerminal = () => openTab({ type: 'terminal', title: 'Terminal' });

  const launchCodexWithModel = (model: string) => {
    const selectedModel = normalizeProductivityCodexModel(model);
    localStorage.setItem('productivity-model', selectedModel);
    openTab({ type: 'codex', title: `Codex (${selectedModel})`, command: `codex -m ${selectedModel}\n` });
  };

  useEffect(() => {
    if (!codexModelMenu) return;
    const close = () => setCodexModelMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [codexModelMenu]);

  return (
    <>
      <div style={{ width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 8, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', zIndex: 50, flexShrink: 0, height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
          <ActivityButton icon={<FolderOpen size={18} />} active={activeActivity === 'files'} onClick={() => toggleActivity('files')} />
          <ActivityButton icon={<Search size={18} />} active={activeActivity === 'search'} onClick={() => toggleActivity('search')} />
          <div style={{ width: 24, height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <ActivityButton icon={<Globe size={18} />} onClick={handleOpenBrowser} />
          <ActivityButton icon={<ExcalidrawIcon size={18} />} onClick={handleOpenDraw} />
          <ActivityButton icon={<SquareTerminal size={18} />} onClick={handleOpenTerminal} />
          {order.filter(k => agents[k]).map(key => {
            const a = AGENT_META[key];
            if (key === 'codex') {
              return (
                <ActivityButton
                  key={key}
                  icon={a.icon}
                  title="Codex (right-click for model)"
                  onClick={() => openTab({ type: key, title: a.title, command: a.command })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCodexModelMenu({
                      x: e.clientX,
                      y: e.clientY,
                      selectedModel: normalizeProductivityCodexModel(localStorage.getItem('productivity-model')),
                    });
                  }}
                />
              );
            }
            return (
              <ActivityButton
                key={key}
                icon={a.icon}
                title={a.title}
                onClick={() => openTab({ type: key, title: a.title, command: a.command })}
              />
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <ActivityButton icon={<LibraryIcon size={18} />} onClick={() => setShowLibrary(true)} />
          <ActivityButton icon={<Settings size={18} />} active={isSettingsOpen} onClick={openSettings} />
        </div>
      </div>
      {codexModelMenu && (
        <div
          style={{
            position: 'fixed',
            left: codexModelMenu.x,
            top: codexModelMenu.y,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-md)',
            zIndex: 1000,
            padding: 4,
            minWidth: 220,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {PRODUCTIVITY_CODEX_MODELS.map(model => (
            <button
              key={model.id}
              onClick={() => {
                launchCodexWithModel(model.id);
                setCodexModelMenu(null);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{model.label}</span>
              {codexModelMenu.selectedModel === model.id && <span style={{ color: 'var(--accent)', fontSize: 12 }}>Selected</span>}
            </button>
          ))}
        </div>
      )}
      {showLibrary && <LibraryModal onClose={() => setShowLibrary(false)} />}
    </>
  );
};

interface ActivityButtonProps {
  icon: React.ReactNode;
  active?: boolean;
  title?: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const ActivityButton: React.FC<ActivityButtonProps> = ({ icon, active, title, onClick, onContextMenu }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
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
