import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '../src/types'

contextBridge.exposeInMainWorld('api', {
  vault: {
    selectFolder: () =>
      ipcRenderer.invoke('vault:select-folder'),
    create: (name: string, path: string) =>
      ipcRenderer.invoke('vault:create', { name, path }),
    open: (vault: { id: string; name: string; path: string }) =>
      ipcRenderer.invoke('vault:open', vault),
    loadSaved: () =>
      ipcRenderer.invoke('vault:load-saved'),
  },
  app: {
    homeDir: () => ipcRenderer.invoke('app:home-dir'),
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    changelog: (): Promise<string | null> => ipcRenderer.invoke('app:changelog'),
    checkForUpdates: () => ipcRenderer.invoke('app:updates:check'),
    applyUpdate: () => ipcRenderer.invoke('app:updates:apply'),
    restart: () => ipcRenderer.invoke('app:restart'),
  },
  theme: {
    set: (theme: 'light' | 'dark'): Promise<void> =>
      ipcRenderer.invoke('theme:set', theme),
  },
  settings: {
    load: (): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:load'),
    save: (settings: AppSettings): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:save', settings),
  },

  files: {
    tree: () =>
      ipcRenderer.invoke('files:tree'),
    treeChildren: (path: string) =>
      ipcRenderer.invoke('files:tree:children', path),
    read: (path: string) =>
      ipcRenderer.invoke('files:read', path),
    write: (path: string, content: string) =>
      ipcRenderer.invoke('files:write', path, content),
    writeBinary: (path: string, base64: string) =>
      ipcRenderer.invoke('files:write-binary', path, base64),
    create: (path: string, type: 'file' | 'directory', content?: string) =>
      ipcRenderer.invoke('files:create', path, type, content),
    delete: (path: string) =>
      ipcRenderer.invoke('files:delete', path),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('files:rename', oldPath, newPath),
    url: (path: string) =>
      ipcRenderer.invoke('files:url', path),
    dataUrl: (path: string) =>
      ipcRenderer.invoke('files:data-url', path),
    search: (query: string, options: { caseSensitive: boolean }) =>
      ipcRenderer.invoke('files:search', query, options),
    onChange: (cb: (evt: { event: string; path: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, payload: { event: string; path: string }) => cb(payload)
      ipcRenderer.on('files:changed', handler)
      return () => ipcRenderer.removeListener('files:changed', handler)
    },
  },

  terminal: {
    create: (cols: number, rows: number): Promise<string> =>
      ipcRenderer.invoke('terminal:create', cols, rows),
    input: (sessionId: string, data: string) =>
      ipcRenderer.invoke('terminal:input', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
    close: (sessionId: string) =>
      ipcRenderer.invoke('terminal:close', sessionId),
    onData: (cb: (sessionId: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, sid: string, data: string) => cb(sid, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (cb: (sessionId: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, sid: string) => cb(sid)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
  },
})
