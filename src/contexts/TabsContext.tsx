import React, { createContext, useContext, useState, useCallback } from 'react';
import type { BrowserTabGroup, Tab, Pane } from '../types';

interface TabsContextType {
  tabs: Tab[];
  browserGroups: BrowserTabGroup[];
  activeTabId: string | null;
  panes: Pane[];
  paneSizes: number[];
  splitDirection: 'horizontal' | 'vertical' | 'right-stack' | 'left-stack';
  activePaneId: string;
  openTab: (tab: Omit<Tab, 'id'>, paneId?: string) => void;
  closeTab: (id: string) => void;
  toggleTabPinned: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  restoreTabs: (tabs: Tab[], activeTabId?: string | null, browserGroups?: BrowserTabGroup[], panes?: Pane[], activePaneId?: string, paneSizes?: number[], splitDirection?: 'horizontal' | 'vertical' | 'right-stack' | 'left-stack') => void;
  setActiveTabId: (id: string | null) => void;
  setActivePane: (paneId: string) => void;
  splitRight: () => void;
  splitDown: () => void;
  closePane: (paneId: string) => void;
  moveTabToPane: (tabId: string, targetPaneId: string) => void;
  moveTabToPaneAt: (tabId: string, targetPaneId: string, nearTabId: string, position: 'before' | 'after') => void;
  setPaneSizes: (sizes: number[]) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabCustomTitle: (id: string, customTitle?: string) => void;
  updateTabFilePath: (id: string, filePath: string) => void;
  updateTabUrl: (id: string, url: string) => void;
  updateTabFavicon: (id: string, faviconUrl?: string) => void;
  syncRenamedPath: (oldPath: string, newPath: string) => void;
  reorderTabs: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  moveTabToGroup: (tabId: string, groupId?: string | null) => void;
  createBrowserGroup: (name: string, color?: string) => string;
  updateBrowserGroup: (groupId: string, patch: Partial<Omit<BrowserTabGroup, 'id'>>) => void;
  deleteBrowserGroup: (groupId: string) => void;
  toggleBrowserGroupCollapsed: (groupId: string) => void;
  duplicateBrowserGroup: (groupId: string) => void;
  closeBrowserGroup: (groupId: string) => void;
  getBrowserGroup: (groupId?: string | null) => BrowserTabGroup | null;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

const DEFAULT_GROUP_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0f766e', '#db2777'];

const generateId = () => Math.random().toString(36).slice(2, 10);
const isGroupableType = (type: Tab['type']) => type !== 'terminal' && type !== 'new-tab' && type !== 'claude' && type !== 'codex' && type !== 'pi';
const stripFileExtension = (name: string) => name.replace(/\.[^.]+$/, '');
const getTabPaneId = (tab: Tab) => tab.paneId ?? 'main';
const normalizePaneSizes = (sizes: number[], count: number) => {
  if (count <= 0) return [];
  if (sizes.length !== count) return Array.from({ length: count }, () => 1 / count);
  const clamped = sizes.map(size => Math.max(0.05, size));
  const sum = clamped.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return Array.from({ length: count }, () => 1 / count);
  return clamped.map(size => size / sum);
};

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [browserGroups, setBrowserGroups] = useState<BrowserTabGroup[]>([]);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
  const [panes, setPanes] = useState<Pane[]>([{ id: 'main', activeTabId: null }]);
  const [paneSizes, setPaneSizesState] = useState<number[]>([1]);
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical' | 'right-stack' | 'left-stack'>('horizontal');
  const [activePaneId, setActivePaneId] = useState<string>('main');

  const activePane = panes.find(p => p.id === activePaneId) ?? panes[0];
  const activeTab = activePane?.activeTabId ? tabs.find(t => t.id === activePane.activeTabId) : null;

  const setActivePane = useCallback((paneId: string) => {
    if (!panes.some(p => p.id === paneId)) return;
    setActivePaneId(paneId);
    const pane = panes.find(p => p.id === paneId);
    setActiveTabIdState(pane?.activeTabId ?? null);
  }, [panes]);

  const setActiveTabId = useCallback((id: string | null) => {
    if (!id) {
      setActiveTabIdState(null);
      setPanes(prev => prev.map(p => p.id === activePaneId ? { ...p, activeTabId: null } : p));
      return;
    }

    const ownerPaneId = tabs.find(tab => tab.id === id)?.paneId ?? activePaneId;
    const paneExists = panes.some(p => p.id === ownerPaneId);
    const targetPaneId = paneExists ? ownerPaneId : 'main';
    setActivePaneId(targetPaneId);
    setActiveTabIdState(id);
    setPanes(prev => prev.map(p => p.id === targetPaneId ? { ...p, activeTabId: id } : p));
  }, [activePaneId, panes, tabs]);

