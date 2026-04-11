import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import type { AppSettings } from '../src/types'

// Suppress GPU/vaapi warnings on Linux
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('ignore-gpu-blacklist')
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('no-zygote')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
}
import { join, relative } from 'path'
import { readFile, writeFile, mkdir, readdir, rm, stat, rename } from 'fs/promises'
import { randomBytes } from 'crypto'
import { pathToFileURL } from 'url'
import chokidar from 'chokidar'
import * as nodePty from 'node-pty'

const isDev = !app.isPackaged

// ── Vault state ────────────────────────────────────────────────────────────
type Vault = { id: string; name: string; path: string }
const vaults: Vault[] = []
let activeVaultId: string | null = null
let vaultWatcher: chokidar.FSWatcher | null = null
let watchedVaultPath: string | null = null
const generateId = () => randomBytes(8).toString('hex')
const DEFAULT_SETTINGS: AppSettings = {
  attachments: {
    attachmentLocation: 'specific-folder',
    attachmentFolderPath: 'attachments/images',
  },
  fileTree: {
    style: 'original',
  },
  appearance: {
    fontSize: 'medium',
    compactMode: false,
  },
}

// ── Persistent vault config ────────────────────────────────────────────────
function vaultConfigPath() {
  return join(app.getPath('userData'), 'vault.json')
}

function settingsConfigPath() {
  return join(app.getPath('userData'), 'settings.json')
}

async function saveVaultConfig(vault: Vault) {
  try {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(vaultConfigPath(), JSON.stringify(vault), 'utf8')
  } catch { /* ignore */ }
}

async function loadVaultConfig(): Promise<Vault | null> {
  try {
    const raw = await readFile(vaultConfigPath(), 'utf8')
    return JSON.parse(raw) as Vault
  } catch {
    return null
  }
}

async function saveSettingsConfig(settings: AppSettings) {
  try {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(settingsConfigPath(), JSON.stringify(settings), 'utf8')
  } catch { /* ignore */ }
}

async function loadSettingsConfig(): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      attachments: {
        attachmentLocation: parsed.attachments?.attachmentLocation ?? DEFAULT_SETTINGS.attachments.attachmentLocation,
        attachmentFolderPath: parsed.attachments?.attachmentFolderPath ?? DEFAULT_SETTINGS.attachments.attachmentFolderPath,
      },
      fileTree: {
        style: parsed.fileTree?.style === 'hierarchy' ? 'hierarchy' : DEFAULT_SETTINGS.fileTree.style,
      },
      appearance: {
        fontSize: (['small', 'medium', 'large'] as const).includes(parsed.appearance?.fontSize as 'small' | 'medium' | 'large')
          ? (parsed.appearance!.fontSize as 'small' | 'medium' | 'large')
          : DEFAULT_SETTINGS.appearance.fontSize,
        compactMode: typeof parsed.appearance?.compactMode === 'boolean'
          ? parsed.appearance.compactMode
          : DEFAULT_SETTINGS.appearance.compactMode,
      },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// ── File watcher ───────────────────────────────────────────────────────────
function stopVaultWatcher() {
  if (vaultWatcher) {
    vaultWatcher.close().catch(() => {})
    vaultWatcher = null
  }
  watchedVaultPath = null
}

function startVaultWatcher(vaultPath: string) {
  if (vaultWatcher && watchedVaultPath === vaultPath) return
  stopVaultWatcher()

  const shouldIgnore = (p: string) => {
    const rel = relative(vaultPath, p).replace(/\\/g, '/')
    return rel.startsWith('..') || rel.startsWith('.git/') || rel.startsWith('node_modules/') || rel.includes('/.git/') || rel.includes('/node_modules/')
  }

  vaultWatcher = chokidar.watch(vaultPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    ignored: shouldIgnore,
  })
  watchedVaultPath = vaultPath

  const relay = (event: string, filePath: string) => {
    if (shouldIgnore(filePath)) return
    const rel = relative(vaultPath, filePath).replace(/\\/g, '/')
    if (rel.startsWith('..')) return
    mainWindow?.webContents.send('files:changed', { event, path: rel })
  }

  vaultWatcher
    .on('add', p => relay('add', p))
    .on('addDir', p => relay('addDir', p))
    .on('unlink', p => relay('unlink', p))
    .on('unlinkDir', p => relay('unlinkDir', p))
    .on('change', p => relay('change', p))
    .on('error', err => console.warn('Vault watcher error', err))
}

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
      webviewTag: true,
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  })

  if (isDev) {
    mainWindow.webContents.openDevTools()
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../../out/renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow!.show())
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  for (const term of ptySessions.values()) term.kill()
  stopVaultWatcher()
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
  startVaultWatcher(fullPath)
  await saveVaultConfig(vault)
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
  startVaultWatcher(vault.path)
  await saveVaultConfig(vault)
  return true
})

ipcMain.handle('vault:load-saved', async () => {
  return loadVaultConfig()
})

ipcMain.handle('app:home-dir', () => app.getPath('home'))
ipcMain.handle('settings:load', async () => loadSettingsConfig())
ipcMain.handle('settings:save', async (_, settings: AppSettings) => {
  const normalized: AppSettings = {
    attachments: {
      attachmentLocation: settings.attachments?.attachmentLocation === 'same-folder-as-note' ? 'same-folder-as-note' : 'specific-folder',
      attachmentFolderPath: settings.attachments?.attachmentFolderPath?.trim() || DEFAULT_SETTINGS.attachments.attachmentFolderPath,
    },
    fileTree: {
      style: settings.fileTree?.style === 'hierarchy' ? 'hierarchy' : DEFAULT_SETTINGS.fileTree.style,
    },
    appearance: {
      fontSize: (['small', 'medium', 'large'] as const).includes(settings.appearance?.fontSize as 'small' | 'medium' | 'large')
        ? (settings.appearance!.fontSize as 'small' | 'medium' | 'large')
        : DEFAULT_SETTINGS.appearance.fontSize,
      compactMode: typeof settings.appearance?.compactMode === 'boolean'
        ? settings.appearance.compactMode
        : DEFAULT_SETTINGS.appearance.compactMode,
    },
  }
  await saveSettingsConfig(normalized)
  return normalized
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

ipcMain.handle('files:write-binary', async (_, filePath: string, base64: string) => {
  const vault = getVault()
  const fullPath = join(vault.path, filePath)
  await mkdir(join(fullPath, '..'), { recursive: true })
  await writeFile(fullPath, Buffer.from(base64, 'base64'))
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

ipcMain.handle('files:url', async (_, filePath: string) => {
  const vault = getVault()
  return pathToFileURL(join(vault.path, filePath)).href
})

ipcMain.handle('files:data-url', async (_, filePath: string) => {
  const vault = getVault()
  const fullPath = join(vault.path, filePath)
  const buffer = await readFile(fullPath)
  const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
  const mimeType =
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'gif' ? 'image/gif' :
    ext === 'webp' ? 'image/webp' :
    ext === 'svg' ? 'image/svg+xml' :
    ext === 'bmp' ? 'image/bmp' :
    ext === 'ico' ? 'image/x-icon' :
    ext === 'avif' ? 'image/avif' :
    'image/png'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
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
