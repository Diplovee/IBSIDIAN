import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Plus, FileText, Globe, SquareTerminal,
  Pin, Link2, Link, BookOpen, Code, ExternalLink, PanelLeft, PanelRight,
  PanelBottom, Pencil, FolderInput, Bookmark, GitMerge, PlusCircle,
  Download, Search, Copy, History, ArrowUpRight, FolderOpen, Trash2, RefreshCw,
  ChevronRight, Image as ImageFileIcon,
} from 'lucide-react';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { toast } from './ui/sonner';
import { ExcalidrawIcon } from './ExcalidrawIcon';

// ── Markdown icon (custom SVG) ───────────────────────────────────────────────
const MarkdownIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = 'var(--text-muted)' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill={color}
      d="M22.27 19.385H1.73A1.73 1.73 0 0 1 0 17.655V6.345a1.73 1.73 0 0 1 1.73-1.73h20.54A1.73 1.73 0 0 1 24 6.345v11.308a1.73 1.73 0 0 1-1.73 1.731zM5.769 15.923v-4.5l2.308 2.885l2.307-2.885v4.5h2.308V8.078h-2.308l-2.307 2.885l-2.308-2.885H3.46v7.847zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.461 4.039z"
    />
  </svg>
);
import { useModal } from './Modal';
import { Tab, TabType } from '../types';

// ── Tab context menu ──────────────────────────────────────────────────

interface TabCtxMenu { x: number; y: number; tab: Tab }

const TabCtxItem: React.FC<{
  icon: React.ReactNode; label: string;
  onClick?: () => void; disabled?: boolean; danger?: boolean; hasArrow?: boolean;
}> = ({ icon, label, onClick, disabled, danger, hasArrow }) => {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        paddingLeft: 16, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        fontSize: 13, textAlign: 'left', opacity: disabled ? 0.4 : 1,
        background: h && !disabled ? 'var(--bg-hover)' : 'transparent',
        color: danger ? '#ef4444' : 'var(--text-primary)',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ flexShrink: 0, color: danger ? '#ef4444' : 'var(--text-muted)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hasArrow && <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </button>
  );
};

const TabCtxSep = () => <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />;

const GROUP_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0f766e', '#db2777'];

