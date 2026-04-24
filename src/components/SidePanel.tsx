import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tree, TreeApi, NodeApi } from 'react-arborist';
import {
  Folder, FileText, FolderPlus,
  Search as SearchIcon, FilePen, ArrowUpNarrowWide, LayoutList,
  ChevronsUpDown, FilePlus2, PanelRight, ExternalLink, Copy, FolderInput,
  Bookmark, GitMerge, History, ArrowUpRight, Pencil, Trash2, ChevronRight as Arrow, Image as ImageFileIcon,
} from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useModal } from './Modal';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { VaultNode } from '../types';
import { normalizeNewItemName } from '../utils/fileNaming';

// ── Shared context so Node (outside FileTreeView) can trigger actions ─────
interface TreeCtx {
  openContextMenu: (e: React.MouseEvent, node: NodeApi<VaultNode>) => void;
  openTab: (opts: any) => void;
}
const TreeContext = React.createContext<TreeCtx>({ openContextMenu: () => {}, openTab: () => {} });

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
const visibleFileExtensions = new Set(['md', 'excalidraw']);
const FILE_TREE_ROW_HEIGHT = 32;
const FILE_TREE_COMPACT_ROW_HEIGHT = 28;
const FILE_TREE_ITEM_HEIGHT = 26;

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

// ── Sort helpers ──────────────────────────────────────────────────────────
interface SortableNode { type: string; name: string; children?: SortableNode[] }
function sortVaultNodes<T extends SortableNode>(nodes: T[], order: 'asc' | 'desc'): T[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return order === 'asc' ? cmp : -cmp;
  }).map(node => {
    if (!node.children) return node;
    return { ...node, children: sortVaultNodes(node.children as T[], order) };
  });
}

const filterTreeNodes = (nodes: VaultNode[]): VaultNode[] =>
  nodes.flatMap((node) => {
    if (node.type === 'folder') {
      const children = filterTreeNodes(node.children);
      return children.length ? [{ ...node, children }] : [];
    }

    const ext = node.ext?.toLowerCase();
    return ext && visibleFileExtensions.has(ext) ? [node] : [];
  });

