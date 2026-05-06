import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createEmptyExcalidrawFileContent } from '../utils/excalidraw';

interface Vault {
  id: string;
  name: string;
  path: string;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface VaultNode {
  id: string;
  type: 'file' | 'folder';
  name: string;
  ext?: string;
  content?: string;
  children?: VaultNode[];
  isOpen?: boolean;
  childrenLoaded?: boolean;
}

interface VaultContextType {
  nodes: VaultNode[];
  vault: Vault | null;
  recentVaults: Vault[];
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  
  // Legacy sync methods (for compatibility with existing components)
  createFile: (parentId: string | null, name: string, ext: 'md' | 'excalidraw') => string;
  createFolder: (parentId: string | null, name: string) => string;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  moveNode: (ids: string[], newParentId: string | null, index: number) => void;
  copyNode: (id: string) => string;
  updateFileContent: (id: string, content: string) => void;
  getNodeById: (id: string) => VaultNode | undefined;
  nextUntitledName: () => string;
  
  // Vault management
  setActiveVault: (vault: Vault) => void;
  clearActiveVault: () => void;
  refreshFileTree: (vaultOverride?: Vault, options?: { showLoading?: boolean }) => Promise<void>;
  refreshRecents: () => Promise<void>;
  
  // File operations
  getFileTree: () => Promise<FileNode | null>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  createFileRemote: (folderPath: string, name: string, ext: 'md' | 'excalidraw') => Promise<void>;
  createFolderRemote: (folderPath: string, name: string) => Promise<void>;
  deleteItem: (itemPath: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  
  expandFolder: (id: string) => Promise<void>;
  setFolderOpen: (id: string, isOpen: boolean) => void;
  setAllFoldersOpen: (isOpen: boolean) => void;

  // Utility
  normalizePath: (path: string) => string;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);


export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodes, setNodes] = useState<VaultNode[]>([]);
  const [vault, setVault] = useState<Vault | null>(null);
  const [recentVaults, setRecentVaults] = useState<Vault[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const untitledCounter = useRef(0);
  const openedVaultKeyRef = useRef<string | null>(null);
  const folderOpenStateRef = useRef<Map<string, boolean>>(new Map());

  const refreshRecents = useCallback(async () => {
    try {
      const config = await window.api.vault.recent();
      setRecentVaults(config.recentVaults);
    } catch (err) {
      console.warn('Failed to load recent vaults', err);
    }
  }, []);
  
  // Load last opened vault from main-process config file
  useEffect(() => {
    window.api.vault.recent().then(config => {
      const active = config.recentVaults.find(v => v.id === config.activeVaultId) || config.recentVaults[0];
      if (active) setVault(active);
      setRecentVaults(config.recentVaults);
    }).catch(() => {}).finally(() => setIsReady(true));
  }, []);
  
  const setActiveVault = useCallback((vaultData: Vault) => {
    setError(null);
    if (vaultData.id !== vault?.id || vaultData.path !== vault?.path) {
      folderOpenStateRef.current = new Map();
    }
    setVault(vaultData);
    refreshRecents();
  }, [refreshRecents, vault]);

  const clearActiveVault = useCallback(() => {
    window.api.vault.clear().catch(() => {});
    setError(null);
    setVault(null);
    setNodes([]);
    openedVaultKeyRef.current = null;
    folderOpenStateRef.current = new Map();
  }, []);

  const convertToVaultNodes = useCallback((fileNode: FileNode): VaultNode => {
    const ext = fileNode.isDirectory ? undefined : fileNode.name.includes('.') ? fileNode.name.split('.').pop()?.toLowerCase() : undefined;
    if (fileNode.isDirectory) {
      const id = fileNode.path || fileNode.name;
      return {
        id,
        type: 'folder',
        name: fileNode.name,
        children: fileNode.children?.map(convertToVaultNodes) ?? [],
        childrenLoaded: fileNode.children !== undefined,
        isOpen: folderOpenStateRef.current.get(id) ?? false,
      };
    }
    return {
      id: fileNode.path || fileNode.name,
      type: 'file',
      name: fileNode.name,
      ext,
    };
  }, []);

  const refreshFileTree = useCallback(async (vaultOverride?: Vault, options?: { showLoading?: boolean }) => {
    const activeVault = vaultOverride ?? vault;
    if (!activeVault) return;
    const showLoading = options?.showLoading ?? true;
    const vaultKey = `${activeVault.id}:${activeVault.path}`;

    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      if (openedVaultKeyRef.current !== vaultKey) {
        await window.api.vault.open(activeVault);
        openedVaultKeyRef.current = vaultKey;
      }
      const data = await window.api.files.tree();
      const root = convertToVaultNodes(data);
      setNodes(root.children || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file tree';
      console.error(message);
      setError(message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [vault, convertToVaultNodes]);

  // Refresh file tree whenever the active vault changes
  useEffect(() => {
    if (vault) {
      refreshFileTree(vault);
    }
  }, [vault]);

  useEffect(() => {
    if (!window.api?.files?.onChange) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = () => {
      if (!vault) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refreshFileTree(undefined, { showLoading: false }).catch(() => {});
        debounceTimer = null;
      }, 200);
    };

    const unsubscribe = window.api.files.onChange(() => handleChange());
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe?.();
    };
  }, [vault, refreshFileTree]);
  
  const normalizePath = useCallback((path: string): string => {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
  }, []);
  
  // Legacy sync methods for compatibility
  const nextUntitledName = useCallback((): string => {
    untitledCounter.current += 1;
    return `Untitled ${untitledCounter.current}`;
  }, []);
  
  const getNodeById = useCallback((id: string): VaultNode | undefined => {
    const find = (list: VaultNode[]): VaultNode | undefined => {
      for (const node of list) {
        if (node.id === id) return node;
        if (node.type === 'folder') {
          const found = find(node.children || []);
          if (found) return found;
        }
      }
      return undefined;
    };
    return find(nodes);
  }, [nodes]);

  const expandFolder = useCallback(async (id: string) => {
    const entries = await window.api.files.treeChildren(id);
    const children = entries.map((fileNode: FileNode) => convertToVaultNodes(fileNode));
    setNodes(prev => {
      const update = (list: VaultNode[]): VaultNode[] => list.map(node => {
        if (node.id === id && node.type === 'folder') {
          return { ...node, children, childrenLoaded: true, isOpen: folderOpenStateRef.current.get(id) ?? node.isOpen ?? false };
        }
        if (node.type === 'folder') return { ...node, children: update(node.children || []), isOpen: folderOpenStateRef.current.get(node.id) ?? node.isOpen };
        return node;
      });
      return update(prev);
    });
  }, [convertToVaultNodes]);

  const createFile = useCallback((parentId: string | null, name: string, ext: 'md' | 'excalidraw'): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const content = ext === 'md' ? '' : createEmptyExcalidrawFileContent();
    const newNode: VaultNode = { id, type: 'file', name, ext, content };
    
    setNodes(prev => {
      if (!parentId) return [...prev, newNode];
      const update = (list: VaultNode[]): VaultNode[] => list.map(node => {
        if (node.id === parentId && node.type === 'folder') return { ...node, children: [...(node.children || []), newNode] };
        if (node.type === 'folder') return { ...node, children: update(node.children || []) };
        return node;
      });
      return update(prev);
    });
    return id;
  }, []);
  
