import React, { createContext, useContext, useState, useCallback } from 'react';
import { Tab, TabType } from '../types';

interface TabsContextType {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabFilePath: (id: string, filePath: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback((tab: Omit<Tab, 'id'>) => {
    // Check if tab already exists (terminals are never deduplicated)
    if (tab.type !== 'terminal') {
      const existingTab = tabs.find(t => t.filePath === tab.filePath && t.type === tab.type);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }
    }

    const newTab: Tab = {
      ...tab,
      id: Math.random().toString(36).substr(2, 9),
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const updateTabTitle = useCallback((id: string, title: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, title } : t));
  }, []);

  const updateTabFilePath = useCallback((id: string, filePath: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, filePath } : t));
  }, []);

  return (
    <TabsContext.Provider value={{ tabs, activeTabId, openTab, closeTab, setActiveTabId, updateTabTitle, updateTabFilePath }}>
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('useTabs must be used within a TabsProvider');
  return context;
};
