import React, { useState } from 'react';
import { Tree } from 'react-arborist';
import { Folder, FileText, PenLine, ChevronRight, ChevronDown, Plus, FolderPlus, Search as SearchIcon, Sun, Moon } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { VaultNode } from '../types';

export const SidePanel: React.FC = () => {
  const { activeActivity } = useActivity();

  return (
    <div className="h-full w-full bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col overflow-hidden">
      {activeActivity === 'files' && <FileTreeView />}
      {activeActivity === 'search' && <SearchView />}
      {activeActivity === 'settings' && <SettingsView />}
    </div>
  );
};

const FileTreeView: React.FC = () => {
  const { nodes, createFile, createFolder } = useVault();
  const { openTab } = useTabs();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState<{ width: number; height: number } | null>(null);
  const [headerHeight] = React.useState(40);

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    
    // Initial call
    updateDimensions();

    return () => observer.disconnect();
  }, []);

  const handleSelect = (node: any) => {
    if (node.data.type === 'file') {
      openTab({
        type: node.data.ext === 'md' ? 'note' : 'draw',
        title: node.data.name,
        filePath: node.data.id,
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full" ref={containerRef}>
      <div className="px-3 py-2 flex items-center justify-between border-b border-[var(--border)] shrink-0" style={{ height: headerHeight }}>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Files</span>
        <div className="flex gap-0.5">
          <button
            onClick={() => {
              const id = createFile(null, 'Untitled', 'md');
              openTab({ type: 'note', title: 'Untitled', filePath: id });
            }}
            title="New note"
            className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => createFolder(null, 'New Folder')}
            title="New folder"
            className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden py-1">
        {dimensions && (
          <Tree
            data={nodes}
            openByDefault={true}
            width={dimensions.width}
            height={dimensions.height - headerHeight}
            indent={16}
            rowHeight={28}
            onSelect={(nodes) => {
              if (nodes.length > 0) handleSelect(nodes[0]);
            }}
          >
            {Node}
          </Tree>
        )}
      </div>
    </div>
  );
};

const Node = ({ node, style, dragHandle }: any) => {
  const [hovered, setHovered] = React.useState(false);
  const Icon = node.data.type === 'folder' ? Folder : node.data.ext === 'excalidraw' ? PenLine : FileText;

  return (
    <div
      style={{
        ...style,
        display: 'flex', alignItems: 'center', gap: 6,
        paddingLeft: 12, paddingRight: 8,
        cursor: 'pointer',
        background: node.isSelected ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        color: node.isSelected ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: node.isSelected ? 500 : 400,
        fontSize: 13,
        transition: 'background 0.1s',
      }}
      ref={dragHandle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => node.isInternal && node.toggle()}
    >
      {node.data.type === 'folder' && (
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {node.isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      )}
      <Icon size={13} style={{ flexShrink: 0, color: node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)' }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.data.name}</span>
    </div>
  );
};

const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  return (
    <div className="flex flex-col h-full p-4">
      <div className="relative mb-4">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input 
          type="text" 
          placeholder="Search vault..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md py-1.5 pl-9 pr-3 text-[var(--text-sm)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          autoFocus
        />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] text-[var(--text-xs)]">
        <p>No results found</p>
      </div>
    </div>
  );
};

const SettingsView: React.FC = () => {
  const { theme, setTheme } = useActivity();

  return (
    <div className="flex flex-col h-full p-4">
      <h3 className="text-[13px] font-semibold mb-4 text-[var(--text-primary)]">Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] text-[var(--text-muted)] block mb-2 uppercase tracking-wider">Appearance</label>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                theme === 'light'
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Sun size={13} /> Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                theme === 'dark'
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Moon size={13} /> Dark
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
