import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tree, TreeApi, NodeApi } from 'react-arborist';
import {
  Folder, FileText, FolderPlus,
  Search as SearchIcon, FilePen, ArrowUpNarrowWide, LayoutList,
  ChevronsUpDown, FilePlus2, PanelRight, ExternalLink, Copy, FolderInput,
  Bookmark, GitMerge, History, ArrowUpRight, Pencil, Trash2, ChevronRight as Arrow, SlidersHorizontal, Image as ImageFileIcon,
} from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useModal } from './Modal';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { VaultNode } from '../types';

// ── Shared context so Node (outside FileTreeView) can trigger actions ─────
interface TreeCtx {
  openContextMenu: (e: React.MouseEvent, node: NodeApi<VaultNode>) => void;
  openTab: (opts: any) => void;
}
const TreeContext = React.createContext<TreeCtx>({ openContextMenu: () => {}, openTab: () => {} });

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

const isImageExt = (ext?: string) => !!ext && imageExtensions.has(ext.toLowerCase());

const getDisplayName = (name: string) => name.replace(/\.[^.]+$/, '');

const getTabForNode = (node: VaultNode) => {
  if (node.type !== 'file') return null;
  if (node.ext === 'md') return { type: 'note', title: getDisplayName(node.name), filePath: node.id } as const;
  if (node.ext === 'excalidraw') return { type: 'draw', title: getDisplayName(node.name), filePath: node.id } as const;
  if (isImageExt(node.ext)) return { type: 'image', title: getDisplayName(node.name), filePath: node.id } as const;
  return null;
};

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
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'default', background: active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent', color: active || hovered ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'background 0.1s, color 0.1s' }}
    >{icon}</button>
  );
};

const toDisplayNameParts = (node: VaultNode) => {
  const name = node.name;
  const isFileNode = node.type === 'file';
  const dot = isFileNode ? name.lastIndexOf('.') : -1;
  const ext = dot > 0 ? name.slice(dot) : '';
  const displayName = dot > 0 ? name.slice(0, dot) : name;
  return { ext, displayName };
};

const getTopLevelPaths = (nodes: VaultNode[]) => {
  const sorted = [...nodes].sort((a, b) => a.id.length - b.id.length);
  return sorted
    .filter(node => !sorted.some(other => other.id !== node.id && node.id.startsWith(`${other.id}/`)))
    .map(node => node.id);
};

const handleTreeNodeClick = (node: NodeApi<VaultNode>, e: React.MouseEvent) => {
  if ((e.metaKey || e.ctrlKey)) {
    node.isSelected ? node.deselect() : node.selectMulti();
  } else if (e.shiftKey) {
    node.selectContiguous();
  } else {
    node.select();
    node.activate();
  }
};

const getSelectionRadius = (node: NodeApi<VaultNode>) => {
  if (!node.isSelected) return 6;
  if (node.isOnlySelection) return 6;
  if (node.isSelectedStart) return '6px 6px 0 0';
  if (node.isSelectedEnd) return '0 0 6px 6px';
  return 0;
};

// ── Context menu ──────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; node: VaultNode; selectedNodes: VaultNode[] }

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
  const { openTab, syncRenamedPath } = useTabs();
  const { confirm, prompt } = useModal();
  const ref = useRef<HTMLDivElement>(null);
  const isFile = menu.node.type === 'file';
  const isMulti = menu.selectedNodes.length > 1;
  const deletePaths = getTopLevelPaths(menu.selectedNodes);

  const handleCopyPaths = () => {
    const text = menu.selectedNodes.map(node => node.id).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    onClose();
  };

  const handleDelete = () => {
    const title = isMulti ? `Delete ${deletePaths.length} items?` : `Delete "${menu.node.name}"?`;
    onClose();
    confirm({ title, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then(ok => {
      if (ok) Promise.all(deletePaths.map(path => deleteItem(path))).then(() => refreshFileTree(undefined, { showLoading: false }));
    });
  };

  const handleRename = () => {
    const { ext, displayName } = toDisplayNameParts(menu.node);
    onClose();
    prompt({ title: 'Rename', defaultValue: displayName, placeholder: 'Name', confirmLabel: 'Rename' }).then(n => {
      if (n) {
        const newName = ext ? (n.endsWith(ext) ? n : `${n}${ext}`) : n;
        const oldPath = menu.node.id;
        const dirPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
        const newPath = dirPath ? `${dirPath}/${newName}` : newName;
        renameItem(oldPath, newName).then(() => {
          syncRenamedPath(oldPath, newPath);
          refreshFileTree(undefined, { showLoading: false });
        });
      }
    });
  };

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
      {!isMulti && isFile && <CtxMenuItem icon={<FilePlus2 size={14} />} label="Open in new tab" onClick={() => act(() => {
        const target = getTabForNode(menu.node);
        if (target) openTab(target);
      })} />}
      <CtxSep />
      <CtxMenuItem icon={<Copy size={14} />} label={isMulti ? 'Copy paths' : 'Copy path'} onClick={handleCopyPaths} />
      <CtxSep />
      {!isMulti && <CtxMenuItem icon={<Pencil size={14} />} label="Rename..." onClick={handleRename} />}
      <CtxMenuItem icon={<Trash2 size={14} />} label={isMulti ? 'Delete selected' : 'Delete'} danger onClick={handleDelete} />
    </div>
  );
};

