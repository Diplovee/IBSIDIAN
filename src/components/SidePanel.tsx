import React, { useState, useEffect, useRef } from 'react';
import { Tree } from 'react-arborist';
import {
  Folder, FileText, ChevronRight, ChevronDown, FolderPlus,
  Search as SearchIcon, Sun, Moon, FilePen, ArrowUpNarrowWide, LayoutList,
  ChevronsUpDown, FilePlus2, PanelRight, ExternalLink, Copy, FolderInput,
  Bookmark, GitMerge, History, ArrowUpRight, Pencil, Trash2, ChevronRight as Arrow, SlidersHorizontal,
} from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { useModal } from './Modal';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { VaultNode } from '../types';

// ── Shared context so Node (outside FileTreeView) can trigger actions ─────
interface TreeCtx {
  openContextMenu: (e: React.MouseEvent, data: VaultNode) => void;
  openTab: (opts: any) => void;
}
const TreeContext = React.createContext<TreeCtx>({ openContextMenu: () => {}, openTab: () => {} });

// ── SidePanel shell ───────────────────────────────────────────────────────
export const SidePanel: React.FC = () => {
  const { activeActivity } = useActivity();
  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {activeActivity === 'files'    && <FileTreeView />}
      {activeActivity === 'search'   && <SearchView />}
    </div>
  );
};

// ── Sidebar icon button ───────────────────────────────────────────────────
const SidebarBtn: React.FC<{ icon: React.ReactNode; title: string; onClick?: () => void; active?: boolean }> = ({ icon, title, onClick, active }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent', color: active || hovered ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'background 0.1s, color 0.1s' }}
    >{icon}</button>
  );
};

// ── Context menu ──────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; node: VaultNode }

const CtxMenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; hasArrow?: boolean }> =
  ({ icon, label, onClick, disabled, danger, hasArrow }) => {
    const [h, setH] = useState(false);
    return (
      <button onClick={!disabled ? onClick : undefined}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 12, paddingTop: 6, paddingBottom: 6, border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 13, textAlign: 'left', opacity: disabled ? 0.4 : 1, background: h && !disabled ? 'var(--bg-hover)' : 'transparent', color: danger ? '#ef4444' : 'var(--text-primary)', transition: 'background 0.1s' }}
      >
        <span style={{ flexShrink: 0, color: danger ? '#ef4444' : 'var(--text-muted)' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {hasArrow && <Arrow size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      </button>
    );
  };

const CtxSep = () => <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />;

const ContextMenu: React.FC<{ menu: CtxMenu; onClose: () => void }> = ({ menu, onClose }) => {
  const { deleteItem, renameItem, refreshFileTree } = useVault();
  const { openTab } = useTabs();
  const { confirm, prompt } = useModal();
  const ref = useRef<HTMLDivElement>(null);
  const isFile = menu.node.type === 'file';

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Smart positioning — clamp within viewport
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - height - 8)),
    });
    setVisible(true);
  }, [menu]);

  const act = (fn: () => void) => { fn(); onClose(); };

  return (
    <div ref={ref} style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, minWidth: 200, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', paddingTop: 4, paddingBottom: 4, visibility: visible ? 'visible' : 'hidden' }}>
      {isFile && <CtxMenuItem icon={<FilePlus2 size={14} />} label="Open in new tab" onClick={() => act(() => openTab({ type: (menu.node as any).ext === 'md' ? 'note' : 'draw', title: menu.node.name, filePath: menu.node.id }))} />}
      <CtxSep />
      <CtxMenuItem icon={<Copy size={14} />} label="Copy path" onClick={() => act(() => navigator.clipboard.writeText(menu.node.id).catch(() => {}))} />
      <CtxSep />
      <CtxMenuItem icon={<Pencil size={14} />} label="Rename..." onClick={() => { onClose(); const name = menu.node.name; const isMd = name.endsWith('.md'); const isEx = name.endsWith('.excalidraw'); const ext = isMd ? '.md' : isEx ? '.excalidraw' : ''; const displayName = ext ? name.slice(0, -ext.length) : name; prompt({ title: 'Rename', defaultValue: displayName, placeholder: 'Name', confirmLabel: 'Rename' }).then(n => { if (n) { const newName = ext ? (n.endsWith(ext) ? n : `${n}${ext}`) : n; renameItem(menu.node.id, newName).then(() => refreshFileTree()); } }); }} />
      <CtxMenuItem icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { onClose(); confirm({ title: `Delete "${menu.node.name}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then(ok => { if (ok) deleteItem(menu.node.id).then(() => refreshFileTree()); }); }} />
    </div>
  );
};

// ── File tree ─────────────────────────────────────────────────────────────
const FileTreeView: React.FC = () => {
  const { nodes, createFileRemote, createFolderRemote, moveNode, nextUntitledName, isLoading, error, refreshFileTree } = useVault();
  const { openTab } = useTabs();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const headerHeight = 44;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      if (containerRef.current) setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    });
    obs.observe(containerRef.current);
    if (containerRef.current) setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    return () => obs.disconnect();
  }, []);

  const handleMove = ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
    moveNode(dragIds, parentId, index);
  };

  return (
    <TreeContext.Provider value={{ openContextMenu: (e, data) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, node: data }); }, openTab }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }} ref={containerRef}>
        {/* Header */}
        <div style={{ height: headerHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <SidebarBtn icon={<FilePen size={15} />} title="New note" onClick={() => { const name = nextUntitledName(); createFileRemote('', name, 'md').then(() => { refreshFileTree(); openTab({ type: 'note', title: name, filePath: `${name}.md` }); }); }} />
          <SidebarBtn icon={<ExcalidrawIcon size={15} />} title="New drawing" onClick={() => { const name = nextUntitledName(); createFileRemote('', name, 'excalidraw').then(() => { refreshFileTree(); openTab({ type: 'draw', title: name, filePath: `${name}.excalidraw` }); }); }} />
          <SidebarBtn icon={<FolderPlus size={15} />} title="New folder" onClick={() => createFolderRemote('', 'New Folder').then(() => refreshFileTree())} />
          <SidebarBtn icon={<ArrowUpNarrowWide size={15} />} title="Sort" onClick={() => {}} />
          <SidebarBtn icon={<LayoutList size={15} />} title="Change view" active />
          <SidebarBtn icon={<ChevronsUpDown size={15} />} title="Collapse all" onClick={() => {}} />
        </div>

        {/* Tree / states */}
        <div style={{ flex: 1, overflow: 'hidden', paddingTop: 4 }}>
          {error ? (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, lineHeight: 1.5 }}>{error}</p>
              <button
                onClick={() => refreshFileTree()}
                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <p style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</p>
          ) : dimensions ? (
            <Tree
              data={nodes}
              openByDefault={true}
              width={dimensions.width}
              height={dimensions.height - headerHeight}
              indent={16}
              rowHeight={36}
              onMove={handleMove}
            >
              {TreeNode}
            </Tree>
          ) : null}
        </div>
      </div>

      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </TreeContext.Provider>
  );
};

// ── Markdown icon (custom SVG) ───────────────────────────────────────────────
const MarkdownIcon: React.FC<{ size?: number; color?: string }> = ({ size = 13, color = 'var(--text-muted)' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      fill={color}
      d="M22.27 19.385H1.73A1.73 1.73 0 0 1 0 17.655V6.345a1.73 1.73 0 0 1 1.73-1.73h20.54A1.73 1.73 0 0 1 24 6.345v11.308a1.73 1.73 0 0 1-1.73 1.731zM5.769 15.923v-4.5l2.308 2.885l2.307-2.885v4.5h2.308V8.078h-2.308l-2.307 2.885l-2.308-2.885H3.46v7.847zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.461 4.039z"/>
  </svg>
);

// ── Tree node row ─────────────────────────────────────────────────────────
const TreeNode = ({ node, style, dragHandle }: any) => {
  const [hovered, setHovered] = useState(false);
  const { openContextMenu, openTab } = React.useContext(TreeContext);
  const isMd = node.data.type === 'file' && node.data.ext === 'md';
  const isExcalidraw = node.data.type === 'file' && node.data.ext === 'excalidraw';
  const isFile = node.data.type === 'file';
  const Icon = node.data.type === 'folder' ? Folder : isMd ? MarkdownIcon : isExcalidraw ? null : FileText;

  return (
    <div
      ref={dragHandle}
      style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 6px', cursor: 'pointer', userSelect: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (node.data.type === 'folder') node.toggle(); else openTab({ type: node.data.ext === 'md' ? 'note' : 'draw', title: node.data.name, filePath: node.data.id }); }}
      onContextMenu={(e) => openContextMenu(e, node.data)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: '100%', paddingLeft: 8, paddingRight: 8, borderRadius: 6, background: node.isSelected ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent', color: node.isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: node.isSelected ? 500 : 400, fontSize: 14, transition: 'background 0.1s' }}>
      {node.data.type === 'folder' && (
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {node.isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      )}
      {isFile
        ? isExcalidraw
          ? <ExcalidrawIcon size={13} color={node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
          : isMd
            ? <MarkdownIcon size={13} color={node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)'} />
            : <FileText size={13} style={{ flexShrink: 0, color: node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)' }} />
        : <Folder size={13} style={{ flexShrink: 0, color: node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)' }} />
      }
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.data.name.endsWith('.md') ? node.data.name.slice(0, -3) : node.data.name.endsWith('.excalidraw') ? node.data.name.slice(0, -11) : node.data.name}</span>
      </div>
    </div>
  );
};

// ── Search ────────────────────────────────────────────────────────────────
const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', boxSizing: 'border-box', overflow: 'hidden', padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', boxSizing: 'border-box' }}>
          <SearchIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }}
            autoFocus
          />
          <button
            onClick={() => setCaseSensitive(v => !v)}
            title="Match case"
            style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '0 4px', borderRadius: 4, border: 'none', cursor: 'pointer', background: caseSensitive ? 'var(--accent-soft)' : 'transparent', color: caseSensitive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            Aa
          </button>
        </div>
        <button
          title="Search filters"
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>
      <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: 13, paddingTop: 8, paddingLeft: 4 }}>
        <p>No matches found.</p>
      </div>
    </div>
  );
};

// ── Settings ──────────────────────────────────────────────────────────────
export const SettingsView: React.FC<{ showTitle?: boolean }> = ({ showTitle = true }) => {
  const { theme, setTheme } = useActivity();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, boxSizing: 'border-box' }}>
      {showTitle && <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Settings</h3>}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appearance</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['light', 'dark'] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${theme === t ? 'var(--accent)' : 'var(--border)'}`, background: theme === t ? 'var(--accent-soft)' : 'transparent', color: theme === t ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 0.1s' }}
            >
              {t === 'light' ? <Sun size={13} /> : <Moon size={13} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
