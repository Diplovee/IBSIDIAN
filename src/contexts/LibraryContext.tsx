import React, { createContext, useContext, useState, useCallback } from 'react';
import type { SavedGroup, HistoryEntry } from '../types';

const SAVED_GROUPS_KEY = 'ibsidian-saved-groups';
const HISTORY_KEY = 'ibsidian-browser-history';
const MAX_HISTORY = 500;

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};

const saveToStorage = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

interface LibraryContextType {
  savedGroups: SavedGroup[];
  history: HistoryEntry[];
  saveGroup: (group: SavedGroup) => void;
  deleteSavedGroup: (id: string) => void;
  addToHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  updateHistoryTitle: (url: string, title: string, faviconUrl?: string, groupId?: string) => void;
  removeHistoryEntry: (id: string) => void;
  clearHistory: () => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>(() => loadFromStorage(SAVED_GROUPS_KEY, []));
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadFromStorage(HISTORY_KEY, []));

  const saveGroup = useCallback((group: SavedGroup) => {
    setSavedGroups(prev => {
      const filtered = prev.filter(g => g.id !== group.id);
      const next = [group, ...filtered];
      saveToStorage(SAVED_GROUPS_KEY, next);
      return next;
    });
  }, []);

  const deleteSavedGroup = useCallback((id: string) => {
    setSavedGroups(prev => {
      const next = prev.filter(g => g.id !== id);
      saveToStorage(SAVED_GROUPS_KEY, next);
      return next;
    });
  }, []);

  const addToHistory = useCallback((entry: Omit<HistoryEntry, 'id'>) => {
    const url = entry.url?.trim();
    if (!url || url === 'about:blank' || url.startsWith('chrome://')) return;

    setHistory(prev => {
      const existing = prev.find(item => item.url === url && (item.groupId ?? '') === (entry.groupId ?? ''));
      const id = existing?.id ?? Math.random().toString(36).slice(2, 10);
      const nextEntry: HistoryEntry = {
        id,
        url,
        title: entry.title?.trim() || url,
        faviconUrl: entry.faviconUrl,
        visitedAt: entry.visitedAt,
        groupId: entry.groupId,
        groupName: entry.groupName,
      };
      const next = [nextEntry, ...prev.filter(item => !(item.url === url && (item.groupId ?? '') === (entry.groupId ?? '')))].slice(0, MAX_HISTORY);
      saveToStorage(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const updateHistoryTitle = useCallback((url: string, title: string, faviconUrl?: string, groupId?: string) => {
    setHistory(prev => {
      const idx = prev.findIndex(e => e.url === url && (e.groupId ?? '') === (groupId ?? ''));
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], title, ...(faviconUrl ? { faviconUrl } : {}) };
      saveToStorage(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const removeHistoryEntry = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.filter(entry => entry.id !== id);
      saveToStorage(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveToStorage(HISTORY_KEY, []);
  }, []);

  return (
    <LibraryContext.Provider value={{ savedGroups, history, saveGroup, deleteSavedGroup, addToHistory, updateHistoryTitle, removeHistoryEntry, clearHistory }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
};