  const setPaneSizes = useCallback((sizes: number[]) => {
    if (splitDirection === 'right-stack' || splitDirection === 'left-stack') {
      const primary = Math.max(0.2, Math.min(0.8, sizes[0] ?? 0.5));
      const stackedTop = Math.max(0.2, Math.min(0.8, sizes[1] ?? 0.5));
      setPaneSizesState([primary, stackedTop]);
      return;
    }
    setPaneSizesState(prev => normalizePaneSizes(sizes, panes.length || prev.length || 1));
  }, [panes.length, splitDirection]);

  const splitPane = useCallback((direction: 'horizontal' | 'vertical') => {
    if (panes.length >= 4) return;

    const newPaneId = generateId();
    const currentIndex = Math.max(0, panes.findIndex(p => p.id === activePaneId));

    const isStackSplit = direction === 'vertical' && panes.length === 2 && splitDirection === 'horizontal';
    if (isStackSplit) {
      const mode = currentIndex === 0 ? 'left-stack' : 'right-stack';
      setSplitDirection(mode);
      setPanes(prev => {
        const next = [...prev];
        next.splice(currentIndex + 1, 0, { id: newPaneId, activeTabId: null });
        return next;
      });
      setPaneSizesState([0.5, 0.5]);
      setActivePaneId(newPaneId);
      setActiveTabIdState(null);
      return;
    }

    setSplitDirection(direction);

    setPanes(prev => {
      const next = [...prev];
      next.splice(currentIndex + 1, 0, { id: newPaneId, activeTabId: null });
      return next;
    });
    setPaneSizesState(prev => {
      const normalized = normalizePaneSizes(prev, panes.length);
      const base = normalized[currentIndex] ?? 1 / Math.max(1, panes.length);
      const next = [...normalized];
      next.splice(currentIndex, 1, base / 2, base / 2);
      return normalizePaneSizes(next, panes.length + 1);
    });
    setActivePaneId(newPaneId);
    setActiveTabIdState(null);
  }, [panes, activePaneId, splitDirection]);

  const splitRight = useCallback(() => {
    splitPane('horizontal');
  }, [splitPane]);

  const splitDown = useCallback(() => {
    splitPane('vertical');
  }, [splitPane]);

  const closePane = useCallback((paneId: string) => {
    if (panes.length === 1) return;
    if (paneId === 'main') return;

    const removeIndex = panes.findIndex(p => p.id === paneId);
    const remaining = panes.filter(p => p.id !== paneId);
    setPanes(remaining);
    setPaneSizesState(prev => {
      if (splitDirection === 'right-stack' || splitDirection === 'left-stack') {
        return normalizePaneSizes(Array.from({ length: Math.max(1, remaining.length) }, () => 1), Math.max(1, remaining.length));
      }
      const normalized = normalizePaneSizes(prev, panes.length);
      const next = normalized.filter((_, idx) => idx !== removeIndex);
      if (next.length === 0) return [1];
      const removed = normalized[removeIndex] ?? 0;
      if (removeIndex > 0) next[removeIndex - 1] = (next[removeIndex - 1] ?? 0) + removed;
      else next[0] = (next[0] ?? 0) + removed;
      return normalizePaneSizes(next, next.length);
    });
    setTabs(prev => {
      const nextTabs = prev.filter(tab => getTabPaneId(tab) !== paneId);
      setBrowserGroups(prevGroups => {
        const nextGroups = prevGroups.filter(group => nextTabs.some(tab => tab.groupId === group.id));
        return nextGroups.length === prevGroups.length ? prevGroups : nextGroups;
      });
      return nextTabs;
    });

    if (remaining.length <= 1 || splitDirection === 'right-stack' || splitDirection === 'left-stack') {
      setSplitDirection('horizontal');
      setPaneSizesState(remaining.length <= 1 ? [1] : normalizePaneSizes(Array.from({ length: remaining.length }, () => 1), remaining.length));
    }

    if (activePaneId === paneId) {
      const fallbackPane = remaining[0] ?? null;
      setActivePaneId(fallbackPane?.id ?? 'main');
      setActiveTabIdState(fallbackPane?.activeTabId ?? null);
    }
  }, [panes, activePaneId, splitDirection]);

