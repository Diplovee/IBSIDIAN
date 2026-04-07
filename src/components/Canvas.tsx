import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import ReactMarkdown from 'react-markdown';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import {
  Globe, PenLine, SquareTerminal, RefreshCw, ArrowLeft, ArrowRight,
  BookOpen, MoreHorizontal, Link, Code, PanelRight, PanelBottom,
  ExternalLink, Pencil, FolderInput, Bookmark, GitMerge, PlusCircle,
  Download, Search, Copy, History, Link2, ArrowUpRight, FolderOpen,
  Trash2, ChevronRight,
} from 'lucide-react';

// Transparent editor theme — inherits app styles
const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', height: '100%' },
  '.cm-content': { caretColor: 'var(--text-primary)', padding: '0', fontFamily: 'var(--font-sans)', fontSize: '16px', lineHeight: '1.7' },
  '.cm-cursor': { borderLeftColor: 'var(--text-primary)', borderLeftWidth: '2px' },
  '.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(124,58,237,0.12)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(124,58,237,0.15)' },
  '.cm-gutters': { display: 'none' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-sans)' },
});

export const Canvas: React.FC = () => {
  const { activeTabId, tabs } = useTabs();
  const activeTab = tabs.find(t => t.id === activeTabId);

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

  switch (activeTab.type) {
    case 'note': return <EditorTab tab={activeTab} />;
    case 'browser': return <BrowserTab tab={activeTab} />;
    case 'draw': return <DrawTab tab={activeTab} />;
    case 'terminal': return <TerminalTab tab={activeTab} />;
    default: return <div className="flex-1 bg-[var(--bg-primary)]" />;
  }
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
  const { getNodeById, updateFileContent, deleteNode, renameNode } = useVault();
  const { closeTab, updateTabTitle } = useTabs();
  const node = getNodeById(tab.filePath);
  const [content, setContent] = useState(node?.type === 'file' ? node.content : '');
  const [isPreview, setIsPreview] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    if (node?.type === 'file') setContent(node.content);
  }, [node]);

  const handleChange = (value: string) => {
    setContent(value);
    if (node?.id) updateFileContent(node.id, value);
  };

  const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
  const charCount = content.length;
  const title = node?.name || tab.title;

  const handleRename = () => {
    setMenuOpen(false);
    const newName = window.prompt('Rename file:', title);
    if (newName?.trim() && node?.id) {
      renameNode(node.id, newName.trim());
      updateTabTitle(tab.id, newName.trim());
    }
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      if (node?.id) deleteNode(node.id);
      closeTab(tab.id);
    }
  };

  const handleCopyPath = () => {
    setMenuOpen(false);
    navigator.clipboard.writeText(tab.filePath || title).catch(() => {});
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
          <span className="text-[13px] text-[var(--text-secondary)]">{title}</span>
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

          {/* Dropdown menu — matches Image #5 exactly */}
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

      {/* Editor / Preview */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[720px] mx-auto py-16 px-12">
          {isPreview ? (
            <div className="markdown-body">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <CodeMirror
              value={content}
              theme={editorTheme}
              extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
              onChange={handleChange}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                dropCursor: false,
              }}
              style={{ fontFamily: 'var(--font-sans)', fontSize: '16px' }}
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
  const [url, setUrl] = useState(tab.url || 'https://www.google.com');
  const [inputUrl, setInputUrl] = useState(url);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl;
    if (!target.startsWith('http')) target = 'https://' + target;
    setUrl(target);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
      <div className="h-[36px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-3 gap-2">
        <div className="flex items-center gap-0.5">
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><ArrowLeft size={14} /></button>
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><ArrowRight size={14} /></button>
          <button className="w-[26px] h-[26px] flex items-center justify-center rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><RefreshCw size={14} /></button>
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
      <iframe src={url} className="flex-1 border-none" title="Browser" referrerPolicy="no-referrer" />
    </div>
  );
};

// ── Draw tab ─────────────────────────────────────────────────────────

const DrawTab: React.FC<{ tab: any }> = () => {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] relative">
      <iframe src="https://excalidraw.com" className="flex-1 border-none" title="Excalidraw" referrerPolicy="no-referrer" />
    </div>
  );
};

// ── Terminal tab ─────────────────────────────────────────────────────

const TerminalTab: React.FC<{ tab: any }> = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new XTerm({
        theme: { background: '#1a1a1a', foreground: '#ffffff', cursor: '#7c3aed' },
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: 13,
        cursorBlink: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      term.writeln('\x1b[1;35mIbsidian Terminal\x1b[0m');
      term.writeln('Type something to begin...');
      term.write('\r\n$ ');
      term.onData(data => {
        if (data === '\r') { term.write('\r\n$ '); }
        else if (data === '\u007f') { term.write('\b \b'); }
        else { term.write(data); }
      });
      xtermRef.current = term;
      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1a]">
      <div className="h-8 bg-[#2a2a2a] border-b border-[#3a3a3a] flex items-center px-3 gap-2 text-[11px] text-gray-400">
        <SquareTerminal size={12} />
        <span>bash — 80×24</span>
      </div>
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  );
};
