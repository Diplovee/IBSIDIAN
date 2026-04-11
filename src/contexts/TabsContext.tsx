import React, { createContext, useContext, useState, useCallback } from 'react';
import type { BrowserTabGroup, Tab } from '../types';

interface TabsContextType {
  tabs: Tab[];
  browserGroups: BrowserTabGroup[];
  activeTabId: string | null;
  openTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  restoreTabs: (tabs: Tab[], activeTabId?: string | null, browserGroups?: BrowserTabGroup[]) => void;
  setActiveTabId: (id: string | null) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabCustomTitle: (id: string, customTitle?: string) => void;
  updateTabFilePath: (id: string, filePath: string) => void;
  updateTabUrl: (id: string, url: string) => void;
  updateTabFavicon: (id: string, faviconUrl?: string) => void;
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
const isGroupableType = (type: Tab['type']) => type !== 'terminal' && type !== 'new-tab';

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [browserGroups, setBrowserGroups] = useState<BrowserTabGroup[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback((tab: Omit<Tab, 'id'>) => {
    setTabs(prev => {
      const activeGroupId = isGroupableType(tab.type)
        ? (tab.groupId ?? prev.find(t => t.id === activeTabId)?.groupId)
        : undefined;
      const nextGroupId = activeGroupId && browserGroups.some(group => group.id === activeGroupId)
        ? activeGroupId
        : undefined;

      // Check if tab already exists (terminals and untethered tabs like browser/new-tab are never deduplicated)
      if (tab.type !== 'terminal' && tab.filePath) {
        const existingTab = prev.find(t => t.filePath === tab.filePath && t.type === tab.type);
        if (existingTab) {
          setActiveTabId(existingTab.id);
          if (nextGroupId && existingTab.groupId !== nextGroupId) {
            return prev.map(t => t.id === existingTab.id ? { ...t, groupId: nextGroupId } : t);
          }
          return prev;
        }
      }

      const newTab: Tab = {
        ...tab,
        id: generateId(),
        groupId: isGroupableType(tab.type) ? nextGroupId : undefined,
      };
      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, [activeTabId, browserGroups]);

  const closeTabsByIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    setTabs(prev => {
      const idsToClose = new Set(ids);
      const newTabs = prev.filter(t => !idsToClose.has(t.id));

      if (activeTabId && idsToClose.has(activeTabId)) {
        const activeIndex = prev.findIndex(t => t.id === activeTabId);
        const nextTab = newTabs.length > 0
          ? newTabs[Math.min(activeIndex, newTabs.length - 1)] ?? newTabs[newTabs.length - 1]
          : null;
        setActiveTabId(nextTab ? nextTab.id : null);
      }

      setBrowserGroups(prevGroups => {
        const nextGroups = prevGroups.filter(group => newTabs.some(tab => tab.groupId === group.id));
        return nextGroups.length === prevGroups.length ? prevGroups : nextGroups;
      });

      return newTabs;
    });
  }, [activeTabId]);

  const closeTab = useCallback((id: string) => {
    closeTabsByIds([id]);
  }, [closeTabsByIds]);

  const closeTabsToLeft = useCallback((id: string) => {
    const index = tabs.findIndex(t => t.id === id);
    if (index > 0) {
      closeTabsByIds(tabs.slice(0, index).map(t => t.id));
    }
  }, [closeTabsByIds, tabs]);

  const closeTabsToRight = useCallback((id: string) => {
    const index = tabs.findIndex(t => t.id === id);
    if (index >= 0 && index < tabs.length - 1) {
      closeTabsByIds(tabs.slice(index + 1).map(t => t.id));
    }
  }, [closeTabsByIds, tabs]);

  const closeOtherTabs = useCallback((id: string) => {
    closeTabsByIds(tabs.filter(t => t.id !== id).map(t => t.id));
  }, [closeTabsByIds, tabs]);

  const closeAllTabs = useCallback(() => {
    closeTabsByIds(tabs.map(t => t.id));
  }, [closeTabsByIds, tabs]);

  const restoreTabs = useCallback((nextTabs: Tab[], nextActiveTabId: string | null = null, nextBrowserGroups: BrowserTabGroup[] = []) => {
    const validGroupIds = new Set(nextBrowserGroups.map(group => group.id));
    const sanitizedTabs = nextTabs.map(tab => {
      if (!isGroupableType(tab.type)) {
        return tab.groupId ? { ...tab, groupId: undefined } : tab;
      }
      if (!tab.groupId || validGroupIds.has(tab.groupId)) return tab;
      return { ...tab, groupId: undefined };
    });

    setTabs(sanitizedTabs);
    setBrowserGroups(nextBrowserGroups);
    setActiveTabId(nextActiveTabId && sanitizedTabs.some(tab => tab.id === nextActiveTabId)
      ? nextActiveTabId
      : sanitizedTabs.length > 0
        ? sanitizedTabs[sanitizedTabs.length - 1].id
        : null);
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

  const moveTabToGroup = useCallback((tabId: string, groupId?: string | null) => {
    const hasTargetGroup = !!groupId && browserGroups.some(group => group.id === groupId);
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab;
      if (!isGroupableType(tab.type)) return { ...tab, groupId: undefined };
      return { ...tab, groupId: hasTargetGroup ? groupId : undefined };
    }));
  }, [browserGroups]);

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
      openTab,
      closeTab,
      closeTabsToLeft,
      closeTabsToRight,
      closeOtherTabs,
      closeAllTabs,
      restoreTabs,
      setActiveTabId,
      updateTabTitle,
      updateTabCustomTitle,
      updateTabFilePath,
      updateTabUrl,
      updateTabFavicon,
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