  const moveTabToPane = useCallback((tabId: string, targetPaneId: string) => {
    const sourcePaneId = tabs.find(t => t.id === tabId)?.paneId ?? 'main';
    if (sourcePaneId === targetPaneId) {
      setActivePaneId(targetPaneId);
      setActiveTabIdState(tabId);
      setPanes(prev => prev.map(p => p.id === targetPaneId ? { ...p, activeTabId: tabId } : p));
      return;
    }

    setTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, paneId: targetPaneId } : tab));
    setPanes(prev => prev.map(p => {
      if (p.id === targetPaneId) return { ...p, activeTabId: tabId };
      if (p.id === sourcePaneId && p.activeTabId === tabId) {
        const fallback = tabs.find(tab => tab.id !== tabId && getTabPaneId(tab) === sourcePaneId);
        return { ...p, activeTabId: fallback?.id ?? null };
      }
      return p;
    }));
    setActivePaneId(targetPaneId);
    setActiveTabIdState(tabId);
  }, [tabs]);

  const moveTabToPaneAt = useCallback((tabId: string, targetPaneId: string, nearTabId: string, position: 'before' | 'after') => {
    const sourcePaneId = tabs.find(t => t.id === tabId)?.paneId ?? 'main';
    setTabs(prev => {
      const srcIdx = prev.findIndex(t => t.id === tabId);
      if (srcIdx === -1) return prev;
      // Update paneId and move to the correct position relative to nearTabId
      const withUpdatedPane = prev.map(tab => tab.id === tabId ? { ...tab, paneId: targetPaneId } : tab);
      const tgtIdx = withUpdatedPane.findIndex(t => t.id === nearTabId);
      if (tgtIdx === -1) return withUpdatedPane;
      const result = withUpdatedPane.filter(t => t.id !== tabId);
      const insertAt = result.findIndex(t => t.id === nearTabId);
      if (insertAt === -1) return withUpdatedPane;
      result.splice(position === 'after' ? insertAt + 1 : insertAt, 0, { ...prev[srcIdx], paneId: targetPaneId });
      return result;
    });
    setPanes(prev => prev.map(p => {
      if (p.id === targetPaneId) return { ...p, activeTabId: tabId };
      if (p.id === sourcePaneId && p.activeTabId === tabId) {
        const fallback = tabs.find(tab => tab.id !== tabId && getTabPaneId(tab) === sourcePaneId);
        return { ...p, activeTabId: fallback?.id ?? null };
      }
      return p;
    }));
    setActivePaneId(targetPaneId);
    setActiveTabIdState(tabId);
  }, [tabs]);

  const openTab = useCallback((tab: Omit<Tab, 'id'>, paneId?: string) => {
    const targetPaneId = paneId ?? activePaneId;

    setTabs(prev => {
      const requestedGroupId = isGroupableType(tab.type) ? tab.groupId : undefined;
      const nextGroupId = requestedGroupId && browserGroups.some(group => group.id === requestedGroupId)
        ? requestedGroupId
        : undefined;

      if (tab.type !== 'terminal' && tab.filePath) {
        const existingTab = prev.find(t => t.filePath === tab.filePath && t.type === tab.type && getTabPaneId(t) === targetPaneId);
        if (existingTab) {
          setActivePaneId(targetPaneId);
          setActiveTabIdState(existingTab.id);
          setPanes(prevPanes => prevPanes.map(p =>
            p.id === targetPaneId ? { ...p, activeTabId: existingTab.id } : p
          ));
          if (tab.initialLine != null) {
            return prev.map(t => t.id === existingTab.id
              ? { ...t, initialLine: tab.initialLine, searchQuery: tab.searchQuery, searchCaseSensitive: tab.searchCaseSensitive, scrollNonce: Date.now() }
              : t
            );
          }
          return prev;
        }
      }

      const newTab: Tab = {
        ...tab,
        id: generateId(),
        paneId: targetPaneId,
        groupId: isGroupableType(tab.type) ? nextGroupId : undefined,
      };
      setActivePaneId(targetPaneId);
      setActiveTabIdState(newTab.id);
      setPanes(prevPanes => prevPanes.map(p =>
        p.id === targetPaneId ? { ...p, activeTabId: newTab.id } : p
      ));
      return [...prev, newTab];
    });
  }, [activeTabId, browserGroups, activePaneId]);

  const closeTabsByIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    setTabs(prev => {
      const pinnedIds = new Set(prev.filter(tab => tab.pinned).map(tab => tab.id));
      const effectiveIdsToClose = new Set(ids.filter(id => !pinnedIds.has(id)));
      const newTabs = prev.filter(t => !effectiveIdsToClose.has(t.id));

      setPanes(prevPanes => {
        const paneIdsWithTabs = new Set(newTabs.map(tab => getTabPaneId(tab)));
        const withUpdatedActive = prevPanes.map(p => {
          if (!p.activeTabId || !effectiveIdsToClose.has(p.activeTabId)) return p;
          const paneTabs = newTabs.filter(tab => getTabPaneId(tab) === p.id);
          return { ...p, activeTabId: paneTabs.length ? paneTabs[paneTabs.length - 1].id : null };
        });

        const removablePaneIds = new Set(withUpdatedActive.filter(p => p.id !== 'main' && !paneIdsWithTabs.has(p.id)).map(p => p.id));
        const nextPanes = withUpdatedActive.filter(p => !removablePaneIds.has(p.id));

        if (removablePaneIds.size > 0) {
          if (splitDirection === 'right-stack' || splitDirection === 'left-stack') {
            setPaneSizesState(normalizePaneSizes(Array.from({ length: Math.max(1, nextPanes.length) }, () => 1), Math.max(1, nextPanes.length)));
          } else {
            setPaneSizesState(prevSizes => {
              const normalized = normalizePaneSizes(prevSizes, prevPanes.length);
              const keptSizes = normalized.filter((_, idx) => !removablePaneIds.has(prevPanes[idx].id));
              return normalizePaneSizes(keptSizes, Math.max(1, nextPanes.length));
            });
          }
        }

        const finalPanes = nextPanes.length ? nextPanes : [{ id: 'main', activeTabId: null }];
        if (finalPanes.length <= 1 || (splitDirection === 'right-stack' || splitDirection === 'left-stack') && finalPanes.length !== 3) {
          setSplitDirection('horizontal');
          setPaneSizesState(finalPanes.length <= 1 ? [1] : normalizePaneSizes(Array.from({ length: finalPanes.length }, () => 1), finalPanes.length));
        }

        const nextActivePaneId = finalPanes.some(p => p.id === activePaneId)
          ? activePaneId
          : finalPanes[0].id;
        const nextActiveTabId = finalPanes.find(p => p.id === nextActivePaneId)?.activeTabId ?? null;
        setActivePaneId(nextActivePaneId);
        setActiveTabIdState(nextActiveTabId);
        return finalPanes;
      });

      setBrowserGroups(prevGroups => {
        const nextGroups = prevGroups.filter(group => newTabs.some(tab => tab.groupId === group.id));
        return nextGroups.length === prevGroups.length ? prevGroups : nextGroups;
      });

      return newTabs;
    });
  }, [activePaneId, splitDirection]);

  const closeTab = useCallback((id: string) => {
    closeTabsByIds([id]);
  }, [closeTabsByIds]);

  const toggleTabPinned = useCallback((id: string) => {
    setTabs(prev => prev.map(tab => tab.id === id ? { ...tab, pinned: !tab.pinned } : tab));
  }, []);

  const closeTabsToLeft = useCallback((id: string) => {
    const target = tabs.find(t => t.id === id);
    if (!target) return;
    const paneTabs = tabs.filter(t => getTabPaneId(t) === getTabPaneId(target));
    const index = paneTabs.findIndex(t => t.id === id);
    if (index > 0) {
      closeTabsByIds(paneTabs.slice(0, index).map(t => t.id));
    }
  }, [closeTabsByIds, tabs]);

  const closeTabsToRight = useCallback((id: string) => {
    const target = tabs.find(t => t.id === id);
    if (!target) return;
    const paneTabs = tabs.filter(t => getTabPaneId(t) === getTabPaneId(target));
    const index = paneTabs.findIndex(t => t.id === id);
    if (index >= 0 && index < paneTabs.length - 1) {
      closeTabsByIds(paneTabs.slice(index + 1).map(t => t.id));
    }
  }, [closeTabsByIds, tabs]);

  const closeOtherTabs = useCallback((id: string) => {
    const target = tabs.find(t => t.id === id);
    if (!target) return;
    closeTabsByIds(tabs.filter(t => getTabPaneId(t) === getTabPaneId(target) && t.id !== id).map(t => t.id));
  }, [closeTabsByIds, tabs]);

  const closeAllTabs = useCallback(() => {
    const pane = panes.find(p => p.id === activePaneId);
    if (!pane) return;
    closeTabsByIds(tabs.filter(t => getTabPaneId(t) === pane.id).map(t => t.id));
  }, [activePaneId, closeTabsByIds, panes, tabs]);

  const restoreTabs = useCallback((nextTabs: Tab[], nextActiveTabId: string | null = null, nextBrowserGroups: BrowserTabGroup[] = [], nextPanes: Pane[] = [{ id: 'main', activeTabId: null }], nextActivePaneId = 'main', nextPaneSizes: number[] = [1], nextSplitDirection: 'horizontal' | 'vertical' | 'right-stack' | 'left-stack' = 'horizontal') => {
    const validGroupIds = new Set(nextBrowserGroups.map(group => group.id));
    const incomingPanes = nextPanes.length ? nextPanes : [{ id: 'main', activeTabId: null }];
    const paneIds = new Set(incomingPanes.map(p => p.id));
    paneIds.add('main');

    const sanitizedTabs = nextTabs.map(tab => {
      const nextGroupId = isGroupableType(tab.type) && tab.groupId && validGroupIds.has(tab.groupId)
        ? tab.groupId
        : undefined;
      const paneId = tab.paneId && paneIds.has(tab.paneId) ? tab.paneId : 'main';
      return {
        ...tab,
        paneId,
        groupId: nextGroupId,
      };
    });

    const paneOrder = Array.from(new Set(['main', ...incomingPanes.map(p => p.id)]));
    const normalizedPanes = paneOrder.map(id => {
      const paneTabs = sanitizedTabs.filter(tab => getTabPaneId(tab) === id);
      const savedPane = incomingPanes.find(p => p.id === id);
      const savedActiveTabId = savedPane?.activeTabId;
      const activeForPane = savedActiveTabId && paneTabs.some(tab => tab.id === savedActiveTabId)
        ? savedActiveTabId
        : paneTabs.length
          ? paneTabs[paneTabs.length - 1].id
          : null;
      return { id, activeTabId: activeForPane };
    });

    const resolvedActiveTabId = nextActiveTabId && sanitizedTabs.some(tab => tab.id === nextActiveTabId)
      ? nextActiveTabId
      : normalizedPanes.find(p => p.id === nextActivePaneId)?.activeTabId
        ?? normalizedPanes.find(p => p.activeTabId)?.activeTabId
        ?? null;

    const resolvedActivePaneId = normalizedPanes.some(p => p.id === nextActivePaneId)
      ? nextActivePaneId
      : (resolvedActiveTabId
          ? sanitizedTabs.find(tab => tab.id === resolvedActiveTabId)?.paneId
          : 'main') ?? 'main';

    setTabs(sanitizedTabs);
    setBrowserGroups(nextBrowserGroups);
    setPanes(normalizedPanes);
    if ((nextSplitDirection === 'right-stack' || nextSplitDirection === 'left-stack') && normalizedPanes.length === 3) {
      const primary = Math.max(0.2, Math.min(0.8, nextPaneSizes[0] ?? 0.5));
      const stackedTop = Math.max(0.2, Math.min(0.8, nextPaneSizes[1] ?? 0.5));
      setPaneSizesState([primary, stackedTop]);
    } else {
      setPaneSizesState(normalizePaneSizes(nextPaneSizes, normalizedPanes.length));
    }
    setSplitDirection(normalizedPanes.length > 1 ? nextSplitDirection : 'horizontal');
    setActivePaneId(resolvedActivePaneId);
    setActiveTabIdState(resolvedActiveTabId);
  }, []);

  const updateTabTitle = useCallback((id: string, title: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, title } : t));
  }, []);

  const updateTabCustomTitle = useCallback((id: string, customTitle?: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, customTitle } : t));
  }, []);

  const updateTabFilePath = useCallback((id: string, filePath: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, filePath } : t));
  }, []);

  const updateTabUrl = useCallback((id: string, url: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, url } : t));
  }, []);

  const updateTabFavicon = useCallback((id: string, faviconUrl?: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, faviconUrl } : t));
  }, []);

  const syncRenamedPath = useCallback((oldPath: string, newPath: string) => {
    if (!oldPath || !newPath || oldPath === newPath) return;

    const oldPrefix = `${oldPath}/`;
    setTabs(prev => prev.map(tab => {
      if (!tab.filePath) return tab;

      let nextFilePath: string | null = null;
      if (tab.filePath === oldPath) {
        nextFilePath = newPath;
      } else if (tab.filePath.startsWith(oldPrefix)) {
        nextFilePath = `${newPath}/${tab.filePath.slice(oldPrefix.length)}`;
      }

      if (!nextFilePath) return tab;

      if (tab.filePath === oldPath) {
        const nextFileName = nextFilePath.split('/').pop() ?? nextFilePath;
        return { ...tab, filePath: nextFilePath, title: stripFileExtension(nextFileName) };
      }

      return { ...tab, filePath: nextFilePath };
    }));
  }, []);

  const reorderTabs = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
    setTabs(prev => {
      const srcIdx = prev.findIndex(t => t.id === sourceId);
      const tgtIdx = prev.findIndex(t => t.id === targetId);
      if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(srcIdx, 1);
      const insertAt = next.findIndex(t => t.id === targetId);
      next.splice(position === 'after' ? insertAt + 1 : insertAt, 0, moved);
      return next;
    });
  }, []);

  const moveTabToGroup = useCallback((tabId: string, groupId?: string | null) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab;
      if (!isGroupableType(tab.type)) return { ...tab, groupId: undefined };
      return { ...tab, groupId: groupId ?? undefined };
    }));
  }, []);

  const createBrowserGroup = useCallback((name: string, color?: string) => {
    const groupId = generateId();
    const nextGroup: BrowserTabGroup = {
      id: groupId,
      name: name.trim() || 'Tab Group',
      color: color?.trim() || DEFAULT_GROUP_COLORS[browserGroups.length % DEFAULT_GROUP_COLORS.length],
      collapsed: false,
    };
    setBrowserGroups(prev => [...prev, nextGroup]);
    return groupId;
  }, [browserGroups.length]);

  const updateBrowserGroup = useCallback((groupId: string, patch: Partial<Omit<BrowserTabGroup, 'id'>>) => {
    setBrowserGroups(prev => prev.map(group => group.id === groupId ? { ...group, ...patch } : group));
  }, []);

  const deleteBrowserGroup = useCallback((groupId: string) => {
    setBrowserGroups(prev => prev.filter(group => group.id !== groupId));
    setTabs(prev => prev.map(tab => tab.groupId === groupId ? { ...tab, groupId: undefined } : tab));
  }, []);

  const toggleBrowserGroupCollapsed = useCallback((groupId: string) => {
    setBrowserGroups(prev => prev.map(group => group.id === groupId ? { ...group, collapsed: !group.collapsed } : group));
  }, []);

  const duplicateBrowserGroup = useCallback((groupId: string) => {
    const sourceTabs = tabs.filter(tab => tab.groupId === groupId && isGroupableType(tab.type));
    if (sourceTabs.length === 0) return;

    const sourceGroup = browserGroups.find(g => g.id === groupId);
    const newGroupId = createBrowserGroup(`${sourceGroup?.name ?? 'Tab Group'} Copy`, sourceGroup?.color);
    setTabs(prev => [
      ...prev,
      ...sourceTabs.map(tab => ({
        ...tab,
        id: generateId(),
        groupId: newGroupId,
      })),
    ]);
  }, [browserGroups, createBrowserGroup, tabs]);

  const closeBrowserGroup = useCallback((groupId: string) => {
    closeTabsByIds(tabs.filter(tab => tab.groupId === groupId).map(tab => tab.id));
    deleteBrowserGroup(groupId);
  }, [closeTabsByIds, deleteBrowserGroup, tabs]);

  const getBrowserGroup = useCallback((groupId?: string | null) => {
    if (!groupId) return null;
    return browserGroups.find(group => group.id === groupId) ?? null;
  }, [browserGroups]);

  return (
    <TabsContext.Provider value={{
      tabs,
      browserGroups,
      activeTabId,
      panes,
      paneSizes,
      splitDirection,
      activePaneId,
      openTab,
      closeTab,
      toggleTabPinned,
      reorderTabs,
      closeTabsToLeft,
      closeTabsToRight,
      closeOtherTabs,
      closeAllTabs,
      restoreTabs,
      setActiveTabId,
      setActivePane,
      splitRight,
      splitDown,
      closePane,
      moveTabToPane,
      moveTabToPaneAt,
      setPaneSizes,
      updateTabTitle,
      updateTabCustomTitle,
      updateTabFilePath,
      updateTabUrl,
      updateTabFavicon,
      syncRenamedPath,
      moveTabToGroup,
      createBrowserGroup,
      updateBrowserGroup,
      deleteBrowserGroup,
      toggleBrowserGroupCollapsed,
      duplicateBrowserGroup,
      closeBrowserGroup,
      getBrowserGroup,
    }}>
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('useTabs must be used within a TabsProvider');
  return context;
};
