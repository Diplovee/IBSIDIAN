import React, { useState, useEffect, useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { hybridMarkdown } from 'codemirror-markdown-hybrid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { useModal } from './Modal';
import { useActivity } from '../contexts/ActivityContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import {
  Globe, SquareTerminal, RefreshCw, ArrowLeft, ArrowRight,
  MoreHorizontal, Code, PanelRight, PanelBottom,
  ExternalLink, Pencil, FolderInput, Bookmark,
  Download, Search, Copy, History, Link2, ArrowUpRight, FolderOpen,
  Trash2, ChevronRight,
} from 'lucide-react';
import {
  CALL_OUT_STYLES,
  INTERNAL_EMBED_PREFIX,
  INTERNAL_LINK_PREFIX,
  extractMarkdownAnchors,
  getVaultTargets,
  preprocessObsidianMarkdown,
  resolveVaultLink,
} from '../utils/obsidianMarkdown';

const extractText = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) return extractText((node.props as { children?: React.ReactNode }).children);
  return '';
};

const stripCalloutMarker = (node: React.ReactNode, stripped = { value: false }): React.ReactNode => {
  if (typeof node === 'string') {
    if (stripped.value) return node;
    stripped.value = true;
    return node.replace(/^\s*\[!([a-zA-Z-]+)\][+-]?\s*/, '');
  }
  if (typeof node === 'number' || node == null) return node;
  if (Array.isArray(node)) return node.map(child => stripCalloutMarker(child, stripped));
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return React.cloneElement(element, { ...element.props, children: stripCalloutMarker(element.props.children, stripped) });
  }
  return node;
};

const toPlainPreviewText = (content: string) =>
  content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[\[([^[\]]+)\]\]/g, '$1')
    .replace(/!\[\[([^[\]]+)\]\]/g, '$1')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildEmbedExcerpt = (content: string, anchorValue?: string | null, anchorKind?: 'heading' | 'block' | null) => {
  const lines = content.split('\n');
  let startIndex = 0;
  if (anchorValue) {
    const anchors = extractMarkdownAnchors(content);
    const match = anchors.find(anchor => anchor.value.toLowerCase() === anchorValue.toLowerCase() && anchor.kind === (anchorKind ?? anchor.kind));
    if (match) startIndex = Math.max(0, match.line);
  }
  const slice = lines.slice(startIndex, startIndex + 8).join('\n');
  return toPlainPreviewText(slice).slice(0, 220);
};

const normalizeLivePreviewMarkers = (view: EditorView | null) => {
  if (!view) return;
  const markers = view.dom.querySelectorAll('.md-list-marker');
  markers.forEach(marker => {
    const text = marker.textContent?.trim();
    if (text === '-' || text === '*' || text === '+') {
      marker.textContent = '•';
    }
  });
};

const InternalEmbed: React.FC<{ target: string; currentPath?: string | null }> = ({ target, currentPath }) => {
  const { nodes, readFile } = useVault();
  const { openTab } = useTabs();
  const resolved = resolveVaultLink(target, nodes, currentPath);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!resolved) {
      setPreview('');
      return () => {
        cancelled = true;
      };
    }
    if (resolved.type !== 'note') {
      setPreview('');
      return () => {
        cancelled = true;
      };
    }

    readFile(resolved.path)
      .then(text => {
        if (!cancelled) setPreview(buildEmbedExcerpt(text ?? '', resolved.anchor?.value ?? null, resolved.anchor?.kind ?? null));
      })
      .catch(() => {
        if (!cancelled) setPreview('');
      });

    return () => {
      cancelled = true;
    };
  }, [resolved?.path, resolved?.anchor?.value, resolved?.anchor?.kind, resolved?.type, readFile]);

  if (!resolved) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-secondary)', padding: 14, margin: 'var(--space-4) 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Missing embed: {target}
      </div>
    );
  }

  return (
    <button
      onClick={() => openTab({ type: resolved.type, title: resolved.title, filePath: resolved.path })}
      style={{ width: '100%', display: 'block', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-secondary)', padding: 14, margin: 'var(--space-4) 0', textAlign: 'left', cursor: 'pointer' }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        {resolved.type === 'draw' ? 'Drawing' : 'Embed'}: {resolved.title}
        {resolved.anchor && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> {resolved.anchor.label}</span>}
      </div>
      {preview && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{preview}</div>}
      {!preview && resolved.type === 'draw' && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Open embedded drawing</div>}
    </button>
  );
};

