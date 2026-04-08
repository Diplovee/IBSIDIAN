import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import ReactMarkdown from 'react-markdown';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { useModal } from './Modal';
import { useActivity } from '../contexts/ActivityContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import {
  Globe, SquareTerminal, RefreshCw, ArrowLeft, ArrowRight,
  BookOpen, MoreHorizontal, Link, Code, PanelRight, PanelBottom,
  ExternalLink, Pencil, FolderInput, Bookmark, GitMerge, PlusCircle,
  Download, Search, Copy, History, Link2, ArrowUpRight, FolderOpen,
  Trash2, ChevronRight,
} from 'lucide-react';

// Clean Obsidian-style editor theme
const editorTheme = EditorView.theme({
  // Root — no border, no outline, transparent bg, full width
  '&': { backgroundColor: 'transparent', border: 'none', outline: 'none', width: '100%' },
  '&.cm-focused': { outline: 'none !important', border: 'none' },
  // Editor element itself
  '.cm-editor': { border: 'none', outline: 'none' },
  // Content area
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    padding: '0',
    fontFamily: 'var(--font-sans)',
    fontSize: '16px',
    lineHeight: '1.75',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text-primary)', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(124,58,237,0.12) !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(124,58,237,0.15) !important' },
  '.cm-gutters': { display: 'none' },
  // Scroller fills available space
  '.cm-scroller': { fontFamily: 'var(--font-sans)', overflow: 'visible' },
  // Line wrapper
  '.cm-line': { padding: '0' },
});

export const Canvas: React.FC = () => {
  const { activeTabId, tabs } = useTabs();
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Always render all terminal tabs so PTY sessions survive tab switches.
  // Only unmount when the tab is closed (removed from tabs array).
  const terminalTabs = tabs.filter(t => t.type === 'terminal');

  const renderActiveTab = () => {
    if (!activeTab) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
          <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-xl flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-[var(--accent)] rounded-sm flex items-center justify-center text-white text-2xl font-bold">
              I
            </div>
          </div>
          <h2 className="text-[var(--text-xl)] font-bold text-[var(--text-primary)] mb-2">Welcome to Ibsidian</h2>
          <p className="text-[var(--text-sm)] text-[var(--text-muted)]">Open a file from the sidebar or create a new one.</p>
          <div className="mt-6 flex gap-4 text-[var(--text-xs)]">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-secondary)]">Ctrl</kbd>
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-secondary)]">K</kbd>
              <span className="text-[var(--text-secondary)]">Command Palette</span>
            </div>
          </div>
        </div>
      );
    }
    // Terminal tabs are rendered persistently below; hide this slot when active tab is terminal
    if (activeTab.type === 'terminal') return null;
    switch (activeTab.type) {
      case 'note': return <EditorTab tab={activeTab} />;
      case 'browser': return <BrowserTab tab={activeTab} />;
      case 'draw': return <DrawTab tab={activeTab} />;
      case 'new-tab': return <NewTabScreen tab={activeTab} />;
      default: return <div className="flex-1 bg-[var(--bg-primary)]" />;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Always-mounted terminal tabs — hidden when not active */}
      {terminalTabs.map(t => (
        <div
          key={t.id}
          style={{
            display: activeTab?.id === t.id ? 'flex' : 'none',
            flex: 1,
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <TerminalTab tab={t} />
        </div>
      ))}
      {/* Non-terminal active tab */}
      {activeTab?.type !== 'terminal' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderActiveTab()}
        </div>
      )}
    </div>
  );
};

// ── New tab screen ───────────────────────────────────────────────────

const NewTabScreen: React.FC<{ tab: any }> = ({ tab }) => {
  const { closeTab, openTab } = useTabs();
  const { createFile, nextUntitledName } = useVault();

  const handleNewNote = useCallback(() => {
    const name = nextUntitledName();
    const id = createFile(null, name, 'md');
    // Replace current new-tab with the note tab
    closeTab(tab.id);
    openTab({ type: 'note', title: name, filePath: id });
  }, [tab.id, closeTab, openTab, createFile, nextUntitledName]);

  const LinkBtn: React.FC<{ label: string; shortcut?: string; onClick: () => void }> = ({ label, shortcut, onClick }) => {
    const [h, setH] = useState(false);
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: h ? 'var(--accent-soft)' : 'transparent',
          color: 'var(--accent)', fontSize: 14, fontWeight: 500,
          transition: 'background 0.1s', width: '100%', maxWidth: 320,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {shortcut && (
          <kbd style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, fontFamily: 'var(--font-mono, monospace)' }}>
            {shortcut}
          </kbd>
        )}
      </button>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>I</span>
        </div>
        <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>New tab</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', maxWidth: 320 }}>
        <LinkBtn label="Create new note" shortcut="Ctrl+N" onClick={handleNewNote} />
        <LinkBtn label="Go to file" shortcut="Ctrl+O" onClick={() => {}} />
        <div style={{ height: 8 }} />
        <LinkBtn label="Close tab" onClick={() => closeTab(tab.id)} />
      </div>
    </div>
  );
};