  const createFolder = useCallback((parentId: string | null, name: string): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNode: VaultNode = { id, type: 'folder', name, children: [], isOpen: true };
    setNodes(prev => {
      if (!parentId) return [...prev, newNode];
      const update = (list: VaultNode[]): VaultNode[] => list.map(node => {
        if (node.id === parentId && node.type === 'folder') return { ...node, children: [...(node.children || []), newNode] };
        if (node.type === 'folder') return { ...node, children: update(node.children || []) };
        return node;
      });
      return update(prev);
    });
    return id;
  }, []);
  
  const moveNode = useCallback((ids: string[], newParentId: string | null, index: number) => {
    setNodes(prev => {
      const extracted: VaultNode[] = [];
      const extract = (list: VaultNode[]): VaultNode[] =>
        list.filter(n => {
          if (ids.includes(n.id)) { extracted.push(n); return false; }
          return true;
        }).map(n => n.type === 'folder' ? { ...n, children: extract(n.children || []) } : n);

      const stripped = extract(prev);

      const insert = (list: VaultNode[]): VaultNode[] => {
        if (newParentId === null) {
          const r = [...list]; r.splice(index, 0, ...extracted); return r;
        }
        return list.map(n => {
          if (n.id === newParentId && n.type === 'folder') {
            const c = [...(n.children || [])]; c.splice(index, 0, ...extracted);
            return { ...n, children: c };
          }
          if (n.type === 'folder') return { ...n, children: insert(n.children || []) };
          return n;
        });
      };
      return insert(stripped);
    });
  }, []);
  
  const copyNode = useCallback((id: string): string => {
    const deepCopy = (node: VaultNode, newId: () => string): VaultNode => {
      if (node.type === 'file') return { ...node, id: newId(), name: node.name + ' copy' };
      return { ...node, id: newId(), children: node.children?.map(c => deepCopy(c, newId)) };
    };
    const gen = () => Math.random().toString(36).substr(2, 9);
    let newRootId = '';
    setNodes(prev => {
      const find = (list: VaultNode[]): VaultNode | undefined => {
        for (const n of list) {
          if (n.id === id) return n;
          if (n.type === 'folder') { const f = find(n.children || []); if (f) return f; }
        }
      };
      const original = find(prev);
      if (!original) return prev;
      const copied = deepCopy(original, gen);
      newRootId = copied.id;
      const insertAfter = (list: VaultNode[]): VaultNode[] => {
        const idx = list.findIndex(n => n.id === id);
        if (idx !== -1) { const r = [...list]; r.splice(idx + 1, 0, copied); return r; }
        return list.map(n => n.type === 'folder' ? { ...n, children: insertAfter(n.children || []) } : n);
      };
      return insertAfter(prev);
    });
    return newRootId;
  }, []);
  
  const renameNode = useCallback((id: string, newName: string) => {
    setNodes(prev => {
      const update = (list: VaultNode[]): VaultNode[] => list.map(node => {
        if (node.id === id) return { ...node, name: newName };
        if (node.type === 'folder') return { ...node, children: update(node.children || []) };
        return node;
      });
      return update(prev);
    });
  }, []);
  
  const deleteNode = useCallback((id: string) => {
    setNodes(prev => {
      const remove = (list: VaultNode[]): VaultNode[] => {
        return list.filter(node => node.id !== id).map(node => {
          if (node.type === 'folder') {
            return { ...node, children: remove(node.children || []) };
          }
          return node;
        });
      };
      return remove(prev);
    });
  }, []);
  
  const updateFileContent = useCallback((id: string, content: string) => {
    setNodes(prev => {
      const update = (list: VaultNode[]): VaultNode[] => {
        return list.map(node => {
          if (node.id === id && node.type === 'file') {
            return { ...node, content };
          }
          if (node.type === 'folder') {
            return { ...node, children: update(node.children || []) };
          }
          return node;
        });
      };
      return update(prev);
    });
  }, []);
  
  // Remote async methods
  const getFileTree = useCallback(async (): Promise<FileNode | null> => {
    if (!vault) return null;
    try {
      return await window.api.files.tree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file tree');
      return null;
    }
  }, [vault]);

  const readFile = useCallback(async (filePath: string): Promise<string> => {
    if (!vault) throw new Error('No vault selected');
    return window.api.files.read(filePath);
  }, [vault]);

  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    await window.api.files.write(filePath, content);
  }, [vault]);

  const createFileRemote = useCallback(async (folderPath: string, name: string, ext: 'md' | 'excalidraw'): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    const content = ext === 'md' ? '' : createEmptyExcalidrawFileContent();
    const filePath = `${folderPath}/${name}.${ext}`.replace(/\/+/g, '/');
    await window.api.files.create(filePath, 'file', content);
  }, [vault]);

  const createFolderRemote = useCallback(async (folderPath: string, name: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    const folderPathFinal = `${folderPath}/${name}`.replace(/\/+/g, '/');
    await window.api.files.create(folderPathFinal, 'directory');
  }, [vault]);

  const deleteItem = useCallback(async (itemPath: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    await window.api.files.delete(itemPath);
  }, [vault]);

  const renameItem = useCallback(async (oldPath: string, newName: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    const dirPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
    const newPath = dirPath ? `${dirPath}/${newName}` : newName;
    await window.api.files.rename(oldPath, newPath);
  }, [vault]);
  
  const setFolderOpen = useCallback((id: string, isOpen: boolean) => {
    folderOpenStateRef.current.set(id, isOpen);
    setNodes(prev => {
      const update = (list: VaultNode[]): VaultNode[] => list.map(node => {
        if (node.id === id && node.type === 'folder') return { ...node, isOpen };
        if (node.type === 'folder') return { ...node, children: update(node.children || []) };
        return node;
      });
      return update(prev);
    });
  }, []);

  const setAllFoldersOpen = useCallback((isOpen: boolean) => {
    setNodes(prev => {
      const update = (list: VaultNode[]): VaultNode[] => list.map(node => {
        if (node.type !== 'folder') return node;
        folderOpenStateRef.current.set(node.id, isOpen);
        return { ...node, isOpen, children: update(node.children || []) };
      });
      return update(prev);
    });
  }, []);

  const value: VaultContextType = {
    nodes,
    vault,
    recentVaults,
    isLoading,
    isReady,
    error,
    createFile,
    createFolder,
    deleteNode,
    renameNode,
    moveNode,
    copyNode,
    updateFileContent,
    getNodeById,
    expandFolder,
    setFolderOpen,
    setAllFoldersOpen,
    nextUntitledName,
    setActiveVault,
    clearActiveVault,
    refreshFileTree,
    refreshRecents,
    getFileTree,
    readFile,
    writeFile,
    createFileRemote,
    createFolderRemote,
    deleteItem,
    renameItem,
    normalizePath
  };
  
  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within a VaultProvider');
  return context;
};
