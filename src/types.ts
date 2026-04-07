export type VaultNode =
  | { id: string; type: 'folder'; name: string; children: VaultNode[]; isOpen?: boolean }
  | { id: string; type: 'file'; name: string; ext: 'md' | 'excalidraw'; content: string };

export type TabType = 'note' | 'browser' | 'draw' | 'terminal' | 'new-tab';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  filePath?: string;
  url?: string;
}

export type ActivityType = 'files' | 'search' | 'settings';
