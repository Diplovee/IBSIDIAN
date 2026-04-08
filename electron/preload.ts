import { contextBridge, ipcRenderer } from 'electron'

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

  files: {
    tree: () =>
      ipcRenderer.invoke('files:tree'),
    read: (path: string) =>
      ipcRenderer.invoke('files:read', path),
    write: (path: string, content: string) =>
      ipcRenderer.invoke('files:write', path, content),
    create: (path: string, type: 'file' | 'directory', content?: string) =>
      ipcRenderer.invoke('files:create', path, type, content),
    delete: (path: string) =>
      ipcRenderer.invoke('files:delete', path),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('files:rename', oldPath, newPath),
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
