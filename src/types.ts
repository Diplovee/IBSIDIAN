export type VaultNode =
  | { id: string; type: 'folder'; name: string; children: VaultNode[]; isOpen?: boolean }
  | { id: string; type: 'file'; name: string; ext?: string; content?: string };

export type TabType = 'note' | 'browser' | 'draw' | 'image' | 'terminal' | 'new-tab';
export type AttachmentLocation = 'same-folder-as-note' | 'specific-folder';
export type FileTreeStyle = 'original' | 'hierarchy';
export type FontSize = 'small' | 'medium' | 'large';

export interface ExcalidrawSceneFile {
  type: string;
  version: number;
  source: string;
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface AttachmentSettings {
  attachmentLocation: AttachmentLocation;
  attachmentFolderPath: string;
}

export interface AppSettings {
  attachments: AttachmentSettings;
  fileTree: {
    style: FileTreeStyle;
  };
  appearance: {
    fontSize: FontSize;
    compactMode: boolean;
  };
}

export interface BrowserTabGroup {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
}

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  filePath?: string;
  url?: string;
  customTitle?: string;
  groupId?: string;
}

export type ActivityType = 'files' | 'search';
