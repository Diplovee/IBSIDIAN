import React, { useState } from 'react';
import { Tree } from 'react-arborist';
import { Folder, FileText, PenLine, ChevronRight, ChevronDown, Plus, FolderPlus, Search as SearchIcon } from 'lucide-react';
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
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)] shrink-0">
        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Vault</span>
        <div className="flex gap-1">
          <button 
            onClick={() => createFile(null, 'Untitled', 'md')}
            className="p-1 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Plus size={14} />
          </button>
          <button 
            onClick={() => createFolder(null, 'New Folder')}
            className="p-1 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden py-2">
        {dimensions && (
          <Tree
            initialData={nodes}
            openByDefault={true}
            width={dimensions.width}
            height={dimensions.height - 48} // Subtracting header height
            indent={24}
            rowHeight={34}
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
  const Icon = node.data.type === 'folder' 
    ? Folder 
    : node.data.ext === 'excalidraw' 
      ? PenLine 
      : FileText;

  return (
    <div 
      style={style} 
      ref={dragHandle}
      className={`flex items-center gap-1.5 px-4 cursor-pointer group hover:bg-[var(--bg-hover)] transition-colors ${node.isSelected ? 'bg-[var(--bg-active)] text-[var(--accent)] font-medium' : 'text-[var(--text-secondary)]'}`}
      onClick={() => node.isInternal && node.toggle()}
    >
      {node.data.type === 'folder' && (
        <span className="text-[var(--text-muted)]">
          {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      )}
      <Icon size={14} className={node.isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'} />
      <span className="text-[var(--text-sm)] truncate flex-1">{node.data.name}</span>
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
  return (
    <div className="flex flex-col h-full p-4">
      <h3 className="text-[var(--text-sm)] font-semibold mb-4">Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="text-[var(--text-xs)] text-[var(--text-muted)] block mb-1 uppercase tracking-wider">Theme</label>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-[var(--bg-active)] border border-[var(--accent)] text-[var(--accent)] rounded-md text-[var(--text-xs)] font-medium">Light</button>
            <button className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] rounded-md text-[var(--text-xs)] font-medium">Dark (Soon)</button>
          </div>
        </div>
      </div>
    </div>
  );
};
