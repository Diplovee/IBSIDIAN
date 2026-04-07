import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { VaultNode } from '../types';

interface VaultContextType {
  nodes: VaultNode[];
  createFile: (parentId: string | null, name: string, ext: 'md' | 'excalidraw') => string;
  createFolder: (parentId: string | null, name: string) => string;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  moveNode: (ids: string[], newParentId: string | null, index: number) => void;
  copyNode: (id: string) => string;
  updateFileContent: (id: string, content: string) => void;
  getNodeById: (id: string) => VaultNode | undefined;
  nextUntitledName: () => string;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

const initialNodes: VaultNode[] = [
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
  const [nodes, setNodes] = useState<VaultNode[]>(initialNodes);
  const untitledCounter = useRef(0);

  const nextUntitledName = useCallback((): string => {
    untitledCounter.current += 1;
    return `Untitled ${untitledCounter.current}`;
  }, []);

  const getNodeById = useCallback((id: string): VaultNode | undefined => {
    const find = (list: VaultNode[]): VaultNode | undefined => {
      for (const node of list) {
        if (node.id === id) return node;
        if (node.type === 'folder') {
          const found = find(node.children);
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
        if (node.id === parentId && node.type === 'folder') return { ...node, children: [...node.children, newNode] };
        if (node.type === 'folder') return { ...node, children: update(node.children) };
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
        if (node.id === parentId && node.type === 'folder') return { ...node, children: [...node.children, newNode] };
        if (node.type === 'folder') return { ...node, children: update(node.children) };
        return node;
      });
      return update(prev);
    });
    return id;
  }, []);

  const moveNode = useCallback((ids: string[], newParentId: string | null, index: number) => {
    setNodes(prev => {
      // Extract all moved nodes first
      const extracted: VaultNode[] = [];
      const extract = (list: VaultNode[]): VaultNode[] =>
        list.filter(n => {
          if (ids.includes(n.id)) { extracted.push(n); return false; }
          return true;
        }).map(n => n.type === 'folder' ? { ...n, children: extract(n.children) } : n);

      const stripped = extract(prev);

      // Insert at new location
      const insert = (list: VaultNode[]): VaultNode[] => {
        if (newParentId === null) {
          const r = [...list]; r.splice(index, 0, ...extracted); return r;
        }
        return list.map(n => {
          if (n.id === newParentId && n.type === 'folder') {
            const c = [...n.children]; c.splice(index, 0, ...extracted);
            return { ...n, children: c };
          }
          if (n.type === 'folder') return { ...n, children: insert(n.children) };
          return n;
        });
      };
      return insert(stripped);
    });
  }, []);

  const copyNode = useCallback((id: string): string => {
    const deepCopy = (node: VaultNode, newId: () => string): VaultNode => {
      if (node.type === 'file') return { ...node, id: newId(), name: node.name + ' copy' };
      return { ...node, id: newId(), children: node.children.map(c => deepCopy(c, newId)) };
    };
    const gen = () => Math.random().toString(36).substr(2, 9);
    let newRootId = '';
    setNodes(prev => {
      const find = (list: VaultNode[]): VaultNode | undefined => {
        for (const n of list) {
          if (n.id === id) return n;
          if (n.type === 'folder') { const f = find(n.children); if (f) return f; }
        }
      };
      const original = find(prev);
      if (!original) return prev;
      const copied = deepCopy(original, gen);
      newRootId = copied.id;
      const insertAfter = (list: VaultNode[]): VaultNode[] => {
        const idx = list.findIndex(n => n.id === id);
        if (idx !== -1) { const r = [...list]; r.splice(idx + 1, 0, copied); return r; }
        return list.map(n => n.type === 'folder' ? { ...n, children: insertAfter(n.children) } : n);
      };
      return insertAfter(prev);
    });
    return newRootId;
  }, []);

  const renameNode = useCallback((id: string, newName: string) => {
    setNodes(prev => {
      const update = (list: VaultNode[]): VaultNode[] => list.map(node => {
        if (node.id === id) return { ...node, name: newName };
        if (node.type === 'folder') return { ...node, children: update(node.children) };
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
            return { ...node, children: remove(node.children) };
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
            return { ...node, children: update(node.children) };
          }
          return node;
        });
      };
      return update(prev);
    });
  }, []);

  return (
    <VaultContext.Provider value={{ nodes, createFile, createFolder, deleteNode, renameNode, moveNode, copyNode, updateFileContent, getNodeById, nextUntitledName }}>
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within a VaultProvider');
  return context;
};