// ── File tree ─────────────────────────────────────────────────────────────
const FileTreeView: React.FC = () => {
  const { nodes, createFileRemote, createFolderRemote, moveNode, nextUntitledName, isLoading, error, refreshFileTree, deleteItem } = useVault();
  const { openTab } = useTabs();
  const { confirm } = useModal();
  const { settings } = useAppSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<TreeApi<VaultNode> | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const headerHeight = 44;
  const rowHeight = settings.appearance?.compactMode ? 28 : 36;
  const TreeRenderer = settings.fileTree.style === 'hierarchy' ? TreeNode : OriginalTreeNode;

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

  const handleActivate = useCallback((node: NodeApi<VaultNode>) => {
    if (node.data.type === 'folder') node.toggle();
    else {
      const target = getTabForNode(node.data);
      if (target) openTab(target);
    }
  }, [openTab]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: NodeApi<VaultNode>) => {
    e.preventDefault();
    const tree = treeRef.current;
    const keepSelection = node.isSelected && !!tree?.hasMultipleSelections;
    if (!keepSelection) node.select();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      node: node.data,
      selectedNodes: keepSelection ? (tree?.selectedNodes.map(item => item.data) ?? [node.data]) : [node.data],
    });
  }, []);

  const handleTreeDelete = useCallback(({ ids }: { ids: string[] }) => {
    const selected = ids
      .map(id => treeRef.current?.get(id)?.data)
      .filter((node): node is VaultNode => !!node);
    const deletePaths = getTopLevelPaths(selected);
    if (!deletePaths.length) return Promise.resolve();
    return confirm({
      title: deletePaths.length === 1 ? `Delete "${selected[0]?.name ?? 'item'}"?` : `Delete ${deletePaths.length} items?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    }).then(ok => {
      if (!ok) return;
      return Promise.all(deletePaths.map(path => deleteItem(path)))
        .then(() => refreshFileTree(undefined, { showLoading: false }))
        .then(() => treeRef.current?.deselectAll());
    });
  }, [confirm, deleteItem, refreshFileTree]);

  return (
    <TreeContext.Provider value={{ openContextMenu: handleContextMenu, openTab }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }} ref={containerRef}>
        {/* Header */}
        <div style={{ height: headerHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <SidebarBtn icon={<FilePen size={15} />} title="New note" onClick={() => { const name = nextUntitledName(); createFileRemote('', name, 'md').then(() => { refreshFileTree(undefined, { showLoading: false }); openTab({ type: 'note', title: name, filePath: `${name}.md` }); }); }} />
          <SidebarBtn icon={<ExcalidrawIcon size={15} />} title="New drawing" onClick={() => { const name = nextUntitledName(); createFileRemote('', name, 'excalidraw').then(() => { refreshFileTree(undefined, { showLoading: false }); openTab({ type: 'draw', title: name, filePath: `${name}.excalidraw` }); }); }} />
          <SidebarBtn icon={<FolderPlus size={15} />} title="New folder" onClick={() => createFolderRemote('', 'New Folder').then(() => refreshFileTree(undefined, { showLoading: false }))} />
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
                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 12px', cursor: 'default' }}
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <p style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</p>
          ) : dimensions ? (
            <Tree
              ref={treeRef}
              data={nodes}
              openByDefault={true}
              width={dimensions.width}
              height={dimensions.height - headerHeight}
              indent={16}
              rowHeight={rowHeight}
              onMove={handleMove}
              onActivate={handleActivate}
              onDelete={handleTreeDelete}
            >
              {TreeRenderer}
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
  const { openContextMenu } = React.useContext(TreeContext);
  const { settings } = useAppSettings();
  const isMd = node.data.type === 'file' && node.data.ext === 'md';
  const isExcalidraw = node.data.type === 'file' && node.data.ext === 'excalidraw';
  const isImage = node.data.type === 'file' && isImageExt(node.data.ext);
  const isFile = node.data.type === 'file';
  const basePadding = 10;
  const indentStep = 16;
  const rowHeight = settings.appearance?.compactMode ? 28 : 36;
  const rowMid = rowHeight / 2;
  const fontSizeMap = { small: 13, medium: 14, large: 16 } as const;
  const nodeFontSize = fontSizeMap[settings.appearance?.fontSize ?? 'medium'];
  const contentPaddingLeft = basePadding + (node.level * indentStep) + 18;
  const currentLineX = basePadding + (node.level * indentStep) + 8;
  const parentLineX = basePadding + ((node.level - 1) * indentStep) + 8;

  const ancestorLines: number[] = [];
  let ancestor = node.parent;
  while (ancestor && !ancestor.isRoot) {
    if (ancestor.nextSibling) {
      ancestorLines.push(basePadding + (ancestor.level * indentStep) + 8);
    }
    ancestor = ancestor.parent;
  }

  const badgeLabel = isExcalidraw ? 'CANVAS'
    : isImage ? node.data.ext?.toUpperCase()
    : (!isMd && isFile && node.data.ext) ? node.data.ext.toUpperCase()
    : null;
  const iconColor = node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)';

  return (
    <div
      ref={dragHandle}
      style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 6px', cursor: 'default', userSelect: 'none', position: 'relative', boxSizing: 'border-box' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => handleTreeNodeClick(node, e)}
      onContextMenu={(e) => openContextMenu(e, node)}
    >
      <svg
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
      >
        {ancestorLines.map((x, index) => (
          <line
            key={`${node.id}-anc-${index}`}
            x1={x} y1={0}
            x2={x} y2={rowHeight}
            stroke="var(--border)"
            strokeWidth={1}
            strokeOpacity={0.6}
          />
        ))}
        {node.level > 0 && (
          <line
            x1={parentLineX} y1={0}
            x2={parentLineX} y2={node.nextSibling ? rowHeight : rowMid}
            stroke="var(--border)"
            strokeWidth={1}
            strokeOpacity={0.6}
          />
        )}
        {!isFile && node.isOpen && node.children?.length > 0 && (
          <line
            x1={currentLineX} y1={rowMid}
            x2={currentLineX} y2={rowHeight}
            stroke="var(--border)"
            strokeWidth={1}
            strokeOpacity={0.6}
          />
        )}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: '100%', paddingLeft: contentPaddingLeft, paddingRight: 10, borderRadius: 7, background: node.isSelected ? 'rgba(0,0,0,0.08)' : hovered ? 'rgba(0,0,0,0.04)' : 'transparent', color: node.isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: node.isSelected ? 500 : 400, fontSize: nodeFontSize, transition: 'background 0.1s' }}>
        {isFile
          ? isExcalidraw
            ? <ExcalidrawIcon size={14} color={iconColor} style={{ flexShrink: 0 }} />
            : isImage
              ? <ImageFileIcon size={14} style={{ flexShrink: 0, color: iconColor }} />
              : isMd
                ? <MarkdownIcon size={14} color={iconColor} />
                : <FileText size={14} style={{ flexShrink: 0, color: iconColor }} />
          : <Folder size={14} style={{ flexShrink: 0, color: iconColor }} />
        }
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.data.type === 'file' ? getDisplayName(node.data.name) : node.data.name}</span>
        {badgeLabel && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', opacity: 0.8 }}>{badgeLabel}</span>}
      </div>
    </div>
  );
};

const OriginalTreeNode = ({ node, style, dragHandle }: any) => {
  const [hovered, setHovered] = useState(false);
  const { openContextMenu } = React.useContext(TreeContext);
  const { settings } = useAppSettings();
  const isMd = node.data.type === 'file' && node.data.ext === 'md';
  const isExcalidraw = node.data.type === 'file' && node.data.ext === 'excalidraw';
  const isImage = node.data.type === 'file' && isImageExt(node.data.ext);
  const isFile = node.data.type === 'file';
  const fontSizeMap = { small: 13, medium: 14, large: 16 } as const;
  const nodeFontSize = fontSizeMap[settings.appearance?.fontSize ?? 'medium'];
  const badgeLabel = isExcalidraw ? 'CANVAS'
    : isImage ? node.data.ext?.toUpperCase()
    : (!isMd && isFile && node.data.ext) ? node.data.ext.toUpperCase()
    : null;
  const iconColor = node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)';

  return (
    <div
      ref={dragHandle}
      style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 6px', cursor: 'default', userSelect: 'none', boxSizing: 'border-box' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => handleTreeNodeClick(node, e)}
      onContextMenu={(e) => openContextMenu(e, node)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: '100%', paddingLeft: 10, paddingRight: 10, borderRadius: 7, background: node.isSelected ? 'rgba(0,0,0,0.08)' : hovered ? 'rgba(0,0,0,0.04)' : 'transparent', color: node.isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: node.isSelected ? 500 : 400, fontSize: nodeFontSize, transition: 'background 0.1s' }}>
        {isFile
          ? isExcalidraw
            ? <ExcalidrawIcon size={14} color={iconColor} style={{ flexShrink: 0 }} />
            : isImage
              ? <ImageFileIcon size={14} style={{ flexShrink: 0, color: iconColor }} />
              : isMd
                ? <MarkdownIcon size={14} color={iconColor} />
                : <FileText size={14} style={{ flexShrink: 0, color: iconColor }} />
          : <Folder size={14} style={{ flexShrink: 0, color: iconColor }} />
        }
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.data.type === 'file' ? getDisplayName(node.data.name) : node.data.name}</span>
        {badgeLabel && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', opacity: 0.8 }}>{badgeLabel}</span>}
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
            style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '0 4px', borderRadius: 4, border: 'none', cursor: 'default', background: caseSensitive ? 'var(--accent-soft)' : 'transparent', color: caseSensitive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            Aa
          </button>
        </div>
        <button
          title="Search filters"
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'default', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
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
