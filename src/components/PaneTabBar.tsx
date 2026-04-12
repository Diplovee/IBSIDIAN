import React, { useEffect, useRef, useState } from 'react';

// NOTE: User-requested guardrail — keep changes in this tab strip minimal unless explicitly requested.
// This is the source of truth for split-pane tab rendering and grouping behavior.
import { Globe, SquareTerminal, Plus, PanelRight, PanelBottom, X } from 'lucide-react';
import { ClaudeIcon, CodexIcon, PiIcon, ProductivityIcon } from './AgentIcons';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { isGroupableTab } from '../utils/tabGrouping';
import type { BrowserTabGroup, Tab } from '../types';

const MarkdownTabIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      fill="currentColor"
      d="M22.27 19.385H1.73A1.73 1.73 0 0 1 0 17.655V6.345a1.73 1.73 0 0 1 1.73-1.73h20.54A1.73 1.73 0 0 1 24 6.345v11.308a1.73 1.73 0 0 1-1.73 1.731zM5.769 15.923v-4.5l2.308 2.885l2.307-2.885v4.5h2.308V8.078h-2.308l-2.307 2.885l-2.308-2.885H3.46v7.847zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.461 4.039z"
    />
  </svg>
);

const hexToRgb = (value: string) => {
  const hex = value.replace('#', '').trim();
  if (hex.length !== 6) return null;
  const num = Number.parseInt(hex, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const tintHex = (value: string, alpha: number) => {
  const rgb = hexToRgb(value);
  if (!rgb) return value;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const GROUP_TEXT_COLOR = '#111827';
const GROUP_CONNECTOR_COLOR = '#2b2b2b';

const GroupConnector: React.FC<{ dashed?: boolean; cracking?: boolean; connecting?: boolean }> = ({ dashed = false, cracking = false, connecting = false }) => {
  const w = dashed ? 14 : 12;
  const half = Math.floor(w / 2);
  const color = cracking ? '#93c5fd' : connecting ? 'var(--accent)' : GROUP_CONNECTOR_COLOR;

  if (cracking) {
    return (
      <div aria-hidden style={{ width: w, flexShrink: 0, alignSelf: 'center', display: 'flex', alignItems: 'center', height: 3, position: 'relative', overflow: 'visible' }}>
        <div style={{ width: half, height: 3, background: color, borderRadius: '1px 0 0 1px', transformOrigin: 'right center', animation: 'crack-left 0.5s ease-in-out infinite' }} />
        <div style={{ width: w - half, height: 3, background: color, borderRadius: '0 1px 1px 0', transformOrigin: 'left center', animation: 'crack-right 0.5s ease-in-out infinite' }} />
      </div>
    );
  }

  if (connecting) {
    return <div aria-hidden style={{ width: w, flexShrink: 0, alignSelf: 'center', height: 3, background: color, borderRadius: 1, transformOrigin: 'left center', animation: 'connect-grow 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards', opacity: 0.9 }} />;
  }

  return <div aria-hidden style={{ width: w, flexShrink: 0, alignSelf: 'center', borderTop: `3px ${dashed ? 'dotted' : 'solid'} ${color}`, opacity: 0.95 }} />;
};

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

  if (isNewTab || !iconSrc || loadFailed) return <Globe size={13} />;
  return <img src={iconSrc} alt="" draggable={false} onError={handleError} style={{ width: 13, height: 13, borderRadius: 3, objectFit: 'cover' }} />;
};

const iconForTab = (tab: Tab) => {
  switch (tab.type) {
    case 'browser': return <BrowserFaviconIcon faviconUrl={tab.faviconUrl} pageUrl={tab.url} />;
    case 'draw': return <ExcalidrawIcon size={13} />;
    case 'terminal': return <SquareTerminal size={13} />;
    case 'claude': return <ClaudeIcon size={13} />;
    case 'codex': return <CodexIcon size={13} />;
    case 'pi': return <PiIcon size={13} />;
    case 'productivity': return <ProductivityIcon size={13} />;
    case 'note': return <MarkdownTabIcon size={13} />;
    default: return <MarkdownTabIcon size={13} />;
  }
};

type PromptValue = (options: {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}) => Promise<string | null | undefined>;

interface PaneTabBarProps {
  paneId: string;
  paneTabs: Tab[];
  allTabs: Tab[];
  activeTabId: string | null;
  getBrowserGroup: (groupId?: string | null) => BrowserTabGroup | null;
  setActiveTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  openNewTab: () => void;
  onTabContextMenu: (e: React.MouseEvent, tabId: string, paneId: string) => void;
  reorderTabs: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  moveTabToPane: (tabId: string, paneId: string) => void;
  moveTabToPaneAt: (tabId: string, paneId: string, targetId: string, position: 'before' | 'after') => void;
  moveTabToGroup: (tabId: string, groupId?: string | null) => void;
  toggleBrowserGroupCollapsed: (groupId: string) => void;
  updateBrowserGroup: (groupId: string, patch: Partial<Omit<BrowserTabGroup, 'id'>>) => void;
  duplicateBrowserGroup: (groupId: string) => void;
  deleteBrowserGroup: (groupId: string) => void;
  closeBrowserGroup: (groupId: string) => void;
  promptValue: PromptValue;
  paneCount: number;
  onClosePane: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
}

export const PaneTabBar: React.FC<PaneTabBarProps> = ({
  paneId,
  paneTabs,
  allTabs,
  activeTabId,
  getBrowserGroup,
  setActiveTab,
  closeTab,
  openNewTab,
  onTabContextMenu,
  reorderTabs,
  moveTabToPane,
  moveTabToPaneAt,
  moveTabToGroup,
  toggleBrowserGroupCollapsed,
  updateBrowserGroup,
  duplicateBrowserGroup,
  deleteBrowserGroup,
  closeBrowserGroup,
  promptValue,
  paneCount,
  onClosePane,
  onSplitRight,
  onSplitDown,
}) => {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const draggedTabIdRef = useRef<string | null>(null);
  const draggedPaneIdRef = useRef<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  const [paneDropTarget, setPaneDropTarget] = useState(false);
  const [insertBefore, setInsertBefore] = useState<string | 'end' | null>(null);
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ x: number; y: number; groupId: string } | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const addMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [addMenuOpen]);

  const getDraggedTabId = (e: React.DragEvent) => draggedTabIdRef.current || e.dataTransfer.getData('text/tab-id') || e.dataTransfer.getData('text/plain') || null;
  const getDraggedPaneId = (e: React.DragEvent) => draggedPaneIdRef.current || e.dataTransfer.getData('text/pane-id') || null;

  const clearDragState = () => {
    window.setTimeout(() => {
      draggedTabIdRef.current = null;
      draggedPaneIdRef.current = null;
      setDraggedTabId(null);
      setDropGroupId(null);
      setInsertBefore(null);
      setPaneDropTarget(false);
    }, 0);
  };

  useEffect(() => {
    if (!groupCtxMenu) return;
    const close = () => setGroupCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [groupCtxMenu]);

  useEffect(() => {
    if (!activeTabId) return;
    const strip = stripRef.current;
    if (!strip) return;

    const activeTab = paneTabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return;

    let target: HTMLElement | null = null;
    if (activeTab.groupId) {
      const group = getBrowserGroup(activeTab.groupId);
      if (group?.collapsed) {
        target = strip.querySelector(`[data-group-id="${activeTab.groupId}"]`) as HTMLElement | null;
      }
    }
    if (!target) {
      target = strip.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    }
    if (!target) return;

    const stripRect = strip.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (targetRect.left < stripRect.left || targetRect.right > stripRect.right) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [activeTabId, paneTabs, getBrowserGroup]);

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/tab-id', tabId);
    e.dataTransfer.setData('text/pane-id', paneId);
    e.dataTransfer.setData('text/plain', tabId);
    draggedTabIdRef.current = tabId;
    draggedPaneIdRef.current = paneId;
    setDraggedTabId(tabId);
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = getDraggedTabId(e);
    const sourcePaneId = getDraggedPaneId(e);
    if (!sourceId) { clearDragState(); return; }

    const sourceTab = allTabs.find(t => t.id === sourceId);
    const groupEl = (e.target as HTMLElement).closest('[data-group-id]') as HTMLElement | null;
    if (groupEl) {
      const groupId = groupEl.dataset.groupId!;
      if (sourcePaneId !== paneId) moveTabToPane(sourceId, paneId);
      if (sourceTab && isGroupableTab(sourceTab)) moveTabToGroup(sourceId, groupId);
      clearDragState();
      return;
    }

    if (insertBefore) {
      if (insertBefore === 'end') {
        const tail = paneTabs.filter(t => t.id !== sourceId).at(-1);
        if (tail) {
          if (sourcePaneId === paneId) reorderTabs(sourceId, tail.id, 'after');
          else moveTabToPaneAt(sourceId, paneId, tail.id, 'after');
        } else if (sourcePaneId !== paneId) {
          moveTabToPane(sourceId, paneId);
        }
      } else {
        const targetTab = paneTabs.find(t => t.id === insertBefore);
        if (targetTab) {
          if (sourcePaneId === paneId) reorderTabs(sourceId, targetTab.id, 'before');
          else moveTabToPaneAt(sourceId, paneId, targetTab.id, 'before');

          if (sourceTab && isGroupableTab(sourceTab)) {
            if (targetTab.groupId && sourceTab.groupId !== targetTab.groupId) moveTabToGroup(sourceId, targetTab.groupId);
            else if (!targetTab.groupId && sourceTab.groupId) moveTabToGroup(sourceId, null);
          }
        }
      }
      clearDragState();
      return;
    }

    if (sourcePaneId && sourcePaneId !== paneId) moveTabToPane(sourceId, paneId);
    clearDragState();
  };

  const draggedTab = draggedTabId ? allTabs.find(t => t.id === draggedTabId) : null;
  const draggingFromGroupId = draggedTab?.groupId ?? null;
  const renderedGroupIds = new Set<string>();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const srcPane = getDraggedPaneId(e);
        setPaneDropTarget(!!srcPane && srcPane !== paneId);

        const sourceId = getDraggedTabId(e);
        if (!sourceId) return;
        const sourceTab = allTabs.find(t => t.id === sourceId);

        const tabEl = (e.target as HTMLElement).closest('[data-tab-id]') as HTMLElement | null;
        if (!tabEl) {
          const groupEl = (e.target as HTMLElement).closest('[data-group-id]') as HTMLElement | null;
          if (groupEl && sourceTab && isGroupableTab(sourceTab)) {
            const gId = groupEl.dataset.groupId!;
            if (sourceTab.groupId !== gId) {
              setDropGroupId(gId);
              setInsertBefore(null);
              return;
            }
          }
          setDropGroupId(null);
          setInsertBefore('end');
          return;
        }

        const targetId = tabEl.dataset.tabId!;
        if (targetId === sourceId) return;

        const targetTab = paneTabs.find(t => t.id === targetId);
        if (!targetTab) return;

        if (targetTab.groupId && sourceTab && isGroupableTab(sourceTab) && sourceTab.groupId !== targetTab.groupId) {
          setDropGroupId(targetTab.groupId);
          setInsertBefore(null);
          return;
        }

        setDropGroupId(null);
        const rect = tabEl.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
          setInsertBefore(targetId);
        } else {
          const idx = paneTabs.findIndex(t => t.id === targetId);
          const next = paneTabs[idx + 1];
          setInsertBefore(next ? next.id : 'end');
        }
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaneDropTarget(false); }}
      onDrop={handleContainerDrop}
      style={{
        height: 46,
        borderBottom: `1px solid ${paneDropTarget ? 'var(--accent)' : 'var(--border)'}`,
        background: paneDropTarget ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-secondary))' : 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'stretch',
        padding: '0 6px',
        overflow: 'hidden',
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      <div ref={stripRef} style={{ display: 'flex', alignItems: 'stretch', minWidth: 0, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {paneTabs.map((tab) => {
          const insertLine = (
            <div
              key={`insert-${tab.id}`}
              style={{
                width: insertBefore === tab.id ? 2 : 0,
                minWidth: insertBefore === tab.id ? 2 : 0,
                alignSelf: 'stretch',
                margin: '4px 0',
                borderRadius: 1,
                background: 'var(--accent)',
                transition: 'width 0.08s, min-width 0.08s',
                flexShrink: 0,
              }}
            />
          );

          if (tab.groupId && isGroupableTab(tab)) {
            const group = getBrowserGroup(tab.groupId);
            if (!group) return null;
            if (renderedGroupIds.has(group.id)) return null;
            renderedGroupIds.add(group.id);
            const groupTabs = paneTabs.filter(t => t.groupId === group.id);
            const firstTab = groupTabs[0];
            const isDropTarget = dropGroupId === group.id;
            const crackedIdx = draggingFromGroupId === group.id ? groupTabs.findIndex(t => t.id === draggedTabId) : -1;

            return (
              <React.Fragment key={group.id}>
                {firstTab && insertBefore === firstTab.id && insertLine}
                <button
                  data-group-id={group.id}
                  onClick={() => toggleBrowserGroupCollapsed(group.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setGroupCtxMenu({ x: e.clientX, y: e.clientY, groupId: group.id });
                  }}
                  title={group.collapsed ? 'Expand group' : 'Collapse group'}
                  aria-label={group.collapsed ? 'Expand group' : 'Collapse group'}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropGroupId(group.id);
                  }}
                  onDragLeave={() => setDropGroupId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceId = getDraggedTabId(e);
                    const sourcePaneId = getDraggedPaneId(e);
                    if (!sourceId) return;
                    const sourceTab = allTabs.find(t => t.id === sourceId);
                    if (!sourceTab || !isGroupableTab(sourceTab)) return;
                    if (sourcePaneId !== paneId) moveTabToPane(sourceId, paneId);
                    moveTabToGroup(sourceId, group.id);
                    clearDragState();
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    margin: '4px 0', marginRight: group.collapsed ? 4 : 0,
                    padding: '0 12px', height: 'calc(100% - 8px)', borderRadius: 7,
                    border: `1px solid ${group.color}`,
                    background: isDropTarget ? tintHex(group.color, 0.28) : tintHex(group.color, group.collapsed ? 0.14 : 0.16),
                    color: GROUP_TEXT_COLOR,
                    boxShadow: isDropTarget ? `0 0 0 3px ${tintHex(group.color, 0.4)}` : '0 0 0 1px rgba(0,0,0,0.04)',
                    transform: isDropTarget ? 'scale(1.04)' : 'scale(1)',
                    transition: 'box-shadow 0.12s, background 0.12s, transform 0.12s, margin-right 0.2s ease',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 12, lineHeight: 1 }}>{group.name}</span>
                </button>
                <div
                  data-group-id={group.id}
                  style={{
                    display: 'flex', alignItems: 'stretch',
                    maxWidth: group.collapsed ? 0 : 3000,
                    overflow: 'hidden',
                    opacity: group.collapsed ? 0 : 1,
                    pointerEvents: group.collapsed ? 'none' : undefined,
                    transition: 'max-width 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease',
                    marginRight: 4,
                    flexShrink: 0,
                  }}
                >
                  <GroupConnector dashed cracking={crackedIdx === 0} connecting={isDropTarget && crackedIdx === -1} />
                  {groupTabs.map((groupTab, index) => {
                    const isActive = activeTabId === groupTab.id;
                    const isDragging = draggedTabId === groupTab.id;
                    const groupColor = group.color;
                    return (
                      <React.Fragment key={groupTab.id}>
                        <div
                          data-tab-id={groupTab.id}
                          draggable={groupTab.type !== 'new-tab'}
                          onDragStart={(e) => handleDragStart(e, groupTab.id)}
                          onDragEnd={clearDragState}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const sourceId = getDraggedTabId(e);
                            const sourcePaneId = getDraggedPaneId(e);
                            if (!sourceId || sourceId === groupTab.id) return;
                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const position: 'before' | 'after' = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                            if (sourcePaneId === paneId) reorderTabs(sourceId, groupTab.id, position);
                            else moveTabToPaneAt(sourceId, paneId, groupTab.id, position);
                            const sourceTab = allTabs.find(t => t.id === sourceId);
                            if (sourceTab && isGroupableTab(sourceTab) && sourceTab.groupId !== group.id) moveTabToGroup(sourceId, group.id);
                            clearDragState();
                          }}
                          onContextMenu={(e) => onTabContextMenu(e, groupTab.id, paneId)}
                          onClick={() => setActiveTab(groupTab.id)}
                          style={{
                            height: 'calc(100% - 8px)',
                            marginTop: 4,
                            marginBottom: 4,
                            marginRight: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            minWidth: 118,
                            maxWidth: 230,
                            padding: '0 30px 0 10px',
                            gap: 8,
                            borderRadius: 8,
                            border: `1px solid ${groupColor}`,
                            background: isActive ? tintHex(groupColor, 0.16) : tintHex(groupColor, 0.1),
                            color: GROUP_TEXT_COLOR,
                            position: 'relative',
                            flexShrink: 0,
                            opacity: isDragging ? 0.4 : 1,
                            cursor: 'pointer',
                            userSelect: 'none',
                            zIndex: isActive ? 2 : 1,
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, color: GROUP_TEXT_COLOR, pointerEvents: 'none', flexShrink: 0 }}>{iconForTab(groupTab)}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, pointerEvents: 'none', minWidth: 0, fontWeight: 600 }}>{groupTab.customTitle ?? groupTab.title}</span>
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); closeTab(groupTab.id); }}
                            style={{
                              position: 'absolute', right: 8, width: 18, height: 18,
                              border: 'none', borderRadius: 4, background: 'transparent', color: GROUP_TEXT_COLOR,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                          >×</button>
                        </div>
                        {index < groupTabs.length - 1 && <GroupConnector cracking={crackedIdx === index + 1} />}
                      </React.Fragment>
                    );
                  })}
                  {isDropTarget && crackedIdx === -1 && <GroupConnector connecting />}
                </div>
              </React.Fragment>
            );
          }

          const isActive = activeTabId === tab.id;
          const isDragging = draggedTabId === tab.id;
          return (
            <React.Fragment key={tab.id}>
              {insertLine}
              <div
                key={tab.id}
              data-tab-id={tab.id}
              draggable={tab.type !== 'new-tab'}
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragEnd={clearDragState}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const sourceId = getDraggedTabId(e);
                const sourcePaneId = getDraggedPaneId(e);
                if (!sourceId || sourceId === tab.id) return;
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const position: 'before' | 'after' = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                if (sourcePaneId === paneId) reorderTabs(sourceId, tab.id, position);
                else moveTabToPaneAt(sourceId, paneId, tab.id, position);
                const sourceTab = allTabs.find(t => t.id === sourceId);
                if (sourceTab?.groupId && sourceTab.groupId !== tab.groupId) moveTabToGroup(sourceId, null);
                clearDragState();
              }}
              onContextMenu={(e) => onTabContextMenu(e, tab.id, paneId)}
              onClick={() => setActiveTab(tab.id)}
              style={{
                height: 'calc(100% - 8px)',
                marginTop: 4,
                marginBottom: 4,
                marginRight: 4,
                display: 'inline-flex',
                alignItems: 'center',
                minWidth: 118,
                maxWidth: 230,
                padding: '0 30px 0 10px',
                gap: 8,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: isActive ? 'var(--bg-active)' : 'var(--bg-primary)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                position: 'relative',
                flexShrink: 0,
                opacity: isDragging ? 0.4 : 1,
                cursor: 'pointer',
                userSelect: 'none',
                zIndex: isActive ? 2 : 1,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, color: 'var(--text-secondary)', pointerEvents: 'none', flexShrink: 0 }}>{iconForTab(tab)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, pointerEvents: 'none', minWidth: 0 }}>{tab.customTitle ?? tab.title}</span>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                style={{
                  position: 'absolute', right: 8, width: 18, height: 18,
                  border: 'none', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >×</button>
              </div>
            </React.Fragment>
          );
        })}
        <div
          style={{
            width: insertBefore === 'end' ? 2 : 0,
            minWidth: insertBefore === 'end' ? 2 : 0,
            alignSelf: 'stretch',
            margin: '4px 0',
            borderRadius: 1,
            background: 'var(--accent)',
            transition: 'width 0.08s, min-width 0.08s',
            flexShrink: 0,
          }}
        />
      </div>
      <div ref={addMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 4 }}>
        <button
          ref={addBtnRef}
          onClick={() => setAddMenuOpen(v => !v)}
          style={{
            height: 'calc(100% - 8px)',
            marginTop: 4,
            marginBottom: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 34,
            padding: '0 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: addMenuOpen ? 'var(--bg-hover)' : 'var(--bg-primary)',
            color: 'var(--text-muted)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          title="New tab / Split"
          aria-label="New tab / Split"
        >
          <Plus size={16} />
        </button>
        {addMenuOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% - 2px)', right: 0,
            zIndex: 9999, minWidth: 170,
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            paddingTop: 4, paddingBottom: 4,
          }}>
            {[
              { icon: <Plus size={14} />, label: 'New tab', action: () => { openNewTab(); setAddMenuOpen(false); } },
              null,
              { icon: <PanelRight size={14} />, label: 'Split right', action: () => { onSplitRight(); setAddMenuOpen(false); } },
              { icon: <PanelBottom size={14} />, label: 'Split down', action: () => { onSplitDown(); setAddMenuOpen(false); } },
            ].map((item, i) =>
              item === null
                ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
                : (
                  <button key={item.label} onClick={item.action} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                    fontSize: 13, textAlign: 'left',
                    background: 'transparent', color: 'var(--text-primary)', borderRadius: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{item.icon}</span>
                    {item.label}
                  </button>
                )
            )}
          </div>
        )}
      </div>
      {paneCount > 1 && (
        <button
          onClick={onClosePane}
          title="Close pane"
          aria-label="Close pane"
          style={{
            height: 'calc(100% - 8px)',
            marginTop: 4,
            marginBottom: 4,
            marginRight: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 28,
            padding: '0 6px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-muted)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fca5a5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-primary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
        >
          <X size={14} />
        </button>
      )}

      {groupCtxMenu && (() => {
        const group = getBrowserGroup(groupCtxMenu.groupId);
        if (!group) return null;

        const GROUP_SWATCHES = ['#1a1a1a', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#6b7280', '#7c3aed', '#ec4899'];

        const MenuItem: React.FC<{ label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }> = ({ label, onClick, danger, icon }) => {
          const [hovered, setHovered] = React.useState(false);
          return (
            <button
              onClick={onClick}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px', border: 'none', cursor: 'pointer',
                fontSize: 13, textAlign: 'left',
                background: hovered ? 'var(--bg-hover)' : 'transparent',
                color: danger ? '#ef4444' : 'var(--text-primary)',
                borderRadius: 6, transition: 'background 0.1s',
              }}
            >
              {icon && <span style={{ color: danger ? '#ef4444' : 'var(--text-muted)', display: 'flex' }}>{icon}</span>}
              {label}
            </button>
          );
        };
        const Sep = () => <div style={{ height: 1, background: 'var(--border)', margin: '3px 6px' }} />;

        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: groupCtxMenu.x,
              top: groupCtxMenu.y,
              zIndex: 9999,
              width: 220,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              padding: '10px 10px 6px',
            }}
          >
            {/* Rename input */}
            <input
              autoFocus
              defaultValue={group.name}
              placeholder="Group name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val) updateBrowserGroup(group.id, { name: val });
                  setGroupCtxMenu(null);
                } else if (e.key === 'Escape') {
                  setGroupCtxMenu(null);
                }
              }}
              onBlur={(e) => {
                const val = e.currentTarget.value.trim();
                if (val && val !== group.name) updateBrowserGroup(group.id, { name: val });
              }}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 10px', marginBottom: 10,
                fontSize: 13, borderRadius: 7,
                border: `2px solid ${group.color}`,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />

            {/* Color swatches */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 2px', marginBottom: 8 }}>
              {GROUP_SWATCHES.map(color => (
                <button
                  key={color}
                  title={color}
                  onClick={() => updateBrowserGroup(group.id, { color })}
                  style={{
                    width: 28, height: 28, borderRadius: 7, border: 'none',
                    background: color, cursor: 'pointer', flexShrink: 0,
                    outline: group.color === color ? `2.5px solid var(--accent)` : '2.5px solid transparent',
                    outlineOffset: 2,
                    transition: 'outline-color 0.1s, transform 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.12)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>

            <Sep />

            <MenuItem label={group.collapsed ? 'Expand group' : 'Collapse group'} onClick={() => { toggleBrowserGroupCollapsed(group.id); setGroupCtxMenu(null); }} />
            <MenuItem label="Duplicate group" onClick={() => { duplicateBrowserGroup(group.id); setGroupCtxMenu(null); }} />
            <MenuItem label="Ungroup" onClick={() => { deleteBrowserGroup(group.id); setGroupCtxMenu(null); }} />

            <Sep />

            <MenuItem label="Delete group" danger onClick={() => { closeBrowserGroup(group.id); setGroupCtxMenu(null); }} />
          </div>
        );
      })()}
    </div>
  );
};