const MarkdownPreview: React.FC<{ content: string; currentPath?: string | null }> = ({ content, currentPath }) => {
  const { openTab } = useTabs();
  const { nodes } = useVault();

  const markdownComponents = {
    h1: ({ children }: any) => <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>{children}</h1>,
    h2: ({ children }: any) => <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>{children}</h2>,
    h3: ({ children }: any) => <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginTop: 'var(--space-5)', marginBottom: 'var(--space-2)' }}>{children}</h3>,
    h4: ({ children }: any) => <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>{children}</h4>,
    h5: ({ children }: any) => <h5 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>{children}</h5>,
    h6: ({ children }: any) => <h6 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>{children}</h6>,
    p: ({ children }: any) => <p style={{ marginBottom: 'var(--space-4)' }}>{children}</p>,
    ul: ({ children }: any) => <ul style={{ paddingLeft: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>{children}</ul>,
    ol: ({ children }: any) => <ol style={{ paddingLeft: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>{children}</ol>,
    li: ({ children }: any) => <li style={{ marginBottom: 'var(--space-1)' }}>{children}</li>,
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 'var(--space-6) 0' }} />,
    code: ({ children }: any) => <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '2px 4px', fontSize: '0.9em' }}>{children}</code>,
    blockquote: ({ children }: any) => {
      const items = React.Children.toArray(children);
      const first = items[0];
      const firstText = extractText(first).trim();
      const match = firstText.match(/^\[!([a-zA-Z-]+)\][+-]?\s*(.*)$/);
      if (!match) return <blockquote style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 'var(--space-4)', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 'var(--space-4) 0' }}>{children}</blockquote>;
      const kind = match[1].toLowerCase();
      const title = match[2] || CALL_OUT_STYLES[kind]?.label || `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
      const theme = CALL_OUT_STYLES[kind] || CALL_OUT_STYLES.note;
      const normalizedItems = [...items];
      normalizedItems[0] = stripCalloutMarker(first);
      return (
        <div style={{ margin: 'var(--space-4) 0', borderLeft: `3px solid ${theme.border}`, background: theme.background, borderRadius: 8, padding: '12px 14px 12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 18, height: 18, borderRadius: 9999, background: theme.iconBg, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {title.charAt(0).toUpperCase()}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{title}</span>
          </div>
          <div style={{ color: 'var(--text-primary)' }}>{normalizedItems}</div>
        </div>
      );
    },
    a: ({ children, href }: any) => {
      const url = typeof href === 'string' ? href : '';
      const isInternal = url.startsWith(INTERNAL_LINK_PREFIX);
      if (!isInternal) return <a href={href} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{children}</a>;
      return (
        <button
          onClick={() => {
            const target = decodeURIComponent(url.slice(INTERNAL_LINK_PREFIX.length));
            const resolved = resolveVaultLink(target, nodes, currentPath);
            if (resolved) openTab({ type: resolved.type, title: resolved.title, filePath: resolved.path });
          }}
          style={{ border: 'none', background: 'none', color: 'var(--accent)', padding: 0, cursor: 'pointer', font: 'inherit', textDecoration: 'none' }}
        >
          {children}
        </button>
      );
    },
    img: ({ src, alt }: any) => {
      const url = typeof src === 'string' ? src : '';
      if (!url.startsWith(INTERNAL_EMBED_PREFIX)) {
        return <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: 8, margin: 'var(--space-4) 0' }} />;
      }
      const target = decodeURIComponent(url.slice(INTERNAL_EMBED_PREFIX.length));
      return <InternalEmbed target={target} currentPath={currentPath} />;
    },
    input: ({ type, checked }: any) => {
      if (type !== 'checkbox') return <input type={type} checked={checked} readOnly />;
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          style={{ width: 14, height: 14, marginRight: 8, accentColor: 'var(--accent)', transform: 'translateY(1px)' }}
        />
      );
    },
    table: ({ children }: any) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: 'var(--space-4) 0', fontSize: 'var(--text-sm)' }}>{children}</table>,
    th: ({ children }: any) => <th style={{ border: '1px solid var(--border)', padding: 'var(--space-2) var(--space-3)', textAlign: 'left', background: 'var(--bg-secondary)', fontWeight: 600 }}>{children}</th>,
    td: ({ children }: any) => <td style={{ border: '1px solid var(--border)', padding: 'var(--space-2) var(--space-3)', textAlign: 'left' }}>{children}</td>,
    del: ({ children }: any) => <del style={{ color: 'var(--text-muted)' }}>{children}</del>,
    s: ({ children }: any) => <s style={{ color: 'var(--text-muted)' }}>{children}</s>,
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)', lineHeight: 'var(--leading-relaxed)', color: 'var(--text-primary)' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {preprocessObsidianMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
};

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
  '.cm-selectedLine, .cm-table-line, .cm-math-block-line, .cm-mermaid-block-line': {
    backgroundColor: 'transparent !important',
    color: 'var(--text-primary) !important',
    caretColor: 'var(--text-primary) !important',
    borderRadius: '0 !important',
    fontFamily: 'var(--font-sans) !important',
    fontSize: '16px !important',
  },
  '.cm-code-block-line.cm-selectedLine': {
    backgroundColor: 'var(--bg-secondary) !important',
    color: 'var(--text-primary) !important',
    borderLeft: '3px solid var(--border)',
  },
  '.cm-markdown-preview .md-list-marker': { color: 'var(--text-muted)', marginRight: '6px' },
  '.cm-markdown-preview .md-list-item': { display: 'inline', color: 'var(--text-primary)' },
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
          <div style={{ width: 96, height: 96, background: 'var(--bg-secondary)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, background: 'var(--accent)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700 }}>
              I
            </div>
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Welcome to Ibsidian</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Open a file from the sidebar or create a new one.</p>
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <kbd style={{ padding: '2px 7px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, boxShadow: '0 1px 0 var(--border)', color: 'var(--text-secondary)', lineHeight: '18px' }}>Ctrl</kbd>
            <kbd style={{ padding: '2px 7px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, boxShadow: '0 1px 0 var(--border)', color: 'var(--text-secondary)', lineHeight: '18px' }}>K</kbd>
            <span>Command Palette</span>
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
      default: return <div style={{ flex: 1, background: 'var(--bg-primary)' }} />;
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
  const { createFileRemote, refreshFileTree, nextUntitledName } = useVault();

  const handleNewNote = useCallback(() => {
    const name = nextUntitledName();
    createFileRemote('', name, 'md').then(() => {
      refreshFileTree();
      closeTab(tab.id);
      openTab({ type: 'note', title: name, filePath: `${name}.md` });
    });
  }, [tab.id, closeTab, openTab, createFileRemote, refreshFileTree, nextUntitledName]);

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

const replaceCompletionText = (view: EditorView, from: number, to: number, insert: string, closing: string) => {
  const trailing = view.state.sliceDoc(to, to + closing.length);
  view.dispatch({
    changes: {
      from,
      to,
      insert: trailing === closing ? insert : `${insert}${closing}`,
    },
  });
};

const calloutCompletions: Completion[] = Object.entries(CALL_OUT_STYLES).map(([key, value]) => ({
  label: key,
  detail: value.label,
  type: 'keyword',
}));

// ── Menu helpers ────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  hasArrow?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, disabled, danger, hasArrow }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        textAlign: 'left',
        paddingLeft: 20,
        paddingRight: 16,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
        fontSize: 13,
        border: 'none',
        background: disabled ? 'transparent' : hovered ? (danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-hover)') : 'transparent',
        color: danger ? '#ef4444' : 'var(--text-primary)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ flexShrink: 0, color: danger ? '#ef4444' : 'var(--text-muted)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hasArrow && <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
    </button>
  );
};

const MenuSep: React.FC = () => <div style={{ margin: '4px 0', borderTop: '1px solid var(--border)' }} />;

interface SubMenuProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const SubMenu: React.FC<SubMenuProps> = ({ icon, label, children }) => {
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => { setOpen(true); setHovered(true); }} onMouseLeave={() => { setOpen(false); setHovered(false); }}>
      <button
        style={{ width: '100%', display: 'flex', alignItems: 'center', textAlign: 'left', paddingLeft: 20, paddingRight: 16, paddingTop: 6, paddingBottom: 6, gap: 12, fontSize: 13, border: 'none', background: hovered ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', transition: 'background 0.1s' }}
      >
        <span style={{ flexShrink: 0, color: 'var(--text-muted)' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: '100%', top: 0, marginRight: 4, width: 220, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 50, padding: '4px 0' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── Editor tab ───────────────────────────────────────────────────────

const EditorTab: React.FC<{ tab: any }> = ({ tab }) => {
  const { nodes, getNodeById, updateFileContent, deleteNode, renameNode, renameItem, refreshFileTree, readFile, writeFile, vault } = useVault();
  const { closeTab, updateTabTitle } = useTabs();
  const { confirm, prompt, alert } = useModal();
  const { theme } = useActivity();

  const handleError = useCallback((err: unknown, action: string) => {
    const msg = err instanceof Error ? err.message : String(err);
    const isNotFound = msg.includes('ENOENT') || msg.includes('not found');
    alert({
      title: `Failed to ${action}`,
      message: isNotFound
        ? `The file or folder could not be found. It may have been moved or deleted.\n\n${msg}`
        : msg,
    });
    if (isNotFound) refreshFileTree().catch(() => {});
  }, [alert, refreshFileTree]);
  const node = getNodeById(tab.filePath);

  const stripExt = (name: string) =>
    name.endsWith('.md') ? name.slice(0, -3)
    : name.endsWith('.excalidraw') ? name.slice(0, -11)
    : name;
  const addExt = (name: string, original: string) => {
    if (original.endsWith('.md') && !name.endsWith('.md')) return `${name}.md`;
    if (original.endsWith('.excalidraw') && !name.endsWith('.excalidraw')) return `${name}.excalidraw`;
    return name;
  };

  const [content, setContent] = useState<string>('');
  const [titleValue, setTitleValue] = useState(stripExt(node?.name || tab.title));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const anchorCacheRef = useRef(new Map<string, ReturnType<typeof extractMarkdownAnchors>>());

  // Sync title if node name changes externally
  useEffect(() => {
    if (node?.name) setTitleValue(stripExt(node.name));
  }, [node?.name]);

  useEffect(() => {
    anchorCacheRef.current.clear();
  }, [nodes]);

  // Auto-select title on new empty note
  useEffect(() => {
    if (content === '' && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [tab.filePath]);

  // Load content from backend when tab opens
  useEffect(() => {
    const nodeContent = (node as any)?.content;
    if (typeof nodeContent === 'string') {
      setContent(nodeContent);
    } else if (vault && tab.filePath) {
      readFile(tab.filePath)
        .then(text => setContent(text ?? ''))
        .catch(err => handleError(err, 'read file'));
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => normalizeLivePreviewMarkers(editorViewRef.current));
    return () => cancelAnimationFrame(frame);
  }, [content]);

  const handleChange = (value: string) => {
    setContent(value);
    if (node?.id) updateFileContent(node.id, value);
    if (vault && tab.filePath) writeFile(tab.filePath, value).catch(err => handleError(err, 'save file'));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitleValue(e.target.value);
  };

  const handleTitleBlur = () => {
    const newDisplay = titleValue.trim();
    const originalName = node?.name || tab.title;
    if (!newDisplay) { setTitleValue(stripExt(originalName)); return; }
    const newName = addExt(newDisplay, originalName);
    if (newName !== originalName) {
      if (node?.id) renameNode(node.id, newName);
      updateTabTitle(tab.id, newDisplay);
      if (tab.filePath) renameItem(tab.filePath, newName).then(() => refreshFileTree()).catch(err => handleError(err, 'rename file'));
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
  const rawTitle = node?.name || tab.title;
  const title = stripExt(rawTitle);

  const handleRename = () => {
    setMenuOpen(false);
    prompt({ title: 'Rename file', defaultValue: title, placeholder: 'File name', confirmLabel: 'Rename' }).then(n => {
      if (n) {
        const newName = addExt(n, rawTitle);
        if (node?.id) renameNode(node.id, newName);
        updateTabTitle(tab.id, n);
        setTitleValue(n);
        if (tab.filePath) renameItem(tab.filePath, newName).then(() => refreshFileTree()).catch(err => handleError(err, 'rename file'));
      }
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

  const loadAnchorsForPath = useCallback(async (path: string) => {
    if (path === tab.filePath) return extractMarkdownAnchors(content);
    const cached = anchorCacheRef.current.get(path);
    if (cached) return cached;
    const targetNode = getNodeById(path);
    const nodeContent = typeof targetNode?.content === 'string' ? targetNode.content : '';
    const text = nodeContent || await readFile(path).catch(() => '');
    const anchors = extractMarkdownAnchors(text ?? '');
    anchorCacheRef.current.set(path, anchors);
    return anchors;
  }, [content, getNodeById, readFile, tab.filePath]);

  const obsidianCompletionSource = useCallback(async (context: CompletionContext) => {
    const calloutMatch = context.matchBefore(/>\s*\[![a-z-]*$/i);
    if (calloutMatch) {
      const query = calloutMatch.text.slice(calloutMatch.text.lastIndexOf('[!') + 2).toLowerCase();
      return {
        from: context.pos - query.length,
        options: calloutCompletions
          .filter(option => option.label.startsWith(query))
          .map(option => ({
            ...option,
            apply: (view: EditorView, completion: Completion, from: number, to: number) => {
              replaceCompletionText(view, from, to, String(completion.label), '] ');
            },
          })),
        validFor: /^[a-z-]*$/i,
      };
    }

    const linkMatch = context.matchBefore(/!?\[\[[^[\]\n]*$/);
    if (!linkMatch) return null;

    const isEmbed = linkMatch.text.startsWith('![[') || linkMatch.text.startsWith('![[', 0);
    const query = linkMatch.text.slice(isEmbed ? 3 : 2);
    const from = linkMatch.from + (isEmbed ? 3 : 2);
    const targets = getVaultTargets(nodes);
    const hashIndex = query.indexOf('#');

    if (hashIndex >= 0) {
      const targetQuery = query.slice(0, hashIndex);
      const anchorQuery = query.slice(hashIndex + 1).replace(/^\^/, '').toLowerCase();
      const resolved = targetQuery
        ? resolveVaultLink(targetQuery, nodes, tab.filePath)
        : resolveVaultLink('', nodes, tab.filePath);
      if (!resolved || resolved.type !== 'note') return null;
      const anchors = await loadAnchorsForPath(resolved.path);
      const filtered = anchors.filter(anchor => anchor.value.toLowerCase().includes(anchorQuery));
      return {
        from,
        options: filtered.map(anchor => ({
          label: `${targetQuery}${anchor.kind === 'block' ? '#^' : '#'}${anchor.value}`,
          detail: anchor.kind === 'block' ? 'block' : 'heading',
          type: anchor.kind === 'block' ? 'constant' : 'property',
          apply: (view: EditorView, _completion: Completion, replaceFrom: number, replaceTo: number) => {
            const base = targetQuery ? `${targetQuery}${anchor.kind === 'block' ? '#^' : '#'}${anchor.value}` : `${anchor.kind === 'block' ? '#^' : '#'}${anchor.value}`;
            replaceCompletionText(view, replaceFrom, replaceTo, base, ']]');
          },
        })),
        validFor: /^[^|\]]*$/i,
      };
    }

    if (!query && !context.explicit) return null;
    const lowered = query.toLowerCase();
    const filtered = targets.filter(target =>
      target.title.toLowerCase().includes(lowered) ||
      target.path.toLowerCase().includes(lowered) ||
      target.name.toLowerCase().includes(lowered),
    );
    return {
      from,
      options: filtered.map(target => ({
        label: target.title,
        detail: target.path,
        type: target.type === 'draw' ? 'class' : 'file',
        apply: (view: EditorView, _completion: Completion, replaceFrom: number, replaceTo: number) => {
          replaceCompletionText(view, replaceFrom, replaceTo, target.title, ']]');
        },
      })),
      validFor: /^[^#|\]]*$/i,
    };
  }, [content, loadAnchorsForPath, nodes, tab.filePath]);

  const liveMarkdownExtensions = [
    hybridMarkdown({ theme }),
    autocompletion({ override: [obsidianCompletionSource] }),
    EditorView.lineWrapping,
  ];

  // Click on scroll area outside editor → focus editor
  const handleScrollAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === scrollAreaRef.current || (e.target as HTMLElement).closest('[data-editor-content-inner="true"]') === null) {
      if (editorViewRef.current) editorViewRef.current.focus();
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Obsidian-style editor toolbar */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 8 }}>
        {/* Back / Forward */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <ArrowLeft size={14} />
          </button>
          <button style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Title */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{titleValue}</span>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }} ref={menuRef}>
          {/* More options */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
          >
            <MoreHorizontal size={14} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 32, marginTop: 4, width: 264, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 50, padding: '4px 0' }}>
              <MenuItem icon={<Pencil size={14} />} label="Rename..." onClick={handleRename} />
              <MenuItem icon={<FolderInput size={14} />} label="Move file to..." disabled />
              <MenuItem icon={<Bookmark size={14} />} label="Bookmark..." disabled />
              <MenuItem icon={<Download size={14} />} label="Export to PDF..." disabled />
              <MenuSep />
              <MenuItem icon={<Search size={14} />} label="Find..." disabled />
              <MenuItem icon={<Search size={14} />} label="Replace..." disabled />
              <MenuSep />
              <MenuItem icon={<Copy size={14} />} label="Copy path" onClick={handleCopyPath} hasArrow />
              <MenuSep />
              <SubMenu icon={<ExternalLink size={14} />} label="Open">
                <MenuItem icon={<PanelRight size={14} />} label="Split right" disabled />
                <MenuItem icon={<PanelBottom size={14} />} label="Split down" disabled />
                <MenuItem icon={<ExternalLink size={14} />} label="Open in new window" disabled />
                <MenuSep />
                <MenuItem icon={<ArrowUpRight size={14} />} label="Open in default app" disabled />
                <MenuItem icon={<ArrowUpRight size={14} />} label="Show in system explorer" disabled />
                <MenuItem icon={<FolderOpen size={14} />} label="Reveal file in navigation" disabled />
              </SubMenu>
              <SubMenu icon={<History size={14} />} label="History">
                <MenuItem icon={<History size={14} />} label="Open version history" disabled />
                <MenuItem icon={<Link2 size={14} />} label="Open linked view" disabled hasArrow />
              </SubMenu>
              <MenuSep />
              <MenuItem icon={<Trash2 size={14} />} label="Delete file" onClick={handleDelete} danger />
            </div>
          )}
        </div>
      </div>

      {/* Auto live preview editor */}
      <div ref={scrollAreaRef} style={{ flex: 1, overflow: 'hidden' }} onClick={handleScrollAreaClick}>
        <div style={{ height: '100%', overflow: 'auto', padding: '32px 48px 80px' }}>
          <div data-editor-content-inner="true" style={{ maxWidth: 720, margin: '0 auto' }}>
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
            <CodeMirror
              value={content}
              theme={editorTheme}
              extensions={liveMarkdownExtensions}
              onChange={handleChange}
              onCreateEditor={(view) => {
                editorViewRef.current = view;
                requestAnimationFrame(() => normalizeLivePreviewMarkers(view));
              }}
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
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ height: 24, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px', gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wordCount} words</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{charCount} characters</span>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <div style={{ height: 36, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => webviewRef.current?.goBack()}><ArrowLeft size={14} /></button>
          <button style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => webviewRef.current?.goForward()}><ArrowRight size={14} /></button>
          <button style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => webviewRef.current?.reload()}><RefreshCw size={14} /></button>
        </div>
        <form onSubmit={handleNavigate} style={{ flex: 1 }}>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 9999, padding: '2px 16px', fontSize: 12, color: 'var(--text-primary)', transition: 'border-color 0.15s' }}
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative' }}>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <div style={{ height: 32, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <SquareTerminal size={12} />
        <span>bash — {cols}×{rows}</span>
      </div>
      <div ref={terminalRef} style={{ flex: 1, padding: 8 }} />
    </div>
  );
};
