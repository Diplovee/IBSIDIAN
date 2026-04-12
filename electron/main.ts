import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } from 'electron'
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
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import chokidar from 'chokidar'
import * as nodePty from 'node-pty'

const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL'])

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
  agents: {
    claude: true,
    codex: true,
    pi: true,
    order: ['claude', 'codex', 'pi'] as ('claude' | 'codex' | 'pi')[],
  },
}

// ── Persistent vault config ────────────────────────────────────────────────
function vaultConfigPath() {
  return join(app.getPath('userData'), 'vault.json')
}

function settingsConfigPath() {
  return join(app.getPath('userData'), 'settings.json')
}

function findProjectRoot() {
  const candidates = Array.from(new Set([
    process.cwd(),
    app.getAppPath(),
    join(app.getAppPath(), '..'),
    join(app.getAppPath(), '../..'),
    __dirname,
    join(__dirname, '..'),
    join(__dirname, '../..'),
    join(__dirname, '../../..'),
  ]))

  return candidates.find(path =>
    existsSync(join(path, '.git')) && existsSync(join(path, 'package.json')),
  ) ?? null
}

function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    const child = spawn(command, args, { cwd, shell: false })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      stderr += error.message
      resolve({ stdout, stderr, code: 1 })
    })
    child.on('close', (code) => {
      resolve({ stdout, stderr, code })
    })
  })
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
      agents: {
        claude: typeof parsed.agents?.claude === 'boolean' ? parsed.agents.claude : DEFAULT_SETTINGS.agents.claude,
        codex: typeof parsed.agents?.codex === 'boolean' ? parsed.agents.codex : DEFAULT_SETTINGS.agents.codex,
        pi: typeof parsed.agents?.pi === 'boolean' ? parsed.agents.pi : DEFAULT_SETTINGS.agents.pi,
        order: (Array.isArray(parsed.agents?.order) && parsed.agents.order.length ? parsed.agents.order : DEFAULT_SETTINGS.agents.order) as ('claude' | 'codex' | 'pi')[],
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

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../../out/renderer/index.html'))
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isToggleDevTools = input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'c'
    if (!isToggleDevTools) return

    event.preventDefault()
    if (mainWindow?.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools()
    } else {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

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
ipcMain.handle('app:updates:check', async () => {
  const projectRoot = findProjectRoot()
  if (!projectRoot) {
    return {
      supported: false,
      updateAvailable: false,
      current: null,
      latest: null,
      branch: null,
      hasLocalChanges: false,
      message: 'Update check only works in a git clone of IBSIDIAN.',
    }
  }

  const branchResult = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot)
  const branch = branchResult.stdout.trim() || 'main'
  await runCommand('git', ['fetch', 'origin', branch], projectRoot)

  const currentResult = await runCommand('git', ['rev-parse', 'HEAD'], projectRoot)
  const latestResult = await runCommand('git', ['rev-parse', `origin/${branch}`], projectRoot)
  const dirtyResult = await runCommand('git', ['status', '--porcelain'], projectRoot)

  const current = currentResult.stdout.trim() || null
  const latest = latestResult.stdout.trim() || null
  const hasLocalChanges = Boolean(dirtyResult.stdout.trim())
  const updateAvailable = Boolean(current && latest && current !== latest)

  return {
    supported: true,
    updateAvailable,
    current,
    latest,
    branch,
    hasLocalChanges,
    message: updateAvailable
      ? `Update available on ${branch}.`
      : `You're up to date on ${branch}.`,
  }
})
ipcMain.handle('app:updates:apply', async () => {
  const projectRoot = findProjectRoot()
  if (!projectRoot) {
    return { ok: false, message: 'Update is only supported in a git clone of IBSIDIAN.', log: '' }
  }

  const dirtyResult = await runCommand('git', ['status', '--porcelain'], projectRoot)
  if (dirtyResult.stdout.trim()) {
    return {
      ok: false,
      message: 'Local changes detected. Commit/stash them before updating.',
      log: dirtyResult.stdout,
    }
  }

  const pull = await runCommand('git', ['pull', '--ff-only'], projectRoot)
  if (pull.code !== 0) {
    return { ok: false, message: 'git pull failed.', log: `${pull.stdout}\n${pull.stderr}`.trim() }
  }

  const install = await runCommand('bun', ['install'], projectRoot)
  if (install.code !== 0) {
    return { ok: false, message: 'bun install failed after pull.', log: `${install.stdout}\n${install.stderr}`.trim() }
  }

  const build = await runCommand('bun', ['run', 'build'], projectRoot)
  if (build.code !== 0) {
    return { ok: false, message: 'bun run build failed after update.', log: `${build.stdout}\n${build.stderr}`.trim() }
  }

  return {
    ok: true,
    message: 'Updated successfully. Please restart IBSIDIAN to load the new build.',
    log: `${pull.stdout}\n${install.stdout}\n${build.stdout}`.trim(),
  }
})
ipcMain.handle('app:restart', async () => {
  app.relaunch()
  app.exit(0)
  return true
})
ipcMain.handle('theme:set', (_: Electron.IpcMainInvokeEvent, theme: 'light' | 'dark') => {
  nativeTheme.themeSource = theme
})

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
    agents: {
      claude: typeof settings.agents?.claude === 'boolean' ? settings.agents.claude : DEFAULT_SETTINGS.agents.claude,
      codex: typeof settings.agents?.codex === 'boolean' ? settings.agents.codex : DEFAULT_SETTINGS.agents.codex,
      pi: typeof settings.agents?.pi === 'boolean' ? settings.agents.pi : DEFAULT_SETTINGS.agents.pi,
      order: (Array.isArray(settings.agents?.order) && settings.agents.order.length ? settings.agents.order : DEFAULT_SETTINGS.agents.order) as ('claude' | 'codex' | 'pi')[],
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

// ── Search IPC ────────────────────────────────────────────────────────────
ipcMain.handle('files:search', async (_, query: string, options: { caseSensitive: boolean }) => {
  if (!query.trim()) return []
  const vault = getVault()
  const needle = options.caseSensitive ? query : query.toLowerCase()
  const contentResults: Array<{ path: string; line: number; text: string; matchType: 'content' | 'filename' }> = []
  const filenameResults: Array<{ path: string; line: number; text: string; matchType: 'content' | 'filename' }> = []

  async function searchDir(dirPath: string) {
    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => null)
    if (!entries) return
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await searchDir(fullPath)
      } else {
        const relPath = relative(vault.path, fullPath).replace(/\\/g, '/')
        const nameHaystack = options.caseSensitive ? entry.name : entry.name.toLowerCase()
        if (nameHaystack.includes(needle)) {
          filenameResults.push({ path: relPath, line: 0, text: '', matchType: 'filename' })
        }
        if (entry.name.endsWith('.md') && contentResults.length < 500) {
          const content = await readFile(fullPath, 'utf8').catch(() => null)
          if (content === null) continue
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const haystack = options.caseSensitive ? lines[i] : lines[i].toLowerCase()
            if (haystack.includes(needle)) {
              contentResults.push({ path: relPath, line: i + 1, text: lines[i].trim(), matchType: 'content' })
              if (contentResults.length >= 500) break
            }
          }
        }
      }
    }
  }

  await searchDir(vault.path)
  return [...filenameResults, ...contentResults]
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
