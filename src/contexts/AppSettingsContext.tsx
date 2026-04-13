import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AppSettings, AgentSettings, AgentKey } from '../types';

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
  agents: {
    claude: true,
    codex: true,
    pi: true,
    productivity: true,
    order: ['claude', 'codex', 'pi', 'productivity'] as AgentKey[],
    productivityProvider: 'codex',
    openrouterApiKey: undefined,
  },
};

interface AppSettingsContextType {
  settings: AppSettings;
  isLoaded: boolean;
  updateAttachmentSettings: (next: Partial<AppSettings['attachments']>) => Promise<void>;
  updateFileTreeSettings: (next: Partial<AppSettings['fileTree']>) => Promise<void>;
  updateAppearanceSettings: (next: Partial<AppSettings['appearance']>) => Promise<void>;
  updateAgentSettings: (next: Partial<AgentSettings>) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    window.api.settings.load()
      .then(loaded => setSettings({
        ...DEFAULT_SETTINGS, ...loaded,
        agents: {
          ...DEFAULT_SETTINGS.agents,
          ...loaded.agents,
          productivity: loaded.agents?.productivity ?? DEFAULT_SETTINGS.agents.productivity,
          productivityProvider: loaded.agents?.productivityProvider ?? DEFAULT_SETTINGS.agents.productivityProvider,
          openrouterApiKey: loaded.agents?.openrouterApiKey ?? DEFAULT_SETTINGS.agents.openrouterApiKey,
          order: (() => {
            const saved: AgentKey[] = loaded.agents?.order?.length ? loaded.agents.order : DEFAULT_SETTINGS.agents.order;
            const missing = DEFAULT_SETTINGS.agents.order.filter(k => !saved.includes(k));
            return [...saved, ...missing] as AgentKey[];
          })(),
        },
      }))
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

  const updateAgentSettings = useCallback(async (next: Partial<AgentSettings>) => {
    const merged: AppSettings = {
      ...settings,
      agents: { ...settings.agents, ...next },
    };
    setSettings(merged);
    window.api.settings.save(merged).catch(() => {});
  }, [settings]);

  return (
    <AppSettingsContext.Provider value={{ settings, isLoaded, updateAttachmentSettings, updateFileTreeSettings, updateAppearanceSettings, updateAgentSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return context;
};
