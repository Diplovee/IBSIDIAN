import React, { createContext, useContext, useState, useCallback } from 'react';
import { VaultNode } from '../types';

interface VaultContextType {
  nodes: VaultNode[];
  createFile: (parentId: string | null, name: string, ext: 'md' | 'excalidraw') => string;
  createFolder: (parentId: string | null, name: string) => string;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  getNodeById: (id: string) => VaultNode | undefined;
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
    <VaultContext.Provider value={{ nodes, createFile, createFolder, deleteNode, renameNode, updateFileContent, getNodeById }}>
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within a VaultProvider');
  return context;
};
