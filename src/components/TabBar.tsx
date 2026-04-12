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
import { ClaudeIcon, CodexIcon, PiIcon } from './AgentIcons';

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

const BrowserFaviconIcon: React.FC<{ faviconUrl?: string; pageUrl?: string }> = ({ faviconUrl, pageUrl }) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const [iconSrc, setIconSrc] = useState<string | undefined>(faviconUrl);
  const [triedIcoFallback, setTriedIcoFallback] = useState(false);

  const isNewTab = !pageUrl || pageUrl === 'about:blank' || pageUrl === 'chrome://newtab';

  useEffect(() => {
    setLoadFailed(false);
    setTriedIcoFallback(false);
    setIconSrc(faviconUrl);
  }, [faviconUrl]);

  const handleError = () => {
    if (!triedIcoFallback && pageUrl && !isNewTab) {
      try {
        const origin = new URL(pageUrl).origin;
        const icoFallback = `${origin}/favicon.ico`;
        if (iconSrc !== icoFallback) {
          setTriedIcoFallback(true);
          setIconSrc(icoFallback);
          return;
        }
      } catch {
        // ignore URL parsing fallback errors
      }
    }
    setLoadFailed(true);
  };

  if (isNewTab || !iconSrc || loadFailed) return <Globe size={14} />;

  return (
    <img
      src={iconSrc}
      alt=""
      draggable={false}
      onError={handleError}
      style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'cover' }}
    />
  );
};
import { useModal } from './Modal';
import { Tab } from '../types';

// ── Tab context menu ──────────────────────────────────────────────────

interface TabCtxMenu { x: number; y: number; tab: Tab; paneId?: string }
interface GroupCtxMenu { x: number; y: number; groupId: string }

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
const GROUP_COLOR_SWATCHES = ['#232323', '#dc2626', '#16a34a', '#2563eb', '#f59e0b', '#7c3aed'];
const isGroupableTab = (tab: Tab) => tab.type !== 'terminal' && tab.type !== 'new-tab' && tab.type !== 'claude' && tab.type !== 'codex' && tab.type !== 'pi';

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

const GroupConnector: React.FC<{ dashed?: boolean; cracking?: boolean; connecting?: boolean }> = ({
  dashed = false, cracking = false, connecting = false,
}) => {
  const w = dashed ? 18 : 16;
  const half = Math.floor(w / 2);
  const color = cracking ? '#93c5fd' : connecting ? 'var(--accent)' : GROUP_CONNECTOR_COLOR;

  if (cracking) {
    // Two halves that pull apart from the midpoint
    return (
      <div aria-hidden style={{ width: w, flexShrink: 0, alignSelf: 'center', display: 'flex', alignItems: 'center', height: 3, position: 'relative', overflow: 'visible' }}>
        <div style={{ width: half, height: 3, background: color, borderRadius: '1px 0 0 1px', transformOrigin: 'right center', animation: 'crack-left 0.5s ease-in-out infinite' }} />
        <div style={{ width: w - half, height: 3, background: color, borderRadius: '0 1px 1px 0', transformOrigin: 'left center', animation: 'crack-right 0.5s ease-in-out infinite' }} />
      </div>
    );
  }

  if (connecting) {
    // Grows from left (group side) toward the new tab
    return (
      <div aria-hidden style={{ width: w, flexShrink: 0, alignSelf: 'center', height: 3, background: color, borderRadius: 1, transformOrigin: 'left center', animation: 'connect-grow 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards', opacity: 0.9 }} />
    );
  }

  return (
    <div aria-hidden style={{
      width: w, flexShrink: 0, alignSelf: 'center',
      borderTop: `3px ${dashed ? 'dotted' : 'solid'} ${color}`,
      margin: 0, opacity: 0.95,
    }} />
  );
};

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
    splitRight,
    splitDown,
    closePane,
    panes,
    setActivePane,
    setActiveTabId,
  } = useTabs();
  const { deleteNode, renameNode, getNodeById } = useVault();
  const { confirm, prompt } = useModal();
  const ref = useRef<HTMLDivElement>(null);
  const tab = menu.tab;
  const isNote = tab.type === 'note';
  const isBrowser = tab.type === 'browser';
  const isGroupable = tab.type !== 'terminal' && tab.type !== 'new-tab' && tab.type !== 'claude' && tab.type !== 'codex' && tab.type !== 'pi';
  const node = isNote && tab.filePath ? getNodeById(tab.filePath) : null;
  const tabIndex = tabs.findIndex(t => t.id === tab.id);
  const canCloseLeft = tabIndex > 0;
  const canCloseRight = tabIndex >= 0 && tabIndex < tabs.length - 1;
  const canCloseOther = tabs.length > 1;
  const tabDisplayTitle = tab.customTitle ?? tab.title;
  const group = isGroupable ? getBrowserGroup(tab.groupId) : null;
  const groupedTabs = group ? tabs.filter(t => t.groupId === group.id) : [];
  const canDuplicateGroup = group ? groupedTabs.length > 0 : false;
  const canCloseGroup = group ? groupedTabs.length > 0 : false;

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
      defaultValue: tabDisplayTitle,
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
    if (!isGroupable) return;
    onClose();
    prompt({
      title: 'Create group',
      defaultValue: tabDisplayTitle,
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
    if (groupedTabs.length <= 1) deleteBrowserGroup(group.id);
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
      {panes.length > 1 && <TabCtxSep />}
      {panes.length > 1 && (
        <>
          <TabCtxItem icon={<PanelRight size={14} />} label="Split left" onClick={() => act(() => {
            if (menu.paneId) setActivePane(menu.paneId);
            setActiveTabId(tab.id);
            splitRight();
          })} />
          <TabCtxItem icon={<PanelBottom size={14} />} label="Split down" onClick={() => act(() => {
            if (menu.paneId) setActivePane(menu.paneId);
            setActiveTabId(tab.id);
            splitDown();
          })} />
          <TabCtxItem icon={<X size={14} />} label="Close this pane" onClick={() => act(() => closePane(menu.paneId || 'main'))} />
        </>
      )}
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
        </>
      )}
      {isGroupable && <TabCtxSep />}
      {isGroupable && (group ? (
        <TabCtxItem icon={<Link size={14} />} label="Remove from group" onClick={handleRemoveFromGroup} />
      ) : (
        <TabCtxItem icon={<FolderInput size={14} />} label="Create group from tab..." onClick={handleCreateGroupFromTab} />
      ))}
    </div>
  );
};