// ── File tree ─────────────────────────────────────────────────────────────
const FileTreeView: React.FC = () => {
  const { nodes, createFileRemote, createFolderRemote, moveNode, nextUntitledName, isLoading, error, refreshFileTree, deleteItem, expandFolder } = useVault();
  const { openTab } = useTabs();
  const { confirm, prompt } = useModal();
  const { settings } = useAppSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<TreeApi<VaultNode> | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const headerHeight = 44;
  const rowHeight = settings.appearance?.compactMode ? FILE_TREE_COMPACT_ROW_HEIGHT : FILE_TREE_ROW_HEIGHT;
  const TreeRenderer = settings.fileTree.style === 'hierarchy' ? TreeNode : OriginalTreeNode;

  const displayNodes = React.useMemo(() => {
    const filteredNodes = filterTreeNodes(nodes);
    return sortOrder === 'none' ? filteredNodes : sortVaultNodes(filteredNodes, sortOrder);
  }, [nodes, sortOrder]);

  const handleSort = () => setSortOrder(o => o === 'none' ? 'asc' : o === 'asc' ? 'desc' : 'none');

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
    if (node.data.type === 'folder') {
      if (!node.data.childrenLoaded) expandFolder(node.data.id).catch(() => {});
      node.toggle();
    } else {
      const target = getTabForNode(node.data);
      if (target) openTab(target);
    }
  }, [openTab, expandFolder]);

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

  const createNamedFile = useCallback(async (ext: 'md' | 'excalidraw') => {
    const requestedName = await prompt({
      title: ext === 'md' ? 'New note' : 'New drawing',
      placeholder: ext === 'md' ? 'Note name' : 'Drawing name',
      defaultValue: nextUntitledName(),
      confirmLabel: 'Create',
    });
    if (!requestedName) return;

    const name = normalizeNewItemName(requestedName, ext);
    createFileRemote('', name, ext).then(() => {
      refreshFileTree(undefined, { showLoading: false });
      openTab({ type: ext === 'md' ? 'note' : 'draw', title: name, filePath: `${name}.${ext}` });
    });
  }, [createFileRemote, nextUntitledName, openTab, prompt, refreshFileTree]);

  const createNamedFolder = useCallback(async () => {
    const requestedName = await prompt({ title: 'New folder', placeholder: 'Folder name', defaultValue: 'New Folder', confirmLabel: 'Create' });
    if (!requestedName) return;

    const name = normalizeNewItemName(requestedName);
    createFolderRemote('', name).then(() => refreshFileTree(undefined, { showLoading: false }));
  }, [createFolderRemote, prompt, refreshFileTree]);

  return (
    <TreeContext.Provider value={{ openContextMenu: handleContextMenu, openTab }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }} ref={containerRef}>
        {/* Header */}
        <div style={{ height: headerHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <SidebarBtn icon={<FilePen size={15} />} title="New note" onClick={() => createNamedFile('md')} />
          <SidebarBtn icon={<ExcalidrawIcon size={15} />} title="New drawing" onClick={() => createNamedFile('excalidraw')} />
          <SidebarBtn icon={<FolderPlus size={15} />} title="New folder" onClick={createNamedFolder} />
          <SidebarBtn icon={<ArrowUpNarrowWide size={15} />} title={sortOrder === 'none' ? 'Sort A→Z' : sortOrder === 'asc' ? 'Sort Z→A' : 'Remove sort'} active={sortOrder !== 'none'} onClick={handleSort} />
          <SidebarBtn icon={<LayoutList size={15} />} title="Change view" active />
          <SidebarBtn icon={<ChevronsUpDown size={15} />} title="Collapse all" onClick={() => treeRef.current?.closeAll()} />
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
              data={displayNodes}
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
  const rowHeight = settings.appearance?.compactMode ? FILE_TREE_COMPACT_ROW_HEIGHT : FILE_TREE_ROW_HEIGHT;
  const itemHeight = settings.appearance?.compactMode ? '100%' : FILE_TREE_ITEM_HEIGHT;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: itemHeight, paddingLeft: contentPaddingLeft, paddingRight: 10, border: 'none', borderRadius: 8, background: node.isSelected ? 'rgba(0,0,0,0.08)' : hovered ? 'rgba(0,0,0,0.04)' : 'var(--bg-secondary)', color: node.isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: node.isSelected ? 500 : 400, fontSize: nodeFontSize, transition: 'background 0.1s' }}>
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
  const itemHeight = settings.appearance?.compactMode ? '100%' : FILE_TREE_ITEM_HEIGHT;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: itemHeight, paddingLeft: 10, paddingRight: 10, border: 'none', borderRadius: 8, background: node.isSelected ? 'rgba(0,0,0,0.08)' : hovered ? 'rgba(0,0,0,0.04)' : 'var(--bg-secondary)', color: node.isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: node.isSelected ? 500 : 400, fontSize: nodeFontSize, transition: 'background 0.1s' }}>
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
interface SearchResult { path: string; line: number; text: string; matchType: 'content' | 'filename' }

const getTabTypeForPath = (filePath: string): 'note' | 'draw' | 'image' => {
  if (filePath.endsWith('.excalidraw')) return 'draw';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (imageExts.includes(ext)) return 'image';
  return 'note';
};

