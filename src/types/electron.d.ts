export {}

import type { AppSettings } from '../types'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
    api: {
      vault: {
        selectFolder: () => Promise<string | null>
        create: (name: string, path: string) => Promise<{ id: string; name: string; path: string }>
        open: (vault: { id: string; name: string; path: string }) => Promise<boolean>
        loadSaved: () => Promise<{ id: string; name: string; path: string } | null>
      }
      app: {
        homeDir: () => Promise<string>
        checkForUpdates: () => Promise<{
          supported: boolean
          updateAvailable: boolean
          current: string | null
          latest: string | null
          branch: string | null
          hasLocalChanges: boolean
          message: string
        }>
        applyUpdate: () => Promise<{
          ok: boolean
          message: string
          log: string
        }>
        restart: () => Promise<boolean>
      }
      theme: {
        set: (theme: 'light' | 'dark') => Promise<void>
      }
      settings: {
        load: () => Promise<AppSettings>
        save: (settings: AppSettings) => Promise<AppSettings>
      }
      files: {
        tree: () => Promise<FileNode>
        read: (path: string) => Promise<string>
        write: (path: string, content: string) => Promise<void>
        writeBinary: (path: string, base64: string) => Promise<void>
        create: (path: string, type: 'file' | 'directory', content?: string) => Promise<void>
        delete: (path: string) => Promise<void>
        rename: (oldPath: string, newPath: string) => Promise<void>
        url: (path: string) => Promise<string>
        dataUrl: (path: string) => Promise<string>
        search: (query: string, options: { caseSensitive: boolean }) => Promise<Array<{ path: string; line: number; text: string; matchType: 'content' | 'filename' }>>
        onChange: (cb: (event: FileChangeEvent) => void) => () => void
      }
      terminal: {
        create: (cols: number, rows: number) => Promise<string>
        input: (sessionId: string, data: string) => Promise<void>
        resize: (sessionId: string, cols: number, rows: number) => Promise<void>
        close: (sessionId: string) => Promise<void>
        onData: (cb: (sessionId: string, data: string) => void) => () => void
        onExit: (cb: (sessionId: string) => void) => () => void
      }
    }
  }

  interface FileNode {
    name: string
    path: string
    isDirectory: boolean
    children?: FileNode[]
    content?: string
  }

  type FileChangeEvent = {
    event: 'add' | 'addDir' | 'unlink' | 'unlinkDir' | 'change'
    path: string
  }
}
