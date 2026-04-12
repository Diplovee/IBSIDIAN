import React, { createContext, useContext, useState, useCallback } from 'react';
import type { BrowserTabGroup, Tab, Pane } from '../types';

interface TabsContextType {
  tabs: Tab[];
  browserGroups: BrowserTabGroup[];
  activeTabId: string | null;
  panes: Pane[];
  activePaneId: string;
  openTab: (tab: Omit<Tab, 'id'>, paneId?: string) => void;
  closeTab: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  restoreTabs: (tabs: Tab[], activeTabId?: string | null, browserGroups?: BrowserTabGroup[]) => void;
  setActiveTabId: (id: string | null) => void;
  setActivePane: (paneId: string) => void;
  splitRight: () => void;
  splitDown: () => void;
  closePane: (paneId: string) => void;
  moveTabToPane: (tabId: string, targetPaneId: string) => void;
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

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [browserGroups, setBrowserGroups] = useState<BrowserTabGroup[]>([]);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
  const [panes, setPanes] = useState<Pane[]>([{ id: 'main', activeTabId: null }]);
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

  const splitPane = useCallback(() => {
    if (panes.length >= 4) return;

    const newPaneId = generateId();
    const currentPane = panes.find(p => p.id === activePaneId) ?? panes[0];
    const sourceTab = currentPane?.activeTabId ? tabs.find(t => t.id === currentPane.activeTabId) : null;

    if (sourceTab) {
      const duplicatedTab: Tab = { ...sourceTab, id: generateId(), paneId: newPaneId };
      setTabs(prev => [...prev, duplicatedTab]);
      setPanes(prev => [...prev, { id: newPaneId, activeTabId: duplicatedTab.id }]);
      setActivePaneId(newPaneId);
      setActiveTabIdState(duplicatedTab.id);
      return;
    }

    setPanes(prev => [...prev, { id: newPaneId, activeTabId: null }]);
    setActivePaneId(newPaneId);
    setActiveTabIdState(null);
  }, [panes, activePaneId, tabs]);

  const splitRight = useCallback(() => {
    splitPane();
  }, [splitPane]);

  const splitDown = useCallback(() => {
    splitPane();
  }, [splitPane]);

  const closePane = useCallback((paneId: string) => {
    if (panes.length === 1) return;
    if (paneId === 'main') return;

    const remaining = panes.filter(p => p.id !== paneId);
    setPanes(remaining);
    setTabs(prev => {
      const nextTabs = prev.filter(tab => getTabPaneId(tab) !== paneId);
      setBrowserGroups(prevGroups => {
        const nextGroups = prevGroups.filter(group => nextTabs.some(tab => tab.groupId === group.id));
        return nextGroups.length === prevGroups.length ? prevGroups : nextGroups;
      });
      return nextTabs;
    });

    if (activePaneId === paneId) {
      const fallbackPane = remaining[0] ?? null;
      setActivePaneId(fallbackPane?.id ?? 'main');
      setActiveTabIdState(fallbackPane?.activeTabId ?? null);
    }
  }, [panes, activePaneId]);

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

  const openTab = useCallback((tab: Omit<Tab, 'id'>, paneId?: string) => {
    const targetPaneId = paneId ?? activePaneId;

    setTabs(prev => {
      const activeGroupId = isGroupableType(tab.type)
        ? (tab.groupId ?? prev.find(t => t.id === activeTabId)?.groupId)
        : undefined;
      const nextGroupId = activeGroupId && browserGroups.some(group => group.id === activeGroupId)
        ? activeGroupId
        : undefined;

      if (tab.type !== 'terminal' && tab.filePath) {
        const existingTab = prev.find(t => t.filePath === tab.filePath && t.type === tab.type && getTabPaneId(t) === targetPaneId);
        if (existingTab) {
          setActivePaneId(targetPaneId);
          setActiveTabIdState(existingTab.id);
          setPanes(prevPanes => prevPanes.map(p =>
            p.id === targetPaneId ? { ...p, activeTabId: existingTab.id } : p
          ));
          if (nextGroupId && existingTab.groupId !== nextGroupId) {
            return prev.map(t => t.id === existingTab.id ? { ...t, groupId: nextGroupId } : t);
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

    const idsToClose = new Set(ids);
    setTabs(prev => {
      const newTabs = prev.filter(t => !idsToClose.has(t.id));

      setPanes(prevPanes => {
        const updated = prevPanes.map(p => {
          if (!p.activeTabId || !idsToClose.has(p.activeTabId)) return p;
          const paneTabs = newTabs.filter(tab => getTabPaneId(tab) === p.id);
          return { ...p, activeTabId: paneTabs.length ? paneTabs[paneTabs.length - 1].id : null };
        });
        const activePane = updated.find(p => p.id === activePaneId);
        setActiveTabIdState(activePane?.activeTabId ?? null);
        return updated;
      });

      setBrowserGroups(prevGroups => {
        const nextGroups = prevGroups.filter(group => newTabs.some(tab => tab.groupId === group.id));
        return nextGroups.length === prevGroups.length ? prevGroups : nextGroups;
      });

      return newTabs;
    });
  }, [activePaneId]);

  const closeTab = useCallback((id: string) => {
    closeTabsByIds([id]);
  }, [closeTabsByIds]);

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

  const restoreTabs = useCallback((nextTabs: Tab[], nextActiveTabId: string | null = null, nextBrowserGroups: BrowserTabGroup[] = []) => {
    const validGroupIds = new Set(nextBrowserGroups.map(group => group.id));
    const sanitizedTabs = nextTabs.map(tab => {
      if (!isGroupableType(tab.type)) {
        return tab.groupId ? { ...tab, groupId: undefined } : tab;
      }
      if (!tab.groupId || validGroupIds.has(tab.groupId)) return tab;
      return { ...tab, groupId: undefined };
    });

    const normalizedTabs = sanitizedTabs.map(tab => ({ ...tab, paneId: 'main' }));
    setTabs(normalizedTabs);
    setBrowserGroups(nextBrowserGroups);
    const newActiveTabId = nextActiveTabId && normalizedTabs.some(tab => tab.id === nextActiveTabId)
      ? nextActiveTabId
      : normalizedTabs.length > 0
        ? normalizedTabs[normalizedTabs.length - 1].id
        : null;
    setActiveTabIdState(newActiveTabId);
    setPanes([{ id: 'main', activeTabId: newActiveTabId }]);
    setActivePaneId('main');
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
      activePaneId,
      openTab,
      closeTab,
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