// ── Menu helpers ────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  hasArrow?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, disabled, danger, hasArrow }) => (
  <button
    onClick={!disabled ? onClick : undefined}
    style={{ paddingLeft: 20, paddingRight: 16, paddingTop: 6, paddingBottom: 6, gap: 12 }}
    className={`w-full flex items-center text-[13px] transition-colors text-left ${
      disabled
        ? 'opacity-40 cursor-default'
        : danger
        ? 'text-red-500 hover:bg-red-50'
        : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
    }`}
  >
    <span style={{ flexShrink: 0 }} className={danger ? 'text-red-500' : 'text-[var(--text-muted)]'}>{icon}</span>
    <span style={{ flex: 1 }}>{label}</span>
    {hasArrow && <ChevronRight size={12} className="text-[var(--text-muted)]" style={{ flexShrink: 0 }} />}
  </button>
);

const MenuSep: React.FC = () => <div className="my-1 border-t border-[var(--border)]" />;

// ── Editor tab ───────────────────────────────────────────────────────

const EditorTab: React.FC<{ tab: any }> = ({ tab }) => {
  const { getNodeById, updateFileContent, deleteNode, renameNode, readFile, writeFile, vault } = useVault();
  const { closeTab, updateTabTitle } = useTabs();
  const { confirm, prompt } = useModal();
  const node = getNodeById(tab.filePath);
  const [content, setContent] = useState<string>('');
  const [titleValue, setTitleValue] = useState(node?.name || tab.title);
  const [isPreview, setIsPreview] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load content from backend when tab opens
  useEffect(() => {
    const nodeContent = (node as any)?.content;
    if (typeof nodeContent === 'string') {
      setContent(nodeContent);
    } else if (vault && tab.filePath) {
      readFile(tab.filePath)
        .then(text => setContent(text ?? ''))
        .catch(() => {});
    }
  }, [tab.filePath, vault]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleChange = (value: string) => {
    setContent(value);
    if (node?.id) updateFileContent(node.id, value);
    if (vault && tab.filePath) writeFile(tab.filePath, value).catch(() => {});
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitleValue(e.target.value);
  };

  const handleTitleBlur = () => {
    const newName = titleValue.trim();
    if (newName && newName !== (node?.name || tab.title)) {
      if (node?.id) renameNode(node.id, newName);
      updateTabTitle(tab.id, newName);
    } else if (!newName) {
      setTitleValue(node?.name || tab.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      // Move focus to editor
      if (editorViewRef.current) editorViewRef.current.focus();
    }
  };

  const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
  const charCount = content.length;
  const title = node?.name || tab.title;

  const handleRename = () => {
    setMenuOpen(false);
    prompt({ title: 'Rename file', defaultValue: title, placeholder: 'File name', confirmLabel: 'Rename' }).then(n => {
      if (n && node?.id) { renameNode(node.id, n); updateTabTitle(tab.id, n); setTitleValue(n); }
    });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    confirm({ title: `Delete "${title}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then(ok => {
      if (ok) { if (node?.id) deleteNode(node.id); closeTab(tab.id); }
    });
  };

  const handleCopyPath = () => {
    setMenuOpen(false);
    navigator.clipboard.writeText(tab.filePath || title).catch(() => {});
  };

  // Click on scroll area outside editor → focus editor
  const handleScrollAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === scrollAreaRef.current || (e.target as HTMLElement).closest('.editor-content-inner') === null) {
      if (editorViewRef.current) editorViewRef.current.focus();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* Obsidian-style editor toolbar */}
      <div className="h-[36px] flex items-center px-3 border-b border-[var(--border)] shrink-0 gap-2">
        {/* Back / Forward */}
        <div className="flex items-center gap-0.5">
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft size={14} />
          </button>
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Title */}
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          <span className="text-[13px] text-[var(--text-secondary)]">{titleValue}</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-0.5 relative" ref={menuRef}>
          {/* Reading view toggle */}
          <button
            onClick={() => setIsPreview(v => !v)}
            title={isPreview ? 'Switch to editing (Super+Alt+,)' : 'Reading view'}
            className={`w-[26px] h-[26px] flex items-center justify-center rounded-sm transition-colors ${
              isPreview
                ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BookOpen size={14} />
          </button>

          {/* More options */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-[264px] bg-[var(--bg-primary)] border border-[var(--border)] rounded shadow-[var(--shadow-md)] z-50 py-1">
              <MenuItem icon={<Link size={14} />} label="Backlinks in document" disabled />
              <MenuItem icon={<BookOpen size={14} />} label="Reading view" onClick={() => { setIsPreview(true); setMenuOpen(false); }} />
              <MenuItem icon={<Code size={14} />} label="Source mode" onClick={() => { setIsPreview(false); setMenuOpen(false); }} />
              <MenuSep />
              <MenuItem icon={<PanelRight size={14} />} label="Split right" disabled />
              <MenuItem icon={<PanelBottom size={14} />} label="Split down" disabled />
              <MenuItem icon={<ExternalLink size={14} />} label="Open in new window" disabled />
              <MenuSep />
              <MenuItem icon={<Pencil size={14} />} label="Rename..." onClick={handleRename} />
              <MenuItem icon={<FolderInput size={14} />} label="Move file to..." disabled />
              <MenuItem icon={<Bookmark size={14} />} label="Bookmark..." disabled />
              <MenuItem icon={<GitMerge size={14} />} label="Merge entire file with..." disabled />
              <MenuItem icon={<PlusCircle size={14} />} label="Add file property" disabled />
              <MenuItem icon={<Download size={14} />} label="Export to PDF..." disabled />
              <MenuSep />
              <MenuItem icon={<Search size={14} />} label="Find..." disabled />
              <MenuItem icon={<Search size={14} />} label="Replace..." disabled />
              <MenuSep />
              <MenuItem icon={<Copy size={14} />} label="Copy path" onClick={handleCopyPath} hasArrow />
              <MenuSep />
              <MenuItem icon={<History size={14} />} label="Open version history" disabled />
              <MenuItem icon={<Link2 size={14} />} label="Open linked view" disabled hasArrow />
              <MenuSep />
              <MenuItem icon={<ArrowUpRight size={14} />} label="Open in default app" disabled />
              <MenuItem icon={<ArrowUpRight size={14} />} label="Show in system explorer" disabled />
              <MenuItem icon={<FolderOpen size={14} />} label="Reveal file in navigation" disabled />
              <MenuSep />
              <MenuItem icon={<Trash2 size={14} />} label="Delete file" onClick={handleDelete} danger />
            </div>
          )}
        </div>
      </div>

      {/* Editor / Preview — click outside CodeMirror to still focus it */}
      <div ref={scrollAreaRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} onClick={handleScrollAreaClick}>
        <div className="editor-content-inner" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 48px 80px' }}>
          {/* Inline title */}
          {!isPreview && (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              spellCheck={false}
              style={{
                display: 'block', width: '100%', border: 'none', outline: 'none',
                background: 'transparent', padding: 0, marginBottom: 24,
                fontSize: 32, fontWeight: 700, lineHeight: 1.25,
                color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
                caretColor: 'var(--text-primary)',
              }}
              placeholder="Untitled"
            />
          )}
          {isPreview ? (
            <div className="markdown-body">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <CodeMirror
              value={content}
              theme={editorTheme}
              extensions={[
                markdown({ base: markdownLanguage, codeLanguages: languages }),
                EditorView.lineWrapping,
              ]}
              onChange={handleChange}
              onCreateEditor={(view) => { editorViewRef.current = view; }}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                dropCursor: false,
                rectangularSelection: false,
              }}
              style={{ width: '100%', fontSize: '16px', fontFamily: 'var(--font-sans)' }}
            />
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 border-t border-[var(--border)] flex items-center justify-end px-4 gap-4 shrink-0">
        <span className="text-[11px] text-[var(--text-muted)]">{wordCount} words</span>
        <span className="text-[11px] text-[var(--text-muted)]">{charCount} characters</span>
      </div>
    </div>
  );
};

// ── Browser tab ──────────────────────────────────────────────────────

const BrowserTab: React.FC<{ tab: any }> = ({ tab }) => {
  const webviewRef = useRef<any>(null);
  const [inputUrl, setInputUrl] = useState(tab.url || 'https://www.google.com');
  const [currentUrl, setCurrentUrl] = useState(tab.url || 'https://www.google.com');

  const navigate = (target: string) => {
    if (!target.startsWith('http')) target = 'https://' + target;
    setCurrentUrl(target);
    setInputUrl(target);
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(inputUrl);
  };

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const onNav = (e: any) => setInputUrl(e.url);
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    return () => {
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
      <div className="h-[36px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-3 gap-2">
        <div className="flex items-center gap-0.5">
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)]" onClick={() => webviewRef.current?.goBack()}><ArrowLeft size={14} /></button>
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)]" onClick={() => webviewRef.current?.goForward()}><ArrowRight size={14} /></button>
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)]" onClick={() => webviewRef.current?.reload()}><RefreshCw size={14} /></button>
        </div>
        <form onSubmit={handleNavigate} className="flex-1">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-full px-4 py-0.5 text-[12px] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </form>
      </div>
      {/* @ts-ignore - webview is an Electron-specific tag */}
      <webview ref={webviewRef} src={currentUrl} style={{ flex: 1, border: 'none' }} />
    </div>
  );
};