const BrowserGroupContextMenu: React.FC<{ menu: GroupCtxMenu; onClose: () => void }> = ({ menu, onClose }) => {
  const {
    deleteBrowserGroup,
    toggleBrowserGroupCollapsed,
    duplicateBrowserGroup,
    closeBrowserGroup,
    getBrowserGroup,
    updateBrowserGroup,
  } = useTabs();
  const ref = useRef<HTMLDivElement>(null);
  const group = getBrowserGroup(menu.groupId);

  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const [visible, setVisible] = useState(false);
  const [groupName, setGroupName] = useState('');

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

  useEffect(() => {
    if (!group) return;
    setGroupName(group.name);
  }, [group, menu]);

  if (!group) return null;

  const act = (fn: () => void) => { fn(); onClose(); };
  const handleRenameGroupInline = () => {
    const nextName = groupName.trim();
    if (!nextName) {
      setGroupName(group.name);
      return;
    }
    if (nextName !== group.name) {
      updateBrowserGroup(group.id, { name: nextName });
    }
  };
  const handlePickGroupColor = (color: string) => {
    updateBrowserGroup(group.id, { color });
  };
  const handleToggleGroupCollapsed = () => {
    act(() => toggleBrowserGroupCollapsed(group.id));
  };
  const handleDuplicateGroup = () => {
    act(() => duplicateBrowserGroup(group.id));
  };
  const handleUngroup = () => {
    act(() => deleteBrowserGroup(group.id));
  };
  const handleDeleteGroup = () => {
    act(() => closeBrowserGroup(group.id));
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
        minWidth: 260, background: 'var(--bg-primary)',
        border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        paddingTop: 4, paddingBottom: 4,
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <div style={{ padding: '10px 12px 6px' }}>
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          onBlur={handleRenameGroupInline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleRenameGroupInline();
            }
          }}
          placeholder="Group name"
          style={{
            width: '100%',
            height: 40,
            borderRadius: 10,
            border: `2px solid ${group.color}`,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            padding: '0 12px',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ padding: '8px 12px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 18, background: 'var(--bg-secondary)' }}>
          {GROUP_COLOR_SWATCHES.map(color => {
            const selected = group.color === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => handlePickGroupColor(color)}
                aria-label={`Set group color ${color}`}
                title={color}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: selected ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.20)',
                  background: color,
                  boxShadow: selected ? '0 0 0 2px rgba(99, 102, 241, 0.24)' : 'none',
                  cursor: 'default',
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>
      </div>
      <TabCtxSep />
      <TabCtxItem icon={<BookOpen size={14} />} label={group.collapsed ? 'Expand group' : 'Collapse group'} onClick={handleToggleGroupCollapsed} />
      <TabCtxItem icon={<PlusCircle size={14} />} label="Duplicate group" onClick={handleDuplicateGroup} />
      <TabCtxItem icon={<Link size={14} />} label="Ungroup" onClick={handleUngroup} />
      <TabCtxItem icon={<Trash2 size={14} />} label="Delete group" danger onClick={handleDeleteGroup} />
    </div>
  );
};

// ── New tab button ────────────────────────────────────────────────────

const NewTabButton: React.FC<{ openTab: any; paneId?: string }> = ({ openTab, paneId }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => openTab({ type: 'new-tab', title: 'New tab' }, paneId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title="New tab"
      style={{
        marginLeft: 8, marginRight: 8, marginTop: 5, marginBottom: 5,
        padding: '0 8px', height: 'calc(100% - 10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', cursor: 'default',
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
  grouped?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  compact?: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}> = ({ tab, isActive, icon, groupBadge, grouped, dragging, dropTarget, compact = false, onSelect, onClose, onContextMenu, onDragStart, onDragEnd }) => {
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const isBrowserTab = tab.type === 'browser';
  const isGroupedTab = !!groupBadge;
  const isCollapsedGroup = !!groupBadge?.collapsed;
  const showTitle = !isCollapsedGroup;
  const showGroupBadge = false;
  const showIcon = !compact;
  const groupColor = groupBadge?.color ?? null;
  const minWidth = compact
    ? (isCollapsedGroup ? 74 : isBrowserTab ? 78 : 76)
    : (isCollapsedGroup ? 102 : isBrowserTab ? 205 : 132);
  const maxWidth = compact
    ? (isCollapsedGroup ? 98 : isBrowserTab ? 126 : 118)
    : (isCollapsedGroup ? 132 : isBrowserTab ? 324 : 232);
  const paddingRight = compact
    ? (isCollapsedGroup ? 18 : 22)
    : (isCollapsedGroup ? 34 : isBrowserTab ? 48 : 32);

  return (
    <div
      data-tab-id={tab.id}
      draggable={tab.type !== 'new-tab'}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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
        marginRight: compact ? 0 : (grouped ? 0 : 12),
        display: 'flex',
        alignItems: 'center',
        border: compact ? 'none' : (groupColor ? `2px solid ${groupColor}` : `1px solid var(--border)`),
        borderRadius: compact ? 0 : 7,
        transition: 'background 0.1s, color 0.1s, box-shadow 0.1s, border-color 0.1s, opacity 0.12s, transform 0.12s',
        position: 'relative',
        paddingLeft: compact ? 10 : (isCollapsedGroup ? 12 : 14),
        paddingRight,
        gap: isCollapsedGroup ? 6 : (compact ? 6 : 8),
        minWidth,
        maxWidth,
        flexShrink: compact ? 1 : 0,
        background: compact
          ? 'transparent'
          : groupColor
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
        opacity: dragging ? 0.4 : 1,
        transform: dragging ? 'scale(0.94)' : 'scale(1)',
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
        <span
          style={{
            fontSize: compact ? 12 : 13,
            flex: 1,
            overflow: 'hidden',
            textOverflow: isBrowserTab ? 'clip' : 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: groupColor ? 600 : 400,
            color: groupColor ? GROUP_TEXT_COLOR : undefined,
            maskImage: isBrowserTab ? `linear-gradient(to right, black 0%, black calc(100% - ${compact ? 22 : 30}px), transparent 100%)` : undefined,
            WebkitMaskImage: isBrowserTab ? `linear-gradient(to right, black 0%, black calc(100% - ${compact ? 22 : 30}px), transparent 100%)` : undefined,
          }}
        >
          {tab.customTitle ?? tab.title}
        </span>
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
          width: compact ? 15 : 19,
          height: compact ? 15 : 19,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          border: 'none',
          background: closeHovered ? (groupColor ? tintHex(groupColor, 0.14) : 'var(--bg-active)') : 'transparent',
          color: closeHovered ? GROUP_TEXT_COLOR : (groupColor ? GROUP_TEXT_COLOR : 'var(--text-muted)'),
          opacity: compact
            ? (isActive ? 0.9 : hovered ? 0.75 : 0.5)
            : (isBrowserTab ? (closeHovered ? 1 : 0.78) : (isActive ? (closeHovered ? 1 : 0.75) : hovered ? (closeHovered ? 1 : 0.7) : 0)),
          cursor: 'default',
          transition: 'background 0.1s, color 0.1s, opacity 0.1s',
          position: 'absolute',
          right: compact ? 3 : 8,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <X size={compact ? 10 : 13} />
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
    moveTabToPane,
    reorderTabs,
    createBrowserGroup,
    activePaneId,
    panes,
    setActivePane,
  } = useTabs();
  const [ctxMenu, setCtxMenu] = useState<TabCtxMenu | null>(null);
  const [groupCtxMenu, setGroupCtxMenu] = useState<GroupCtxMenu | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const draggedTabIdRef = useRef<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  // insertBefore: tab id = show line before that tab, 'end' = after all tabs, null = none
  const [insertBefore, setInsertBefore] = useState<string | 'end' | null>(null);
  const tabStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTabId) return;
    const strip = tabStripRef.current;
    if (!strip) return;

    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return;

    const activeIndex = tabs.findIndex(tab => tab.id === activeTabId);
    if (activeIndex === tabs.length - 1) {
      strip.scrollTo({ left: strip.scrollWidth, behavior: 'smooth' });
      return;
    }

    const tabEl = strip.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    const groupEl = activeTab.groupId
      ? strip.querySelector(`[data-group-id="${activeTab.groupId}"]`) as HTMLElement | null
      : null;
    const target = tabEl ?? groupEl;
    if (!target) return;

    const stripRect = strip.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const isOutOfView = targetRect.left < stripRect.left || targetRect.right > stripRect.right;
    if (isOutOfView) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [activeTabId, tabs, browserGroups]);

  const getIcon = (tab: Tab) => {
    switch (tab.type) {
      case 'note': return <MarkdownIcon size={14} />;
      case 'browser': return <BrowserFaviconIcon faviconUrl={tab.faviconUrl} pageUrl={tab.url} />;
      case 'draw': return <ExcalidrawIcon size={14} />;
      case 'image': return <ImageFileIcon size={14} />;
      case 'terminal': return <SquareTerminal size={14} />;
      case 'claude': return <ClaudeIcon size={14} />;
      case 'codex': return <CodexIcon size={14} />;
      case 'pi': return <PiIcon size={14} />;
      case 'new-tab': return <Plus size={14} />;
      default: return <MarkdownIcon size={14} />;
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab, paneId?: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tab, paneId: paneId ?? activePaneId });
  }, [activePaneId]);

  const clearDragState = useCallback(() => {
    draggedTabIdRef.current = null;
    setDraggedTabId(null);
    setDropGroupId(null);
    setInsertBefore(null);
  }, []);

  const getDraggedTabId = useCallback((e: React.DragEvent) => {
    return draggedTabIdRef.current
      || e.dataTransfer.getData('application/x-ibsidian-tab-id')
      || e.dataTransfer.getData('text/plain')
      || null;
  }, []);

  const handleTabDragStart = useCallback((e: React.DragEvent, tab: Tab) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-ibsidian-tab-id', tab.id);
    e.dataTransfer.setData('text/plain', tab.id);
    draggedTabIdRef.current = tab.id;
    setDraggedTabId(tab.id);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const sourceId = draggedTabIdRef.current;
    if (!sourceId) return;
    const sourceTab = tabs.find(t => t.id === sourceId);

    const tabEl = (e.target as HTMLElement).closest('[data-tab-id]') as HTMLElement | null;

    if (!tabEl) {
      // Check if hovering over a group wrapper (connectors, padding, etc.)
      const groupEl = (e.target as HTMLElement).closest('[data-group-id]') as HTMLElement | null;
      if (groupEl) {
        const gId = groupEl.dataset.groupId!;
        if (sourceTab?.groupId !== gId && isGroupableTab(sourceTab!)) {
          setDropGroupId(gId);
          setInsertBefore(null);
          return;
        }
      }
      setInsertBefore('end');
      setDropGroupId(null);
      return;
    }

    const targetId = tabEl.dataset.tabId!;
    if (targetId === sourceId) return;

    const targetTab = tabs.find(t => t.id === targetId);
    const rect = tabEl.getBoundingClientRect();
    const idx = tabs.findIndex(t => t.id === targetId);

    // Hovering over a grouped tab from a different (or no) group → magnetic group join
    if (targetTab?.groupId && sourceTab?.groupId !== targetTab.groupId && isGroupableTab(sourceTab!)) {
      setDropGroupId(targetTab.groupId);
      setInsertBefore(null);
    } else {
      setDropGroupId(null);
      if (e.clientX < rect.left + rect.width / 2) {
        setInsertBefore(targetId);
      } else {
        const next = tabs[idx + 1];
        setInsertBefore(next ? next.id : 'end');
      }
    }
  }, [tabs]);

  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = draggedTabIdRef.current;
    if (!sourceId) { clearDragState(); return; }
    const sourceTab = tabs.find(t => t.id === sourceId);

    const tabEl = (e.target as HTMLElement).closest('[data-tab-id]') as HTMLElement | null;

    if (!tabEl) {
      // Drop on group wrapper (connectors, etc.) — add to that group
      const groupEl = (e.target as HTMLElement).closest('[data-group-id]') as HTMLElement | null;
      if (groupEl && sourceTab && isGroupableTab(sourceTab)) {
        const gId = groupEl.dataset.groupId!;
        if (sourceTab.groupId !== gId) moveTabToGroup(sourceId, gId);
      }
      clearDragState();
      return;
    }

    const targetId = tabEl.dataset.tabId!;
    if (targetId === sourceId) { clearDragState(); return; }

    const targetTab = tabs.find(t => t.id === targetId);
    if (!sourceTab || !targetTab) { clearDragState(); return; }

    const rect = tabEl.getBoundingClientRect();
    const position: 'before' | 'after' = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';

    // Cross-group membership change
    if (targetTab.groupId && sourceTab.groupId !== targetTab.groupId && isGroupableTab(sourceTab)) {
      moveTabToGroup(sourceId, targetTab.groupId);
    } else if (!targetTab.groupId && sourceTab.groupId) {
      // Drop grouped tab onto ungrouped tab → leave group
      moveTabToGroup(sourceId, null);
    }
    reorderTabs(sourceId, targetId, position);
    clearDragState();
  }, [clearDragState, moveTabToGroup, reorderTabs, tabs]);

  const handleGroupDrop = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceTabId = getDraggedTabId(e);
    if (!sourceTabId) return;
    const sourceTab = tabs.find(t => t.id === sourceTabId);
    if (!sourceTab || !isGroupableTab(sourceTab)) return;
    moveTabToGroup(sourceTabId, groupId);
    setDropGroupId(null);
    setDraggedTabId(null);
  }, [getDraggedTabId, moveTabToGroup, tabs]);

  const handleGroupDragOver = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropGroupId(groupId);
    setInsertBefore(null);
  }, []);

  const browserGroupBadgeForTab = (tab: Tab) => {
    if (!isGroupableTab(tab)) return null;
    const group = getBrowserGroup(tab.groupId);
    return group ? { name: group.name, color: group.color, collapsed: !!group.collapsed } : null;
  };

  const renderedGroupIds = new Set<string>();
  const draggedTab = draggedTabId ? tabs.find(t => t.id === draggedTabId) : null;
  const draggingFromGroupId = draggedTab?.groupId ?? null;

  return (
    <>
      <div ref={tabStripRef} style={{ height: 46, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'stretch', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', zIndex: 30, borderBottom: '1px solid var(--border)', position: 'relative' }}>
        {panes.length === 1 ? (
          <>
            <div
              style={{ display: 'flex', height: '100%', alignItems: 'stretch', paddingLeft: 6 }}
              onDragOver={handleContainerDragOver}
              onDrop={handleContainerDrop}
            >
              {tabs.map((tab) => {
                const insertLine = (
                  <div style={{
                    width: insertBefore === tab.id ? 2 : 0,
                    minWidth: insertBefore === tab.id ? 2 : 0,
                    alignSelf: 'stretch', margin: '4px 0',
                    borderRadius: 1, background: 'var(--accent)',
                    transition: 'width 0.08s, min-width 0.08s',
                    flexShrink: 0,
                  }} />
                );

                if (tab.groupId && isGroupableTab(tab)) {
                  const group = getBrowserGroup(tab.groupId);
                  if (!group) {
                    return (
                      <React.Fragment key={tab.id}>
                        {insertLine}
                        <TabItem
                          tab={tab}
                          isActive={activeTabId === tab.id}
                          icon={getIcon(tab)}
                          groupBadge={browserGroupBadgeForTab(tab)}
                          grouped
                          dragging={draggedTabId === tab.id}
                          dropTarget={false}
                          compact={false}
                          onSelect={() => setActiveTabId(tab.id)}
                          onContextMenu={(e) => handleContextMenu(e, tab)}
                          onDragStart={(e) => handleTabDragStart(e, tab)}
                          onDragEnd={handleTabDragEnd}
                          onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                        />
                      </React.Fragment>
                    );
                  }

                  if (renderedGroupIds.has(group.id)) return null;
                  renderedGroupIds.add(group.id);
                  const groupTabs = tabs.filter(t => t.groupId === group.id);
                  const isDropTarget = dropGroupId === group.id;
                  const firstTab = groupTabs[0];
                  const crackedIdx = draggingFromGroupId === group.id
                    ? groupTabs.findIndex(t => t.id === draggedTabId)
                    : -1;
                  return (
                    <React.Fragment key={group.id}>
                      {firstTab && insertBefore === firstTab.id && (
                        <div style={{ width: 2, alignSelf: 'stretch', margin: '4px 0', borderRadius: 1, background: 'var(--accent)', flexShrink: 0 }} />
                      )}
                      <div data-group-id={group.id} style={{ display: 'flex', alignItems: 'stretch', marginRight: 12 }}>
                        <button
                          onClick={() => toggleBrowserGroupCollapsed(group.id)}
                          title={group.collapsed ? 'Expand group' : 'Collapse group'}
                          aria-label={group.collapsed ? 'Expand group' : 'Collapse group'}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setGroupCtxMenu({ x: e.clientX, y: e.clientY, groupId: group.id });
                          }}
                          onDragOver={(e) => handleGroupDragOver(e, group.id)}
                          onDragLeave={() => setDropGroupId(null)}
                          onDrop={(e) => handleGroupDrop(e, group.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            margin: '4px 0 4px 0', marginRight: group.collapsed ? 12 : 0,
                            padding: '0 18px', height: 'calc(100% - 8px)', borderRadius: 7,
                            border: `2px solid ${group.color}`,
                            background: isDropTarget
                              ? tintHex(group.color, 0.38)
                              : tintHex(group.color, group.collapsed ? 0.22 : 0.24),
                            color: GROUP_TEXT_COLOR, cursor: 'default',
                            boxShadow: isDropTarget ? `0 0 0 3px ${tintHex(group.color, 0.4)}` : '0 0 0 1px rgba(0,0,0,0.04)',
                            transform: isDropTarget ? 'scale(1.04)' : 'scale(1)',
                            transition: 'box-shadow 0.12s, background 0.12s, transform 0.12s, margin-right 0.2s ease',
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1, letterSpacing: '0.01em' }}>{group.name}</span>
                        </button>
                        <div style={{
                          display: 'flex', alignItems: 'stretch',
                          maxWidth: group.collapsed ? 0 : 3000,
                          overflow: 'hidden',
                          opacity: group.collapsed ? 0 : 1,
                          pointerEvents: group.collapsed ? 'none' : undefined,
                          transition: 'max-width 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease',
                        }}>
                          <GroupConnector dashed cracking={crackedIdx === 0} connecting={isDropTarget && crackedIdx === -1} />
                          {groupTabs.map((groupTab, index) => (
                            <React.Fragment key={groupTab.id}>
                              <TabItem
                                tab={groupTab}
                                isActive={activeTabId === groupTab.id}
                                icon={getIcon(groupTab)}
                                groupBadge={browserGroupBadgeForTab(groupTab)}
                                grouped
                                dragging={draggedTabId === groupTab.id}
                                dropTarget={dropGroupId === groupTab.groupId}
                                compact={false}
                                onSelect={() => setActiveTabId(groupTab.id)}
                                onContextMenu={(e) => handleContextMenu(e, groupTab)}
                                onDragStart={(e) => handleTabDragStart(e, groupTab)}
                                onDragEnd={handleTabDragEnd}
                                onClose={(e) => { e.stopPropagation(); closeTab(groupTab.id); }}
                              />
                              {index < groupTabs.length - 1 && (
                                <GroupConnector cracking={crackedIdx === index + 1} />
                              )}
                            </React.Fragment>
                          ))}
                          {isDropTarget && crackedIdx === -1 && <GroupConnector connecting />}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={tab.id}>
                    {insertLine}
                    <TabItem
                      tab={tab}
                      isActive={activeTabId === tab.id}
                      icon={getIcon(tab)}
                      groupBadge={browserGroupBadgeForTab(tab)}
                      grouped={false}
                      dragging={draggedTabId === tab.id}
                      dropTarget={false}
                      compact={false}
                      onSelect={() => setActiveTabId(tab.id)}
                      onContextMenu={(e) => handleContextMenu(e, tab)}
                      onDragStart={(e) => handleTabDragStart(e, tab)}
                      onDragEnd={handleTabDragEnd}
                      onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    />
                  </React.Fragment>
                );
              })}
              <div style={{ width: insertBefore === 'end' ? 2 : 0, minWidth: insertBefore === 'end' ? 2 : 0, alignSelf: 'stretch', margin: '4px 0', borderRadius: 1, background: 'var(--accent)', flexShrink: 0, transition: 'width 0.08s, min-width 0.08s' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginLeft: 2, paddingLeft: 2 }}>
              {tabs.length > 0 && <div aria-hidden style={{ width: 1, height: 14, background: 'var(--border)', marginRight: 4, opacity: 0.9 }} />}
              <NewTabButton openTab={openTab} />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'stretch' }}>
            {panes.map((pane, idx) => {
              const paneTabs = tabs.filter(t => (t.paneId ?? 'main') === pane.id);
              const stripWidth = tabStripRef.current?.clientWidth ?? window.innerWidth;
              const estimatedPaneWidth = Math.max(180, Math.floor(stripWidth / Math.max(1, panes.length)) - 24);
              const estimatedTabNeed = paneTabs.length * 132 + 44; // tabs + plus button area
              const compactPaneTabs = panes.length > 1 && estimatedTabNeed > estimatedPaneWidth;
              return (
                <React.Fragment key={pane.id}>
                  {idx > 0 && <div style={{ width: 2, background: 'var(--border)', opacity: 0.9, flexShrink: 0 }} />}
                  <div
                    onClick={() => setActivePane(pane.id)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = getDraggedTabId(e);
                      if (!draggedId) return;
                      moveTabToPane(draggedId, pane.id);
                      clearDragState();
                    }}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', paddingLeft: 6, paddingRight: 4, overflowX: 'auto' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0, flex: 1 }}>
                      {compactPaneTabs && paneTabs.length > 0 && <div aria-hidden style={{ width: 1, background: 'var(--border-strong)', opacity: 0.95, margin: '9px 0', flexShrink: 0 }} />}
                      {paneTabs.map(tab => (
                        <React.Fragment key={tab.id}>
                          <TabItem
                            tab={tab}
                            isActive={activePaneId === pane.id && activeTabId === tab.id}
                            icon={getIcon(tab)}
                            groupBadge={browserGroupBadgeForTab(tab)}
                            grouped={!!tab.groupId && isGroupableTab(tab)}
                            dragging={draggedTabId === tab.id}
                            dropTarget={false}
                            compact={compactPaneTabs}
                            onSelect={() => setActiveTabId(tab.id)}
                            onContextMenu={(e) => handleContextMenu(e, tab, pane.id)}
                            onDragStart={(e) => handleTabDragStart(e, tab)}
                            onDragEnd={handleTabDragEnd}
                            onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                          />
                          {compactPaneTabs && <div aria-hidden style={{ width: 1, background: 'var(--border-strong)', opacity: 0.95, margin: '9px 0', flexShrink: 0 }} />}
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: 2, paddingLeft: 2 }}>
                      {paneTabs.length > 0 && <div aria-hidden style={{ width: 1, height: 14, background: 'var(--border)', marginRight: 4, opacity: 0.9 }} />}
                      <NewTabButton openTab={openTab} paneId={pane.id} />
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {ctxMenu && <TabContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
      {groupCtxMenu && <BrowserGroupContextMenu menu={groupCtxMenu} onClose={() => setGroupCtxMenu(null)} />}
    </>
  );
};
