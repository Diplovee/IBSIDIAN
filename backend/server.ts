import { readFile, stat, mkdir, readdir, writeFile, rm } from 'fs/promises';
import { join, relative, sep } from 'path';
import { randomBytes } from 'crypto';
import * as pty from 'node-pty';
import type { ServerWebSocket } from 'bun';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Types
type Vault = {
  id: string;
  name: string;
  path: string;
};

type FileNode = {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
};

// In-memory storage for active vaults
const vaults: Vault[] = [];
let activeVaultId: string | null = null;

// Helper functions
const generateId = () => randomBytes(8).toString('hex');

const isPathInVault = (vaultPath: string, targetPath: string): boolean => {
  const relativePath = relative(vaultPath, targetPath);
  return !relativePath.startsWith('..') && !relativePath.startsWith(sep);
};

const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
};

const ensureVaultSelected = () => {
  if (!activeVaultId) {
    throw new Error('No vault is currently open');
  }
  const vault = vaults.find(v => v.id === activeVaultId);
  if (!vault) {
    throw new Error('Active vault not found');
  }
  return vault;
};

// WebSocket server for terminal
const server = Bun.serve({
  port: PORT,
  development: true,
  websocket: {
    open(ws) {
      console.log('WebSocket client connected');
      (ws as any).pty = null;
      ws.send(JSON.stringify({ type: 'welcome', message: 'Terminal connected' }));
    },
    
    async message(ws: ServerWebSocket<unknown>, message) {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'init': {
            // Kill any existing pty for this connection
            const existing = (ws as any).pty;
            if (existing) { existing.kill(); delete (ws as any).pty; }

            const cols = data.cols ?? 80;
            const rows = data.rows ?? 24;
            const cwd = activeVaultId
              ? vaults.find(v => v.id === activeVaultId)?.path
              : process.env.HOME;

            const term = pty.spawn(process.env.SHELL || '/bin/bash', [], {
              name: 'xterm-256color',
              cols,
              rows,
              cwd,
              env: process.env as Record<string, string>,
            });

            (ws as any).pty = term;

            term.onData((data: string) => {
              try {
                ws.send(JSON.stringify({ type: 'output', data }));
              } catch {}
            });

            term.onExit(({ exitCode }: { exitCode: number }) => {
              try {
                ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
              } catch {}
              delete (ws as any).pty;
            });

            break;
          }

          case 'input': {
            const term = (ws as any).pty;
            if (term && typeof data.data === 'string') {
              term.write(data.data);
            }
            break;
          }

          case 'resize': {
            const term = (ws as any).pty;
            if (term && data.cols && data.rows) {
              term.resize(data.cols, data.rows);
            }
            break;
          }

          case 'close': {
            const term = (ws as any).pty;
            if (term) {
              term.kill();
              delete (ws as any).pty;
            }
            ws.close();
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: err instanceof Error ? err.message : 'Unknown error' 
        }));
      }
    },
    
    close(ws: ServerWebSocket<unknown>) {
      console.log('WebSocket client disconnected');
      const term = (ws as any).pty;
      if (term) {
        term.kill();
        delete (ws as any).pty;
      }
    }
  },
  async fetch(req, server): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/' || path === '/ws') {
      if (server.upgrade(req)) {
        return undefined as any;
      }
      return new Response('WebSocket upgrade required', { status: 426 });
    }

    return handleRequest(req, path).catch(err => {
      console.error('HTTP error:', err);
      return new Response(JSON.stringify({ 
        error: err instanceof Error ? err.message : 'Internal server error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  }
});

async function handleRequest(req: Request, path: string): Promise<Response> {
  try {
    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Vault management
    if (path === '/api/vaults' && req.method === 'GET') {
      return new Response(JSON.stringify(vaults), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/vault/open' && req.method === 'POST') {
      const body = await req.json() as { id: string; name: string; path: string };
      try {
        const s = await stat(body.path);
        if (!s.isDirectory()) throw new Error('Not a directory');
      } catch {
        return new Response(JSON.stringify({ error: 'Vault folder not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const existing = vaults.find(v => v.id === body.id);
      if (!existing) {
        vaults.push({ id: body.id, name: body.name, path: normalizePath(body.path) });
      }
      activeVaultId = body.id;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/vault' && req.method === 'POST') {
      // Parse JSON body
      const body = await req.json() as { name: string; path: string };
      const name = body.name;
      const vaultPath = body.path;
      
      // Validate name
      if (!name || !name.trim()) {
        return new Response(JSON.stringify({ error: 'Please enter a vault name' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate path
      if (!vaultPath || !vaultPath.trim()) {
        return new Response(JSON.stringify({ error: 'Please select a folder' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate the parent directory exists
      try {
        const parentStats = await stat(vaultPath);
        if (!parentStats.isDirectory()) {
          throw new Error('Not a directory');
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Selected folder does not exist' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Create the vault folder path
      const fullVaultPath = join(vaultPath, name);
      
      // Check if vault already exists
      try {
        const existingStats = await stat(fullVaultPath);
        if (existingStats.isDirectory()) {
          return new Response(JSON.stringify({ error: 'A vault with this name already exists in this location' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (err) {
        // Folder doesn't exist, which is what we want
      }
      
      // Create the vault folder
      try {
        await mkdir(fullVaultPath, { recursive: false });
      } catch (err) {
        const error = err as Error & { code?: string };
        return new Response(JSON.stringify({ error: `Failed to create vault: ${error.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Create welcome files inside the vault
      const welcomeFiles = [
        {
          name: 'README.md',
          content: `# Welcome to ${name}

Your personal knowledge vault is ready! 🎉

## Getting Started

- **Create a note**: Press \`Ctrl+K\` and type "New Note"
- **Create a folder**: Press \`Ctrl+K\` and type "New Folder"
- **Open terminal**: Press \`Ctrl+K\` and type "Open Terminal"
- **Browse files**: Click the folder icon in the sidebar

## Features

- 📝 Markdown editor with live preview
- 🎨 Drawing canvas with Excalidraw
- 🌐 Built-in browser tab
- 💻 Terminal connected to your vault
- 🔍 Full-text search
- 🌙 Light / Dark theme

## Structure

- \`Daily Notes/\` - Your daily notes
- \`Templates/\` - Reusable note templates

Happy note-taking! ✨
`
        },
        {
          name: 'Getting Started.md',
          content: `# Getting Started with Ibsidian

## First Steps

1. **Create your first note** - Click the + button or use \`Ctrl+N\`
2. **Organize with folders** - Right-click in the sidebar to create folders
3. **Use templates** - Check the \`Templates/\` folder for starting points

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl+K\` | Open command palette |
| \`Ctrl+N\` | Create new note |
| \`Ctrl+S\` | Save current note |
| \`Ctrl+Shift+P\` | Toggle preview mode |

## Tips

- Use \`[[wikilinks]]\` to link between notes
- Add \`tags: [tag1, tag2]\` in YAML frontmatter for tagging
- Use \`!\[\]\(image.png\)\` to embed images

---

*Built with 💜 using React + TypeScript*
`
        },
        {
          name: 'Ideas.md',
          content: `# Ideas

A place to capture your ideas and brainstorm.

## Brainstorming

- [ ] Idea 1
- [ ] Idea 2
- [ ] Idea 3

## Notes

---

*Add your ideas here!*
`
        }
      ];
      
      // Write welcome files
      for (const file of welcomeFiles) {
        try {
          await writeFile(join(fullVaultPath, file.name), file.content, 'utf8');
        } catch (err) {
          console.error(`Failed to create ${file.name}:`, err);
        }
      }
      
      // Create folders with sample content
      const dailyNotesPath = join(fullVaultPath, 'Daily Notes');
      const templatesPath = join(fullVaultPath, 'Templates');
      
      try {
        await mkdir(dailyNotesPath, { recursive: true });
        await mkdir(templatesPath, { recursive: true });
        
        // Sample daily note template
        const today = new Date().toISOString().split('T')[0];
        await writeFile(
          join(dailyNotesPath, `${today}.md`),
          `# ${today}

## Tasks

- [ ] 

## Notes

- 

## Highlights

- 

---

*Created with Ibsidian*
`,
          'utf8'
        );
        
        // Meeting notes template
        await writeFile(
          join(templatesPath, 'Meeting Notes.md'),
          `---
tags: [meeting]
date: {{date}}
participants: []
---

# Meeting Notes - {{title}}

## Attendees

- 

## Agenda

1. 

## Discussion

-

## Action Items

- [ ] 

## Next Steps

- 

---

*Template: Copy this to create new meeting notes*
`,
          'utf8'
        );
        
        // Daily note template
        await writeFile(
          join(templatesPath, 'Daily Note.md'),
          `---
tags: [daily]
date: {{date}}
mood: 
energy: 
---

# {{date}}

## Tasks

- [ ] 

## Gratitude

- 

## Highlights

- 

## Tomorrow

- 

---

*Use this template for daily notes*
`,
          'utf8'
        );
        
      } catch (err) {
        console.error('Failed to create sample folders:', err);
      }
      
      // Create vault entry
      const vault: Vault = {
        id: generateId(),
        name,
        path: normalizePath(fullVaultPath)
      };
      
      vaults.push(vault);
      activeVaultId = vault.id;
      
      return new Response(JSON.stringify(vault), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // File operations (require active vault)
    if (path.startsWith('/api/files') && activeVaultId) {
      const vault = vaults.find(v => v.id === activeVaultId)!;
      const subPath = decodeURIComponent(path.replace(/^\/api\/files\/?/, ''));
      const filePath = subPath ? join(vault.path, subPath) : vault.path;
      
      // Security check
      if (!isPathInVault(vault.path, filePath)) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (req.method === 'GET') {
        // Get file/directory info or list directory
        try {
          const stats = await stat(filePath);

          if (stats.isDirectory()) {
            const readDirRecursive = async (dirPath: string): Promise<any[]> => {
              const entries = await readdir(dirPath, { withFileTypes: true });
              return Promise.all(entries.map(async entry => {
                const fullPath = join(dirPath, entry.name);
                const node: any = {
                  name: entry.name,
                  path: normalizePath(relative(vault.path, fullPath)),
                  isDirectory: entry.isDirectory(),
                };
                if (entry.isDirectory()) {
                  node.children = await readDirRecursive(fullPath);
                }
                return node;
              }));
            };

            const children = await readDirRecursive(filePath);
            return new Response(JSON.stringify({
              name: vault.name,
              path: '',
              isDirectory: true,
              children
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            // File
            const content = await readFile(filePath, 'utf8');
            return new Response(JSON.stringify({ 
              name: vaults.find(v => v.id === activeVaultId)!.name,
              path: normalizePath(relative(vault.path, filePath)),
              isDirectory: false,
              content 
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          } catch (err) {
            const error = err as { code?: string };
            if (error.code === 'ENOENT') {
            return new Response(JSON.stringify({ error: 'File not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          throw err;
        }
      }
      
      if (req.method === 'PUT') {
        // Write file
        const body = await req.json() as { content: string };
        await writeFile(filePath, body.content, 'utf8');
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (req.method === 'POST') {
        // Create file or directory
        const body = await req.json() as { name: string; type: string; path: string; content?: string };
        const name = body.name;
        const type = body.type;
        const filePath = body.path;
        const content = body.content;
        const targetPath = join(vault.path, filePath);
        
        if (type === 'directory') {
          await mkdir(targetPath, { recursive: true });
        } else {
          await writeFile(targetPath, content || '', 'utf8');
        }
        
        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (req.method === 'DELETE') {
        // Delete file or directory
        await rm(filePath, { recursive: true, force: true });
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Not found
    return new Response('Not Found', { status: 404 });
  } catch (err) {
    console.error('HTTP error:', err);
    return new Response(JSON.stringify({ 
      error: err instanceof Error ? err.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

console.log(`Bun server running on http://localhost:${PORT}`);
console.log(`WebSocket endpoint: ws://localhost:${PORT}`);