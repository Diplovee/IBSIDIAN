import React, { createContext, useContext, useState, useCallback } from 'react';
import { ActivityType } from '../types';

interface ActivityContextType {
  activeActivity: ActivityType | null;
  toggleActivity: (activity: ActivityType) => void;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeActivity, setActiveActivity] = useState<ActivityType | null>('files');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    <ActivityContext.Provider value={{ activeActivity, toggleActivity, isSidebarCollapsed, setSidebarCollapsed }}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useActivity must be used within an ActivityProvider');
  return context;
};