const SearchView: React.FC = () => {
  const { openTab } = useTabs();
  const { pendingSearch, setPendingSearch } = useActivity();
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingSearch !== null) {
      setQuery(pendingSearch);
      setPendingSearch(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [pendingSearch, setPendingSearch]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      window.api.files.search(query, { caseSensitive })
        .then(r => { setResults(r as SearchResult[]); setSearching(false); })
        .catch(() => setSearching(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, caseSensitive]);

  const filenameMatches = results.filter(r => r.matchType === 'filename');
  const contentResults = results.filter(r => r.matchType !== 'filename');

  // Group content results by file path
  const grouped = contentResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.path] ??= []).push(r);
    return acc;
  }, {});

  const highlightMatch = (text: string, q: string, cs: boolean) => {
    const idx = cs ? text.indexOf(q) : text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return <span>{text.slice(0, idx)}<mark style={{ background: 'var(--accent)', color: '#fff', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</span>;
  };

  const getDisplayName = (filePath: string) => {
    const fileName = filePath.includes('/') ? filePath.slice(filePath.lastIndexOf('/') + 1) : filePath;
    return fileName.replace(/\.md$/, '');
  };

  const totalContentFiles = Object.keys(grouped).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', boxSizing: 'border-box' }}>
            <SearchIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search vault..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }}
              autoFocus
            />
            {searching && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
            <button
              onClick={() => setCaseSensitive(v => !v)}
              title="Match case"
              style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '0 4px', borderRadius: 4, border: 'none', cursor: 'default', background: caseSensitive ? 'var(--accent-soft)' : 'transparent', color: caseSensitive ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              Aa
            </button>
          </div>
        </div>
        {query.trim() && !searching && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 2 }}>
            {results.length === 0 ? 'No matches' : [
              filenameMatches.length > 0 && `${filenameMatches.length} file${filenameMatches.length !== 1 ? 's' : ''}`,
              contentResults.length > 0 && `${contentResults.length} match${contentResults.length !== 1 ? 'es' : ''} in ${totalContentFiles} file${totalContentFiles !== 1 ? 's' : ''}`,
            ].filter(Boolean).join(', ')}
            {contentResults.length >= 500 && ' (capped at 500)'}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {/* Filename matches */}
        {filenameMatches.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ padding: '4px 12px 2px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Files</div>
            {filenameMatches.map((hit) => {
              const fileName = hit.path.includes('/') ? hit.path.slice(hit.path.lastIndexOf('/') + 1) : hit.path;
              const fileDir = hit.path.includes('/') ? hit.path.slice(0, hit.path.lastIndexOf('/')) : '';
              const displayName = fileName.replace(/\.md$/, '');
              const tabType = getTabTypeForPath(hit.path);
              return (
                <button
                  key={hit.path}
                  onClick={() => openTab({ type: tabType, title: displayName, filePath: hit.path })}
                  className="search-result-btn"
                  style={{ width: '100%', textAlign: 'left', padding: '4px 12px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {highlightMatch(fileName, query, caseSensitive)}
                  </span>
                  {fileDir && <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileDir}</span>}
                </button>
              );
            })}
          </div>
        )}
        {/* Content matches */}
        {contentResults.length > 0 && (
          <div>
            {filenameMatches.length > 0 && <div style={{ padding: '4px 12px 2px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Content</div>}
            {Object.entries(grouped).map(([filePath, hits]) => {
              const fileName = filePath.includes('/') ? filePath.slice(filePath.lastIndexOf('/') + 1) : filePath;
              const fileDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
              const displayName = getDisplayName(filePath);
              return (
                <div key={filePath} style={{ marginBottom: 4 }}>
                  <button
                    onClick={() => openTab({ type: 'note', title: displayName, filePath })}
                    className="search-result-btn"
                    style={{ width: '100%', textAlign: 'left', padding: '5px 12px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                    {fileDir && <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileDir}</span>}
                  </button>
                  {hits.map((hit) => (
                    <button
                      key={hit.line}
                      onClick={() => openTab({ type: 'note', title: displayName, filePath, initialLine: hit.line, searchQuery: query, searchCaseSensitive: caseSensitive })}
                      className="search-result-btn"
                      style={{ width: '100%', textAlign: 'left', padding: '3px 12px 3px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.5 }}
                      title={hit.text}
                    >
                      <span style={{ color: 'var(--text-muted)', marginRight: 6, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{hit.line}</span>
                      {highlightMatch(hit.text.slice(0, 120), query, caseSensitive)}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {!query.trim() && (
          <div style={{ padding: '16px 12px', fontSize: 13, color: 'var(--text-muted)' }}>Type to search all notes.</div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .search-result-btn:hover { background: var(--bg-hover) !important; }`}</style>
    </div>
  );
};
