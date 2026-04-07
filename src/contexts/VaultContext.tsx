import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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
  ext?: 'md' | 'excalidraw';
  content?: string;
  children?: VaultNode[];
  isOpen?: boolean;
}

interface VaultContextType {
  nodes: VaultNode[];
  vault: Vault | null;
  isLoading: boolean;
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
  refreshFileTree: () => Promise<void>;
  
  // File operations
  getFileTree: () => Promise<FileNode | null>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  createFileRemote: (folderPath: string, name: string, ext: 'md' | 'excalidraw') => Promise<void>;
  createFolderRemote: (folderPath: string, name: string) => Promise<void>;
  deleteItem: (itemPath: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  
  // Utility
  normalizePath: (path: string) => string;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

// In-memory fallback nodes (when no vault is open)
const defaultNodes: VaultNode[] = [
  {
    id: '1',
    type: 'folder',
    name: 'Personal',
    children: [
      { id: '2', type: 'file', name: 'Ideas', ext: 'md', content: '# Ideas\n\n- Build Ibsidian\n- Learn Rust\n- Go for a run' },
      { id: '3', type: 'file', name: 'Journal', ext: 'md', content: '# Journal - April 7, 2026\n\nToday was a productive day. I started building Ibsidian.' },
    ],
    isOpen: true,
  },
  {
    id: '4',
    type: 'folder',
    name: 'Projects',
    children: [
      { id: '5', type: 'file', name: 'Ibsidian Design', ext: 'md', content: '# Ibsidian Design\n\nMinimalist knowledge vault.' },
      { id: '6', type: 'file', name: 'Architecture', ext: 'excalidraw', content: '{"elements": []}' },
    ],
    isOpen: false,
  },
  { id: '7', type: 'file', name: 'README', ext: 'md', content: '# Welcome to Ibsidian\n\nYour personal knowledge vault.' },
];

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodes, setNodes] = useState<VaultNode[]>(defaultNodes);
  const [vault, setVault] = useState<Vault | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const untitledCounter = useRef(0);
  
  // Load last opened vault from localStorage
  useEffect(() => {
    const savedVault = localStorage.getItem('ibsidian-vault');
    if (savedVault) {
      try {
        setVault(JSON.parse(savedVault));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);
  
  const setActiveVault = useCallback((vaultData: Vault) => {
    setVault(vaultData);
    localStorage.setItem('ibsidian-vault', JSON.stringify(vaultData));
    // Load file tree from backend
    refreshFileTree();
  }, []);
  
  const clearActiveVault = useCallback(() => {
    setVault(null);
    setNodes(defaultNodes);
    localStorage.removeItem('ibsidian-vault');
  }, []);
  
  const refreshFileTree = useCallback(async () => {
    if (!vault) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/files`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // Convert FileNode tree to VaultNode tree
      const convertToVaultNodes = (fileNode: FileNode): VaultNode => {
        const ext = fileNode.name.endsWith('.md') ? 'md' : fileNode.name.endsWith('.excalidraw') ? 'excalidraw' : undefined;
        return {
          id: fileNode.path || fileNode.name,
          type: fileNode.isDirectory ? 'folder' : 'file',
          name: fileNode.name,
          ext,
          children: fileNode.children?.map(convertToVaultNodes),
          isOpen: false,
        };
      };
      
      setNodes([convertToVaultNodes(data)]);
    } catch (err) {
      console.error('Failed to load file tree:', err);
      // Keep default nodes on error
    } finally {
      setIsLoading(false);
    }
  }, [vault]);
  
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
  
  const createFile = useCallback((parentId: string | null, name: string, ext: 'md' | 'excalidraw'): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const content = ext === 'md' ? `# ${name}\n\n` : '{"elements":[]}';
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
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/files`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file tree');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [vault]);
  
  const readFile = useCallback(async (filePath: string): Promise<string> => {
    if (!vault) throw new Error('No vault selected');
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/files/${encodeURIComponent(filePath)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.content;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vault]);
  
  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write file');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vault]);
  
  const createFileRemote = useCallback(async (folderPath: string, name: string, ext: 'md' | 'excalidraw'): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    
    try {
      setIsLoading(true);
      setError(null);
      const content = ext === 'md' ? `# ${name}\n\n` : '{"elements":[]}';
      const filePath = `${folderPath}/${name}.${ext}`.replace(/\/+/g, '/');
      const response = await fetch(`/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: filePath,
          type: 'file',
          name: `${name}.${ext}`,
          content
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vault]);
  
  const createFolderRemote = useCallback(async (folderPath: string, name: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    
    try {
      setIsLoading(true);
      setError(null);
      const folderPathFinal = `${folderPath}/${name}`.replace(/\/+/g, '/');
      const response = await fetch(`/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: folderPathFinal,
          type: 'directory',
          name
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vault]);
  
  const deleteItem = useCallback(async (itemPath: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/files/${encodeURIComponent(itemPath)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vault]);
  
  const renameItem = useCallback(async (oldPath: string, newName: string): Promise<void> => {
    if (!vault) throw new Error('No vault selected');
    
    try {
      setIsLoading(true);
      setError(null);
      const dirPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = `${dirPath}/${newName}`.replace(/\/+/g, '/');
      
      const isDirectory = !oldPath.includes('.') || oldPath.endsWith('/');
      
      if (isDirectory) {
        throw new Error('Directory rename not implemented');
      } else {
        const content = await readFile(oldPath);
        await writeFile(newPath, content);
        await deleteItem(oldPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vault, readFile, writeFile, deleteItem]);
  
  const value: VaultContextType = {
    nodes,
    vault,
    isLoading,
    error,
    createFile,
    createFolder,
    deleteNode,
    renameNode,
    moveNode,
    copyNode,
    updateFileContent,
    getNodeById,
    nextUntitledName,
    setActiveVault,
    clearActiveVault,
    refreshFileTree,
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