const hexToRgb = (value: string) => {
  const hex = value.replace('#', '').trim();
  if (hex.length !== 6) return null;
  const num = Number.parseInt(hex, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const tintHex = (value: string, alpha: number) => {
  const rgb = hexToRgb(value);
  if (!rgb) return value;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const GROUP_TEXT_COLOR = '#111827';
const GROUP_CONNECTOR_COLOR = '#2b2b2b';

const GroupConnector: React.FC<{ dashed?: boolean }> = ({ dashed = false }) => (
  <div
    aria-hidden
    style={{
      width: dashed ? 18 : 16,
      flexShrink: 0,
      alignSelf: 'center',
      borderTop: `3px ${dashed ? 'dotted' : 'solid'} ${GROUP_CONNECTOR_COLOR}`,
      margin: '0 4px',
      opacity: 0.95,
    }}
  />
);

const TabContextMenu: React.FC<{ menu: TabCtxMenu; onClose: () => void }> = ({ menu, onClose }) => {
  const {
    closeTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeOtherTabs,
    closeAllTabs,
    tabs,
    browserGroups,
    openTab,
    updateTabCustomTitle,
    moveTabToGroup,
    createBrowserGroup,
    updateBrowserGroup,
    deleteBrowserGroup,
    toggleBrowserGroupCollapsed,
    duplicateBrowserGroup,
    closeBrowserGroup,
    getBrowserGroup,
  } = useTabs();
  const { deleteNode, renameNode, getNodeById } = useVault();
  const { confirm, prompt } = useModal();
  const ref = useRef<HTMLDivElement>(null);
  const tab = menu.tab;
  const isNote = tab.type === 'note';
  const isBrowser = tab.type === 'browser';
  const node = isNote && tab.filePath ? getNodeById(tab.filePath) : null;
  const tabIndex = tabs.findIndex(t => t.id === tab.id);
  const canCloseLeft = tabIndex > 0;
  const canCloseRight = tabIndex >= 0 && tabIndex < tabs.length - 1;
  const canCloseOther = tabs.length > 1;
  const browserDisplayTitle = tab.customTitle ?? tab.title;
  const group = isBrowser ? getBrowserGroup(tab.groupId) : null;
  const groupedBrowserTabs = group ? tabs.filter(t => t.type === 'browser' && t.groupId === group.id) : [];
  const canDuplicateGroup = group ? groupedBrowserTabs.length > 0 : false;
  const canCloseGroup = group ? groupedBrowserTabs.length > 0 : false;

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const act = (fn: () => void) => { fn(); onClose(); };

  const handleRenameNote = () => {
    onClose();
    const displayName = tab.title.endsWith('.md') ? tab.title.slice(0, -3) : tab.title;
    prompt({ title: 'Rename file', defaultValue: displayName, placeholder: 'File name', confirmLabel: 'Rename' }).then(n => {
      if (n && node?.id) renameNode(node.id, n.endsWith('.md') ? n : `${n}.md`);
    });
  };

  const handleRenameBrowser = () => {
    onClose();
    prompt({
      title: 'Rename tab',
      defaultValue: browserDisplayTitle,
      placeholder: 'Tab name',
      confirmLabel: 'Rename',
    }).then(n => {
      updateTabCustomTitle(tab.id, n?.trim() ? n.trim() : undefined);
    });
  };

  const handleDuplicateBrowser = () => {
    act(() => {
      openTab({
        type: 'browser',
        title: tab.title,
        url: tab.url,
        customTitle: tab.customTitle,
        groupId: tab.groupId,
      });
    });
  };

  const handleReloadBrowser = () => {
    act(() => {
      window.dispatchEvent(new CustomEvent('ibsidian:browser-tab-reload', { detail: { tabId: tab.id } }));
    });
  };

  const handleResetBrowserTitle = () => {
    act(() => updateTabCustomTitle(tab.id, undefined));
  };

  const handleCopyBrowserUrl = async () => {
    onClose();
    const url = tab.url?.trim();
    if (!url) {
      toast.warning('No URL available to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Url Copied !');
    } catch {
      toast.error('Error', {
        description: 'Failed to copy the URL.',
        action: { label: 'Retry', onClick: handleCopyBrowserUrl },
      });
    }
  };

  const handleCopyBrowserTitle = async () => {
    onClose();
    const title = (tab.customTitle ?? tab.title).trim();
    if (!title) {
      toast.info('No title to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(title);
      toast.success('Title Copied !');
    } catch {
      toast.error('Error', { description: 'Failed to copy the tab title.' });
    }
  };

  const handleCopyBrowserDomain = async () => {
    onClose();
    const url = tab.url?.trim();
    if (!url) {
      toast.warning('No URL available to copy the domain from.');
      return;
    }

    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      await navigator.clipboard.writeText(domain);
      toast.success('Domain Copied !');
    } catch {
      toast.error('Error', { description: 'Failed to copy the domain.' });
    }
  };

  const handleCreateGroupFromTab = () => {
    onClose();
    prompt({
      title: 'Create browser group',
      defaultValue: browserDisplayTitle,
      placeholder: 'Group name',
      confirmLabel: 'Create',
    }).then(name => {
      if (!name) return;
      const groupId = createBrowserGroup(name, GROUP_COLORS[browserGroups.length % GROUP_COLORS.length]);
      moveTabToGroup(tab.id, groupId);
    });
  };

  const handleRenameGroup = () => {
    if (!group) return;
    onClose();
    prompt({ title: 'Rename group', defaultValue: group.name, placeholder: 'Group name', confirmLabel: 'Rename' }).then(name => {
      if (name?.trim()) updateBrowserGroup(group.id, { name: name.trim() });
    });
  };

  const handleChangeGroupColor = () => {
    if (!group) return;
    onClose();
    prompt({ title: 'Group color', defaultValue: group.color, placeholder: '#7c3aed', confirmLabel: 'Apply' }).then(color => {
      if (color?.trim()) updateBrowserGroup(group.id, { color: color.trim() });
    });
  };

  const handleToggleGroupCollapsed = () => {
    if (!group) return;
    act(() => toggleBrowserGroupCollapsed(group.id));
  };

  const handleRemoveFromGroup = () => {
    if (!group) return;
    act(() => moveTabToGroup(tab.id, null));
    if (groupedBrowserTabs.length <= 1) deleteBrowserGroup(group.id);
  };

  const handleDuplicateGroup = () => {
    if (!group) return;
    act(() => duplicateBrowserGroup(group.id));
  };

  const handleCloseGroup = () => {
    if (!group) return;
    act(() => closeBrowserGroup(group.id));
  };

  const handleDelete = () => {
    onClose();
    confirm({ title: `Delete "${tab.title}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then(ok => {
      if (ok) { if (node?.id) deleteNode(node.id); closeTab(tab.id); }
    });
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
        minWidth: 220, background: 'var(--bg-primary)',
        border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        paddingTop: 4, paddingBottom: 4,
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <TabCtxItem icon={<X size={14} />} label="Close" onClick={() => act(() => closeTab(tab.id))} />
      <TabCtxItem icon={<PanelLeft size={14} />} label="Close tabs to the left" disabled={!canCloseLeft} onClick={() => act(() => closeTabsToLeft(tab.id))} />
      <TabCtxItem icon={<PanelRight size={14} />} label="Close tabs to the right" disabled={!canCloseRight} onClick={() => act(() => closeTabsToRight(tab.id))} />
      <TabCtxItem icon={<FolderOpen size={14} />} label="Close other tabs" disabled={!canCloseOther} onClick={() => act(() => closeOtherTabs(tab.id))} />
      <TabCtxItem icon={<X size={14} />} label="Close all tabs" onClick={() => act(() => closeAllTabs())} />
      {(isNote || isBrowser) && <TabCtxSep />}
      {isNote && (
        <>
          <TabCtxItem icon={<Pencil size={14} />} label="Rename..." onClick={handleRenameNote} />
          <TabCtxItem
            icon={<Copy size={14} />} label="Copy path"
            onClick={() => act(() => navigator.clipboard.writeText(tab.filePath || tab.title).catch(() => {}))}
          />
          <TabCtxSep />
          <TabCtxItem icon={<Trash2 size={14} />} label="Delete file" danger onClick={handleDelete} />
        </>
      )}
      {isBrowser && (
        <>
          <TabCtxItem icon={<RefreshCw size={14} />} label="Reload tab" onClick={handleReloadBrowser} />
          <TabCtxItem icon={<PlusCircle size={14} />} label="Duplicate tab" onClick={handleDuplicateBrowser} />
          <TabCtxItem icon={<Copy size={14} />} label="Copy URL" onClick={handleCopyBrowserUrl} />
          <TabCtxItem icon={<Copy size={14} />} label="Copy title" onClick={handleCopyBrowserTitle} />
          <TabCtxItem icon={<Link2 size={14} />} label="Copy domain" onClick={handleCopyBrowserDomain} />
          <TabCtxItem icon={<Pencil size={14} />} label="Rename tab..." onClick={handleRenameBrowser} />
          <TabCtxItem icon={<FileText size={14} />} label="Reset tab title" onClick={handleResetBrowserTitle} />
          <TabCtxSep />
          {group ? (
            <>
              <TabCtxItem icon={<FolderInput size={14} />} label="Rename group..." onClick={handleRenameGroup} />
              <TabCtxItem icon={<Search size={14} />} label="Change group color..." onClick={handleChangeGroupColor} />
              <TabCtxItem icon={<BookOpen size={14} />} label={group.collapsed ? 'Expand group' : 'Collapse group'} onClick={handleToggleGroupCollapsed} />
              <TabCtxItem icon={<PlusCircle size={14} />} label="Duplicate group" disabled={!canDuplicateGroup} onClick={handleDuplicateGroup} />
              <TabCtxItem icon={<Trash2 size={14} />} label="Close group" danger disabled={!canCloseGroup} onClick={handleCloseGroup} />
              <TabCtxItem icon={<Link size={14} />} label="Remove from group" onClick={handleRemoveFromGroup} />
            </>
          ) : (
            <TabCtxItem icon={<FolderInput size={14} />} label="Create group from tab..." onClick={handleCreateGroupFromTab} />
          )}
        </>
      )}
    </div>
  );
};

// ── New tab button ────────────────────────────────────────────────────

const NewTabButton: React.FC<{ openTab: any }> = ({ openTab }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => openTab({ type: 'new-tab', title: 'New tab' })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title="New tab"
      style={{
        marginLeft: 8, marginRight: 8, marginTop: 5, marginBottom: 5,
        padding: '0 8px', height: 'calc(100% - 10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', cursor: 'pointer',
        background: pressed ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      }}
    >
      <Plus size={15} />
    </button>
  );
};

const TabItem: React.FC<{
  tab: Tab;
  isActive: boolean;
  icon: React.ReactNode;
  groupBadge?: { name: string; color: string; collapsed?: boolean } | null;
  dragging?: boolean;
  dropTarget?: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}> = ({ tab, isActive, icon, groupBadge, dragging, dropTarget, onSelect, onClose, onContextMenu, onDragStart, onDragEnd, onDragOver, onDrop }) => {
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const isBrowser = tab.type === 'browser';
  const isGroupedBrowser = isBrowser && !!groupBadge;
  const isCollapsedGroup = !!(isBrowser && groupBadge?.collapsed);
  const showTitle = !isCollapsedGroup;
  const showGroupBadge = false;
  const showIcon = !isGroupedBrowser;
  const groupColor = groupBadge?.color ?? null;

  return (
    <div
      draggable={tab.type === 'browser'}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setCloseHovered(false);
      }}
      style={{
        height: 'calc(100% - 8px)',
        marginTop: 4,
        marginBottom: 4,
        marginRight: 12,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        border: groupColor ? `2px solid ${groupColor}` : `1px solid var(--border)`,
        borderRadius: 7,
        transition: 'background 0.1s, color 0.1s, box-shadow 0.1s, border-color 0.1s',
        position: 'relative',
        paddingLeft: isCollapsedGroup ? 12 : 14,
        paddingRight: isCollapsedGroup ? 28 : 12,
        gap: isCollapsedGroup ? 6 : 8,
        minWidth: isCollapsedGroup ? 94 : 118,
        maxWidth: isCollapsedGroup ? 124 : 210,
        background: groupColor
          ? (dropTarget
            ? tintHex(groupColor, 0.24)
            : isActive
              ? tintHex(groupColor, 0.20)
              : hovered
                ? tintHex(groupColor, 0.18)
                : tintHex(groupColor, 0.18))
          : isActive
            ? 'var(--bg-active)'
            : hovered
              ? 'var(--bg-hover)'
              : 'var(--bg-primary)',
        color: groupColor ? GROUP_TEXT_COLOR : (isActive ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)'),
        opacity: dragging ? 0.45 : 1,
        boxShadow: 'none',
        outline: dropTarget && groupBadge ? `1px solid ${groupBadge.color}` : 'none',
        outlineOffset: -1,
        borderTopLeftRadius: 7,
        borderTopRightRadius: 7,
        borderBottomLeftRadius: 7,
        borderBottomRightRadius: 7,
      }}
    >
      {showIcon && <span style={{ flexShrink: 0, color: groupColor ? GROUP_TEXT_COLOR : (isActive ? 'var(--text-secondary)' : 'var(--text-muted)') }}>{icon}</span>}
      {showTitle && (
        <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: groupColor ? 600 : 400, color: groupColor ? GROUP_TEXT_COLOR : undefined }}>{tab.customTitle ?? tab.title}</span>
      )}
      {showGroupBadge && groupBadge && (
        <span style={{
          display: 'none',
        }} />
      )}
      <button
        onClick={onClose}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          border: 'none',
          background: closeHovered ? (groupColor ? tintHex(groupColor, 0.14) : 'var(--bg-active)') : 'transparent',
          color: closeHovered ? GROUP_TEXT_COLOR : (groupColor ? GROUP_TEXT_COLOR : 'var(--text-muted)'),
          opacity: isActive ? (closeHovered ? 1 : 0.75) : hovered ? (closeHovered ? 1 : 0.7) : 0,
          cursor: 'pointer',
          transition: 'background 0.1s, color 0.1s, opacity 0.1s',
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ── Tab bar ───────────────────────────────────────────────────────────

export const TabBar: React.FC = () => {
  const {
    tabs,
    browserGroups,
    activeTabId,
    setActiveTabId,
    closeTab,
    openTab,
    getBrowserGroup,
    toggleBrowserGroupCollapsed,
    moveTabToGroup,
    createBrowserGroup,
  } = useTabs();
  const [ctxMenu, setCtxMenu] = useState<TabCtxMenu | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);

  const getIcon = (type: TabType) => {
    switch (type) {
      case 'note': return <MarkdownIcon size={14} />;
      case 'browser': return <Globe size={14} />;
      case 'draw': return <ExcalidrawIcon size={14} />;
      case 'image': return <ImageFileIcon size={14} />;
      case 'terminal': return <SquareTerminal size={14} />;
      case 'new-tab': return <Plus size={14} />;
      default: return <MarkdownIcon size={14} />;
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);

  const clearDragState = useCallback(() => {
    setDraggedTabId(null);
    setDropGroupId(null);
  }, []);

  const getDraggedTabId = useCallback((e: React.DragEvent) => {
    return e.dataTransfer.getData('application/x-ibsidian-tab-id')
      || e.dataTransfer.getData('text/plain')
      || draggedTabId
      || null;
  }, [draggedTabId]);

  const handleTabDragStart = useCallback((e: React.DragEvent, tab: Tab) => {
    if (tab.type !== 'browser') return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-ibsidian-tab-id', tab.id);
    e.dataTransfer.setData('text/plain', tab.id);
    setDraggedTabId(tab.id);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleTabDropToTarget = useCallback((e: React.DragEvent, targetTab: Tab) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceTabId = getDraggedTabId(e);
    if (!sourceTabId || sourceTabId === targetTab.id) return;

    if (targetTab.type !== 'browser') return;

    const targetGroup = getBrowserGroup(targetTab.groupId);
    if (targetGroup) {
      moveTabToGroup(sourceTabId, targetGroup.id);
      clearDragState();
      return;
    }

    const sourceTab = tabs.find(t => t.id === sourceTabId);
    if (!sourceTab || sourceTab.type !== 'browser') return;

    const groupName = targetTab.customTitle ?? targetTab.title;
    const newGroupId = createBrowserGroup(groupName);
    moveTabToGroup(targetTab.id, newGroupId);
    moveTabToGroup(sourceTabId, newGroupId);
    clearDragState();
  }, [clearDragState, createBrowserGroup, getBrowserGroup, getDraggedTabId, moveTabToGroup, tabs]);

  const handleGroupDrop = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceTabId = getDraggedTabId(e);
    if (!sourceTabId) return;
    moveTabToGroup(sourceTabId, groupId);
    setDropGroupId(null);
    setDraggedTabId(null);
  }, [getDraggedTabId, moveTabToGroup]);

  const handleGroupDragOver = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropGroupId(groupId);
  }, []);

  const browserGroupBadgeForTab = (tab: Tab) => {
    if (tab.type !== 'browser') return null;
    const group = getBrowserGroup(tab.groupId);
    return group ? { name: group.name, color: group.color, collapsed: !!group.collapsed } : null;
  };

  const collapsedGroupIds = new Set(browserGroups.filter(group => group.collapsed).map(group => group.id));
  const visibleTabs = tabs.filter(tab => !(tab.type === 'browser' && tab.groupId && collapsedGroupIds.has(tab.groupId)));
  const renderedGroupIds = new Set<string>();

  return (
    <>
      <div style={{ height: 36, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'stretch', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', zIndex: 30, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', height: '100%', alignItems: 'stretch', paddingLeft: 6 }}>
          {visibleTabs.map((tab) => {
            if (tab.type === 'browser' && tab.groupId) {
              const group = getBrowserGroup(tab.groupId);
              if (!group) {
                return (
                  <TabItem
                    key={tab.id}
                    tab={tab}
                    isActive={activeTabId === tab.id}
                    icon={getIcon(tab.type)}
                    groupBadge={browserGroupBadgeForTab(tab)}
                    dragging={draggedTabId === tab.id}
                    dropTarget={dropGroupId === tab.groupId}
                    onSelect={() => setActiveTabId(tab.id)}
                    onContextMenu={(e) => handleContextMenu(e, tab)}
                    onDragStart={(e) => handleTabDragStart(e, tab)}
                    onDragEnd={handleTabDragEnd}
                    onDragOver={(e) => handleTabDropToTarget(e, tab)}
                    onDrop={(e) => handleTabDropToTarget(e, tab)}
                    onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  />
                );
              }

              if (renderedGroupIds.has(group.id)) return null;
              renderedGroupIds.add(group.id);
              const groupTabs = visibleTabs.filter(t => t.type === 'browser' && t.groupId === group.id);
              const firstGroupedTab = groupTabs[0];
              const isDropTarget = dropGroupId === group.id;
              return (
                <div key={group.id} style={{ display: 'flex', alignItems: 'stretch', marginRight: 0 }}>
                  <button
                    onClick={() => toggleBrowserGroupCollapsed(group.id)}
                    onContextMenu={(e) => handleContextMenu(e, firstGroupedTab ?? { id: group.id, type: 'browser', title: group.name, customTitle: group.name, groupId: group.id } as Tab)}
                    onDragOver={(e) => handleGroupDragOver(e, group.id)}
                    onDragLeave={() => setDropGroupId(null)}
                    onDrop={(e) => handleGroupDrop(e, group.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      margin: '4px 0 4px 0',
                    marginRight: group.collapsed ? 12 : 0,
                      padding: '0 18px',
                      height: 'calc(100% - 8px)',
                      borderRadius: 7,
                      border: `2px solid ${group.color}`,
                      background: group.collapsed
                        ? tintHex(group.color, 0.22)
                        : isDropTarget
                          ? tintHex(group.color, 0.22)
                          : tintHex(group.color, 0.18),
                      color: GROUP_TEXT_COLOR,
                      cursor: 'pointer',
                      boxShadow: 'none',
                      transition: 'box-shadow 0.12s, border-color 0.12s, background 0.12s, transform 0.12s',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1, letterSpacing: '0.01em' }}>{group.name}</span>
                  </button>
                  {!group.collapsed && groupTabs.length > 0 && (
                    <>
                      <GroupConnector dashed />
                      {groupTabs.map((groupTab, index) => (
                        <React.Fragment key={groupTab.id}>
                          <TabItem
                            tab={groupTab}
                            isActive={activeTabId === groupTab.id}
                            icon={getIcon(groupTab.type)}
                            groupBadge={browserGroupBadgeForTab(groupTab)}
                            dragging={draggedTabId === groupTab.id}
                            dropTarget={dropGroupId === groupTab.groupId}
                            onSelect={() => setActiveTabId(groupTab.id)}
                            onContextMenu={(e) => handleContextMenu(e, groupTab)}
                            onDragStart={(e) => handleTabDragStart(e, groupTab)}
                            onDragEnd={handleTabDragEnd}
                            onDragOver={(e) => handleTabDropToTarget(e, groupTab)}
                            onDrop={(e) => handleTabDropToTarget(e, groupTab)}
                            onClose={(e) => { e.stopPropagation(); closeTab(groupTab.id); }}
                          />
                          {index < groupTabs.length - 1 && <GroupConnector />}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </div>
              );
            }

            return (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={activeTabId === tab.id}
                icon={getIcon(tab.type)}
                groupBadge={browserGroupBadgeForTab(tab)}
                dragging={draggedTabId === tab.id}
                dropTarget={dropGroupId === tab.groupId}
                onSelect={() => setActiveTabId(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab)}
                onDragStart={(e) => handleTabDragStart(e, tab)}
                onDragEnd={handleTabDragEnd}
                onDragOver={(e) => handleTabDropToTarget(e, tab)}
                onDrop={(e) => handleTabDropToTarget(e, tab)}
                onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              />
            );
          })}
        </div>

        <NewTabButton openTab={openTab} />
      </div>

      {ctxMenu && <TabContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </>
  );
};