// ── Draw tab ─────────────────────────────────────────────────────────

const DrawTab: React.FC<{ tab: any }> = () => {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] relative">
      {/* @ts-ignore */}
      <webview src="https://excalidraw.com" style={{ flex: 1, border: 'none' }} />
    </div>
  );
};

// ── Terminal tab ─────────────────────────────────────────────────────

const TerminalTab: React.FC<{ tab: any }> = ({ tab }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const { theme } = useActivity();
  const { activeTabId } = useTabs();
  const [cols, setCols] = useState(80);
  const [rows, setRows] = useState(24);

  const xtermTheme = {
    light: { background: '#ffffff', foreground: '#2e3338', cursor: '#7c3aed' },
    dark:  { background: '#1e1e1e', foreground: '#dcddde', cursor: '#7c3aed' },
  };

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      theme: xtermTheme[theme],
      fontFamily: '"JetBrainsMono Nerd Font", "JetBrainsMono NF", "JetBrains Mono", "FiraCode Nerd Font", "FiraCode NF", "Fira Code", "Hack Nerd Font", "Hack NF", "MesloLGS NF", "Noto Color Emoji", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    setCols(term.cols);
    setRows(term.rows);

    // Create PTY session via IPC
    window.api.terminal.create(term.cols, term.rows).then(sessionId => {
      sessionIdRef.current = sessionId;
    });

    // Forward output from main process to xterm
    const offData = window.api.terminal.onData((sid, data) => {
      if (sid === sessionIdRef.current) term.write(data);
    });

    const offExit = window.api.terminal.onExit(sid => {
      if (sid === sessionIdRef.current) {
        term.writeln('\r\n\x1b[2mProcess exited\x1b[0m');
        sessionIdRef.current = null;
      }
    });

    // Forward keystrokes to PTY
    term.onData(data => {
      if (sessionIdRef.current) window.api.terminal.input(sessionIdRef.current, data);
    });

    // Resize PTY when xterm resizes
    term.onResize(({ cols, rows }) => {
      setCols(cols);
      setRows(rows);
      if (sessionIdRef.current) window.api.terminal.resize(sessionIdRef.current, cols, rows);
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      offData();
      offExit();
      if (sessionIdRef.current) {
        window.api.terminal.close(sessionIdRef.current);
        sessionIdRef.current = null;
      }
      term.dispose();
      xtermRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (xtermRef.current) xtermRef.current.options.theme = xtermTheme[theme];
  }, [theme]);

  // Re-fit when this tab becomes visible after being hidden
  useEffect(() => {
    if (activeTabId === tab.id && fitAddonRef.current) {
      // Use rAF so the div has finished re-displaying before we measure
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    }
  }, [activeTabId, tab.id]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
      <div className="h-8 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-3 gap-2 text-[11px] text-[var(--text-muted)]">
        <SquareTerminal size={12} />
        <span>bash — {cols}×{rows}</span>
      </div>
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  );
};
