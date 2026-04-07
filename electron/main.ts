import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, relative } from 'path'
import { readFile, writeFile, mkdir, readdir, rm, stat, rename } from 'fs/promises'
import { randomBytes } from 'crypto'
import * as nodePty from 'node-pty'

const isDev = !app.isPackaged

// ── Vault state ────────────────────────────────────────────────────────────
type Vault = { id: string; name: string; path: string }
const vaults: Vault[] = []
let activeVaultId: string | null = null
const generateId = () => randomBytes(8).toString('hex')

// ── PTY sessions ───────────────────────────────────────────────────────────
const ptySessions = new Map<string, nodePty.IPty>()
let mainWindow: BrowserWindow | null = null

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../../out/renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow!.show())
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  for (const term of ptySessions.values()) term.kill()
  if (process.platform !== 'darwin') app.quit()
})

// ── Vault IPC ──────────────────────────────────────────────────────────────
ipcMain.handle('vault:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select vault location',
  })
  return result.filePaths[0] ?? null
})

ipcMain.handle('vault:create', async (_, { name, path: vaultPath }: { name: string; path: string }) => {
  const fullPath = join(vaultPath, name)
  await mkdir(fullPath, { recursive: false })

  const today = new Date().toISOString().split('T')[0]
  await mkdir(join(fullPath, 'Daily Notes'), { recursive: true })
  await mkdir(join(fullPath, 'Templates'), { recursive: true })

  await writeFile(join(fullPath, 'README.md'),
    `# Welcome to ${name}\n\nYour personal knowledge vault is ready! 🎉\n\n## Getting Started\n\n- Create notes with \`Ctrl+K\`\n- Browse files in the sidebar\n- Use the built-in terminal\n`)
  await writeFile(join(fullPath, 'Getting Started.md'),
    `# Getting Started with Ibsidian\n\n## Keyboard Shortcuts\n\n| Shortcut | Action |\n|---|---|\n| \`Ctrl+K\` | Command palette |\n`)
  await writeFile(join(fullPath, 'Ideas.md'),
    `# Ideas\n\n- [ ] \n`)
  await writeFile(join(fullPath, 'Daily Notes', `${today}.md`),
    `# ${today}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`)
  await writeFile(join(fullPath, 'Templates', 'Daily Note.md'),
    `# {{date}}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`)
  await writeFile(join(fullPath, 'Templates', 'Meeting Notes.md'),
    `# Meeting — {{title}}\n\n## Attendees\n\n## Notes\n\n## Action Items\n\n- [ ] \n`)

  const vault: Vault = { id: generateId(), name, path: fullPath }
  vaults.push(vault)
  activeVaultId = vault.id
  return vault
})

ipcMain.handle('vault:open', async (_, vault: Vault) => {
  try {
    const s = await stat(vault.path)
    if (!s.isDirectory()) throw new Error('Not a directory')
  } catch {
    throw new Error(`Vault folder not found: ${vault.path}`)
  }
  if (!vaults.find(v => v.id === vault.id)) vaults.push(vault)
  activeVaultId = vault.id
  return true
})

// ── File IPC ───────────────────────────────────────────────────────────────
function getVault(): Vault {
  if (!activeVaultId) throw new Error('No vault selected')
  const v = vaults.find(v => v.id === activeVaultId)
  if (!v) throw new Error('Vault not found')
  return v
}

async function readDirRecursive(dirPath: string, vaultPath: string): Promise<any[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  return Promise.all(
    entries.map(async entry => {
      const fullPath = join(dirPath, entry.name)
      const node: any = {
        name: entry.name,
        path: relative(vaultPath, fullPath).replace(/\\/g, '/'),
        isDirectory: entry.isDirectory(),
      }
      if (entry.isDirectory()) node.children = await readDirRecursive(fullPath, vaultPath)
      return node
    })
  )
}

ipcMain.handle('files:tree', async () => {
  const vault = getVault()
  const children = await readDirRecursive(vault.path, vault.path)
  return { name: vault.name, path: '', isDirectory: true, children }
})

ipcMain.handle('files:read', async (_, filePath: string) => {
  const vault = getVault()
  return readFile(join(vault.path, filePath), 'utf8')
})

ipcMain.handle('files:write', async (_, filePath: string, content: string) => {
  const vault = getVault()
  const fullPath = join(vault.path, filePath)
  await mkdir(join(fullPath, '..'), { recursive: true })
  await writeFile(fullPath, content, 'utf8')
})

ipcMain.handle('files:create', async (_, filePath: string, type: 'file' | 'directory', content = '') => {
  const vault = getVault()
  const fullPath = join(vault.path, filePath)
  if (type === 'directory') {
    await mkdir(fullPath, { recursive: true })
  } else {
    await mkdir(join(fullPath, '..'), { recursive: true })
    await writeFile(fullPath, content, 'utf8')
  }
})

ipcMain.handle('files:delete', async (_, filePath: string) => {
  const vault = getVault()
  await rm(join(vault.path, filePath), { recursive: true, force: true })
})

ipcMain.handle('files:rename', async (_, oldPath: string, newPath: string) => {
  const vault = getVault()
  await rename(join(vault.path, oldPath), join(vault.path, newPath))
})

// ── Terminal IPC ───────────────────────────────────────────────────────────
ipcMain.handle('terminal:create', async (_, cols: number, rows: number) => {
  const vault = activeVaultId ? vaults.find(v => v.id === activeVaultId) : null
  const cwd = vault?.path ?? process.env.HOME ?? '/'
  const sessionId = generateId()

  const term = nodePty.spawn(process.env.SHELL || '/bin/bash', [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd,
    env: process.env as Record<string, string>,
  })

  ptySessions.set(sessionId, term)

  term.onData(data => mainWindow?.webContents.send('terminal:data', sessionId, data))
  term.onExit(() => {
    mainWindow?.webContents.send('terminal:exit', sessionId)
    ptySessions.delete(sessionId)
  })

  return sessionId
})

ipcMain.handle('terminal:input', (_, sessionId: string, data: string) => {
  ptySessions.get(sessionId)?.write(data)
})

ipcMain.handle('terminal:resize', (_, sessionId: string, cols: number, rows: number) => {
  ptySessions.get(sessionId)?.resize(cols, rows)
})

ipcMain.handle('terminal:close', (_, sessionId: string) => {
  const term = ptySessions.get(sessionId)
  if (term) { term.kill(); ptySessions.delete(sessionId) }
})
