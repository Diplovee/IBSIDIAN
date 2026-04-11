import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AppSettings } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  attachments: {
    attachmentLocation: 'specific-folder',
    attachmentFolderPath: 'attachments/images',
  },
  fileTree: {
    style: 'original',
  },
  appearance: {
    fontSize: 'medium',
    compactMode: false,
  },
};

interface AppSettingsContextType {
  settings: AppSettings;
  isLoaded: boolean;
  updateAttachmentSettings: (next: Partial<AppSettings['attachments']>) => Promise<void>;
  updateFileTreeSettings: (next: Partial<AppSettings['fileTree']>) => Promise<void>;
  updateAppearanceSettings: (next: Partial<AppSettings['appearance']>) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    window.api.settings.load()
      .then(loaded => setSettings(loaded))
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const updateAttachmentSettings = useCallback(async (next: Partial<AppSettings['attachments']>) => {
    const merged: AppSettings = {
      ...settings,
      attachments: {
        ...settings.attachments,
        ...next,
      },
    };
    setSettings(merged);
    const saved = await window.api.settings.save(merged);
    setSettings(saved);
  }, [settings]);

  const updateFileTreeSettings = useCallback(async (next: Partial<AppSettings['fileTree']>) => {
    const merged: AppSettings = {
      ...settings,
      fileTree: {
        ...settings.fileTree,
        ...next,
      },
    };
    setSettings(merged);
    const saved = await window.api.settings.save(merged);
    setSettings(saved);
  }, [settings]);

  const updateAppearanceSettings = useCallback(async (next: Partial<AppSettings['appearance']>) => {
    const merged: AppSettings = {
      ...settings,
      appearance: {
        ...settings.appearance,
        ...next,
      },
    };
    setSettings(merged);
    const saved = await window.api.settings.save(merged);
    setSettings(saved);
  }, [settings]);

  return (
    <AppSettingsContext.Provider value={{ settings, isLoaded, updateAttachmentSettings, updateFileTreeSettings, updateAppearanceSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return context;
};
