import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ActivityType } from '../types';

type Theme = 'light' | 'dark';

interface ActivityContextType {
  activeActivity: ActivityType | null;
  toggleActivity: (activity: ActivityType) => void;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeActivity, setActiveActivity] = useState<ActivityType | null>('files');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const toggleActivity = useCallback((activity: ActivityType) => {
    if (activeActivity === activity) {
      setSidebarCollapsed(true);
      setActiveActivity(null);
    } else {
      setSidebarCollapsed(false);
      setActiveActivity(activity);
    }
  }, [activeActivity]);

  return (
    <ActivityContext.Provider value={{ activeActivity, toggleActivity, isSidebarCollapsed, setSidebarCollapsed, theme, setTheme }}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useActivity must be used within an ActivityProvider');
  return context;
};
