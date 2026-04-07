export {}

declare global {
  interface Window {
    api: {
      vault: {
        selectFolder: () => Promise<string | null>
        create: (name: string, path: string) => Promise<{ id: string; name: string; path: string }>
        open: (vault: { id: string; name: string; path: string }) => Promise<boolean>
      }
      files: {
        tree: () => Promise<FileNode>
        read: (path: string) => Promise<string>
        write: (path: string, content: string) => Promise<void>
        create: (path: string, type: 'file' | 'directory', content?: string) => Promise<void>
        delete: (path: string) => Promise<void>
        rename: (oldPath: string, newPath: string) => Promise<void>
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
}
