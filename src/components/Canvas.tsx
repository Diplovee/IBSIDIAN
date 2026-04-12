import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown';
import { RangeSetBuilder } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { Decoration, type DecorationSet, ViewPlugin, WidgetType } from '@codemirror/view';
import { hybridMarkdown } from 'codemirror-markdown-hybrid';
import ReactMarkdown from 'react-markdown';
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useModal } from './Modal';
import { useActivity } from '../contexts/ActivityContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ClaudeIcon, CodexIcon, PiIcon } from './AgentIcons';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { PaneTabBar } from './PaneTabBar';
import { EditorContextMenu } from './EditorContextMenu';
import {
  Globe, SquareTerminal, RefreshCw, ArrowLeft, ArrowRight,
  MoreHorizontal, Code, PanelRight, PanelBottom, PanelLeft,
  ExternalLink, Pencil, FolderInput, Bookmark,
  Download, Search, Copy, History, Link2, ArrowUpRight, FolderOpen,
  Trash2, ChevronRight, X,
} from 'lucide-react';
import {
  CALL_OUT_STYLES,
  INTERNAL_EMBED_PREFIX,
  INTERNAL_LINK_PREFIX,
  extractMarkdownAnchors,
  getVaultTargets,
  preprocessObsidianMarkdown,
  resolveVaultEmbed,
  resolveVaultLink,
} from '../utils/obsidianMarkdown';
import {
  buildTimestampedImageName,
  ensureUniqueVaultPath,
  isImagePath,
  listVaultFilePaths,
  resolveAttachmentDestination,
} from '../utils/attachments';
import type { ExcalidrawSceneFile, Tab } from '../types';
import { parseExcalidrawFileContent } from '../utils/excalidraw';
import { isGroupableTab, promptCreateGroupFromTab } from '../utils/tabGrouping';

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
  const resolved = resolveVaultEmbed(target, nodes, currentPath);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!resolved) {
      setPreview('');
      return () => {
        cancelled = true;
      };
    }
    if (resolved.type === 'image') {
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

  if (resolved.type === 'image') {
    return <VaultImage src={resolved.path} alt={resolved.title} />;
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
    p: ({ children }: any) => <p style={{ marginBottom: 'var(--space-4)', whiteSpace: 'normal' }}>{children}</p>,
    br: () => <br />,
    ul: ({ children }: any) => <ul style={{ paddingLeft: 'var(--space-6)', marginBottom: 'var(--space-4)', listStyle: 'disc' }}>{children}</ul>,
    ol: ({ children }: any) => <ol style={{ paddingLeft: 'var(--space-6)', marginBottom: 'var(--space-4)', listStyle: 'decimal' }}>{children}</ol>,
    li: ({ children }: any) => <li style={{ marginBottom: 'var(--space-1)', paddingLeft: 2 }}>{children}</li>,
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 'var(--space-6) 0' }} />,
    code: ({ className, children }: any) => {
      // Fenced code blocks always have a trailing \n added by remark;
      // inline code never does. Also catch languaged blocks via className.
      const isBlock =
        (typeof className === 'string' && className.includes('language-')) ||
        String(children).endsWith('\n');
      if (isBlock) {
        return (
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'transparent', padding: 0 }}>
            {children}
          </code>
        );
      }
      return <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '2px 4px', fontSize: '0.9em' }}>{children}</code>;
    },
    pre: ({ children }: any) => (
      <pre style={{ margin: 'var(--space-4) 0', padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7 }}>
        {children}
      </pre>
    ),
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
      normalizedItems[0] = stripCalloutMarker(first) as Exclude<React.ReactNode, boolean | null | undefined>;
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
    strong: ({ children }: any) => <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{children}</strong>,
    em: ({ children }: any) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
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
        return <VaultImage src={url} alt={alt} currentPath={currentPath} />;
      }
      const target = decodeURIComponent(url.slice(INTERNAL_EMBED_PREFIX.length));
      return <InternalEmbed target={target} currentPath={currentPath} />;
    },
    div: ({ children }: any) => <div style={{ marginBottom: 'var(--space-4)' }}>{children}</div>,
    span: ({ children }: any) => <span>{children}</span>,
    table: ({ children }: any) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: 'var(--space-4) 0', fontSize: 'var(--text-sm)' }}>{children}</table>,
    thead: ({ children }: any) => <thead>{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => <tr>{children}</tr>,
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
    th: ({ children }: any) => <th style={{ border: '1px solid var(--border)', padding: 'var(--space-2) var(--space-3)', textAlign: 'left', background: 'var(--bg-secondary)', fontWeight: 600 }}>{children}</th>,
    td: ({ children }: any) => <td style={{ border: '1px solid var(--border)', padding: 'var(--space-2) var(--space-3)', textAlign: 'left' }}>{children}</td>,
    del: ({ children }: any) => <del style={{ color: 'var(--text-muted)' }}>{children}</del>,
    s: ({ children }: any) => <s style={{ color: 'var(--text-muted)' }}>{children}</s>,
    kbd: ({ children }: any) => <kbd style={{ padding: '2px 6px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6 }}>{children}</kbd>,
    mark: ({ children }: any) => <mark style={{ background: 'rgba(255,210,0,0.35)', color: 'inherit', borderRadius: 2, padding: '0 2px' }}>{children}</mark>,
    sup: ({ children }: any) => <sup>{children}</sup>,
    sub: ({ children }: any) => <sub>{children}</sub>,
    section: ({ children }: any) => <section style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{children}</section>,
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)', lineHeight: 'var(--leading-relaxed)', color: 'var(--text-primary)' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]} components={markdownComponents}>
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
  '.cm-link': { color: 'var(--accent)' },
  '.cm-url': { color: 'var(--accent)', textDecoration: 'underline' },
  // Scroller fills available space
  '.cm-scroller': { fontFamily: 'var(--font-sans)', overflow: 'visible' },
  // Line wrapper
  '.cm-line': { padding: '0' },
});

export const Canvas: React.FC = () => {
  const {
    activeTabId,
    tabs,
    panes,
    paneSizes,
    splitDirection,
    activePaneId,
    setActivePane,
    setActiveTabId,
    openTab,
    closeTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeOtherTabs,
    closeAllTabs,
    reorderTabs,
    moveTabToPane,
    moveTabToPaneAt,
    moveTabToGroup,
    createBrowserGroup,
    getBrowserGroup,
    updateBrowserGroup,
    deleteBrowserGroup,
    duplicateBrowserGroup,
    closeBrowserGroup,
    toggleBrowserGroupCollapsed,
    splitRight,
    splitDown,
    closePane,
    setPaneSizes,
  } = useTabs();
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [stackTabCtxMenu, setStackTabCtxMenu] = useState<{ x: number; y: number; tabId: string; paneId: string } | null>(null);
  const { prompt: promptModal } = useModal();

  const browserTabs = tabs.filter(t => t.type === 'browser');
  const terminalTabs = tabs.filter(t => t.type === 'terminal' || t.type === 'claude' || t.type === 'codex' || t.type === 'pi');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '\\') {
          e.preventDefault();
          splitRight();
        } else if (e.key === 'w' && !e.shiftKey) {
          e.preventDefault();
          if (activePaneId !== 'main') closePane(activePaneId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splitRight, closePane, activePaneId]);

  useEffect(() => {
    if (!stackTabCtxMenu) return;
    const close = () => setStackTabCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [stackTabCtxMenu]);

  const renderPane = (paneId: string) => {
    const pane = panes.find(p => p.id === paneId);
    const activeTab = pane?.activeTabId ? tabs.find(t => t.id === pane.activeTabId) : null;

    const isActive = paneId === activePaneId;

    return (
      <div
        key={paneId}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}
        onClick={() => setActivePane(paneId)}
      >
        {activeTab?.type === 'terminal' || activeTab?.type === 'claude' || activeTab?.type === 'codex' || activeTab?.type === 'pi' || activeTab?.type === 'browser' ? (
          <>
            {browserTabs.map(t => (
              <div key={t.id} style={{ display: activeTab?.id === t.id ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                <BrowserTab tab={t} />
              </div>
            ))}
            {terminalTabs.map(t => (
              <div key={t.id} style={{ display: activeTab?.id === t.id ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                <TerminalTab tab={t} />
              </div>
            ))}
          </>
        ) : activeTab ? (
          <>
            {activeTab.type === 'note' && <EditorTab key={activeTab.id} tab={activeTab} />}
            {activeTab.type === 'draw' && <DrawTab key={activeTab.id} tab={activeTab} />}
            {activeTab.type === 'image' && <ImageTab key={activeTab.id} tab={activeTab} />}
            {activeTab.type === 'new-tab' && <NewTabScreen key={activeTab.id} tab={activeTab} />}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
            <div style={{ width: 96, height: 96, background: 'var(--bg-secondary)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, background: 'var(--accent)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700 }}>I</div>
            </div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Welcome to Ibsidian</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Open a file from the sidebar or create a new one.</p>
            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
              <kbd style={{ padding: '2px 7px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, boxShadow: '0 1px 0 var(--border)', color: 'var(--text-secondary)', lineHeight: '18px' }}>Ctrl</kbd>
              <kbd style={{ padding: '2px 7px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, boxShadow: '0 1px 0 var(--border)', color: 'var(--text-secondary)', lineHeight: '18px' }}>K</kbd>
              <span>Command Palette</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleResizeStart = (index: number, event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const container = splitContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const total = splitDirection === 'vertical' ? rect.height : rect.width;
    if (total <= 0) return;

    const startPos = splitDirection === 'vertical' ? event.clientY : event.clientX;
    const baseSizes = paneSizes.length === panes.length
      ? paneSizes
      : Array.from({ length: panes.length }, () => 1 / panes.length);

    const onMove = (moveEvent: MouseEvent) => {
      const currentPos = splitDirection === 'vertical' ? moveEvent.clientY : moveEvent.clientX;
      const deltaRatio = (currentPos - startPos) / total;
      const next = [...baseSizes];
      const minSize = 0.12;
      const left = Math.max(minSize, baseSizes[index] + deltaRatio);
      const right = Math.max(minSize, baseSizes[index + 1] - deltaRatio);
      const correction = (left + right) - (baseSizes[index] + baseSizes[index + 1]);
      next[index] = left - correction / 2;
      next[index + 1] = right - correction / 2;
      setPaneSizes(next);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = splitDirection === 'vertical' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const renderPaneWithTabBar = (paneId: string) => {
    const pane = panes.find(p => p.id === paneId);
    const paneTabs = tabs.filter(t => (t.paneId ?? 'main') === paneId);

    return (
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <PaneTabBar
          paneId={paneId}
          paneTabs={paneTabs}
          allTabs={tabs}
          activeTabId={pane?.activeTabId ?? null}
          getBrowserGroup={getBrowserGroup}
          setActiveTab={(tabId) => { setActivePane(paneId); setActiveTabId(tabId); }}
          closeTab={closeTab}
          openNewTab={() => openTab({ type: 'new-tab', title: 'New tab' }, paneId)}
          onTabContextMenu={(e, tabId, paneIdForMenu) => {
            e.preventDefault();
            setStackTabCtxMenu({ x: e.clientX, y: e.clientY, tabId, paneId: paneIdForMenu });
          }}
          reorderTabs={reorderTabs}
          moveTabToPane={moveTabToPane}
          moveTabToPaneAt={moveTabToPaneAt}
          moveTabToGroup={moveTabToGroup}
          toggleBrowserGroupCollapsed={toggleBrowserGroupCollapsed}
          updateBrowserGroup={updateBrowserGroup}
          duplicateBrowserGroup={duplicateBrowserGroup}
          deleteBrowserGroup={deleteBrowserGroup}
          closeBrowserGroup={closeBrowserGroup}
          promptValue={promptModal}
        />
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>{renderPane(paneId)}</div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div
        ref={splitContainerRef}
        style={{ flex: 1, display: 'flex', flexDirection: splitDirection === 'vertical' ? 'column' : 'row', overflow: 'hidden' }}
      >
        {panes.map((pane, idx) => (
          <React.Fragment key={pane.id}>
            {idx > 0 && (
              <div
                onMouseDown={(e) => handleResizeStart(idx - 1, e)}
                style={{
                  width: splitDirection === 'vertical' ? '100%' : 4,
                  height: splitDirection === 'vertical' ? 4 : '100%',
                  background: 'var(--border)',
                  opacity: 0.9,
                  flexShrink: 0,
                  cursor: splitDirection === 'vertical' ? 'row-resize' : 'col-resize',
                }}
              />
            )}
            <div style={{ flex: `${Math.max(0.05, paneSizes[idx] ?? (1 / panes.length))} 1 0%`, minHeight: 0, minWidth: 0, display: 'flex' }}>
              {renderPaneWithTabBar(pane.id)}
            </div>
          </React.Fragment>
        ))}
      </div>

      {stackTabCtxMenu && (() => {
        const targetTab = tabs.find(t => t.id === stackTabCtxMenu.tabId);
        if (!targetTab) return null;
        const paneTabs = tabs.filter(t => (t.paneId ?? 'main') === stackTabCtxMenu.paneId);
        const index = paneTabs.findIndex(t => t.id === targetTab.id);
        const canLeft = index > 0;
        const canRight = index >= 0 && index < paneTabs.length - 1;
        const canOther = paneTabs.length > 1;
        const isGroupable = isGroupableTab(targetTab);
        const group = isGroupable ? getBrowserGroup(targetTab.groupId) : null;
        const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean }> = ({ icon, label, onClick, disabled, danger }) => {
          const [hovered, setHovered] = React.useState(false);
          return (
            <button
              disabled={disabled}
              onClick={disabled ? undefined : onClick}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                paddingLeft: 12, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                border: 'none', cursor: disabled ? 'default' : 'pointer',
                fontSize: 13, textAlign: 'left', opacity: disabled ? 0.4 : 1,
                background: hovered && !disabled ? 'var(--bg-hover)' : 'transparent',
                color: danger ? '#ef4444' : 'var(--text-primary)',
                borderRadius: 6, transition: 'background 0.1s',
              }}
            >
              <span style={{ flexShrink: 0, color: danger ? '#ef4444' : 'var(--text-muted)', display: 'flex' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
            </button>
          );
        };
        const Sep = () => <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />;
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: stackTabCtxMenu.x,
              top: stackTabCtxMenu.y,
              zIndex: 9999,
              minWidth: 200,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >
            <MenuItem icon={<X size={14} />} label="Close" onClick={() => { closeTab(targetTab.id); setStackTabCtxMenu(null); }} />
            <MenuItem icon={<PanelLeft size={14} />} label="Close tabs to the left" disabled={!canLeft} onClick={() => { closeTabsToLeft(targetTab.id); setStackTabCtxMenu(null); }} />
            <MenuItem icon={<PanelRight size={14} />} label="Close tabs to the right" disabled={!canRight} onClick={() => { closeTabsToRight(targetTab.id); setStackTabCtxMenu(null); }} />
            <MenuItem icon={<FolderOpen size={14} />} label="Close other tabs" disabled={!canOther} onClick={() => { closeOtherTabs(targetTab.id); setStackTabCtxMenu(null); }} />
            <MenuItem icon={<X size={14} />} label="Close all tabs" onClick={() => { closeAllTabs(); setStackTabCtxMenu(null); }} />
            <Sep />
            <MenuItem icon={<PanelRight size={14} />} label="Split right" onClick={() => { setActivePane(stackTabCtxMenu.paneId); setActiveTabId(targetTab.id); splitRight(); setStackTabCtxMenu(null); }} />
            <MenuItem icon={<PanelBottom size={14} />} label="Split down" onClick={() => { setActivePane(stackTabCtxMenu.paneId); setActiveTabId(targetTab.id); splitDown(); setStackTabCtxMenu(null); }} />
            {isGroupable && <Sep />}
            {isGroupable && (group ? (
              <MenuItem icon={<Link2 size={14} />} label="Remove from group" onClick={() => { moveTabToGroup(targetTab.id, null); setStackTabCtxMenu(null); }} />
            ) : (
              <MenuItem icon={<FolderInput size={14} />} label="Create group from tab..." onClick={() => {
                setStackTabCtxMenu(null);
                promptCreateGroupFromTab({
                  tab: targetTab,
                  prompt: promptModal,
                  createBrowserGroup,
                  moveTabToGroup,
                });
              }} />
            ))}
            {panes.length > 1 && <><Sep /><MenuItem icon={<X size={14} />} label="Close this pane" onClick={() => { closePane(stackTabCtxMenu.paneId); setStackTabCtxMenu(null); }} /></>}
          </div>
        );
      })()}
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
      refreshFileTree(undefined, { showLoading: false });
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

const insertTextAtSelection = (view: EditorView, text: string) => {
  const { state } = view;
  const main = state.selection.main;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: text },
    selection: { anchor: main.from + text.length },
  });
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read pasted image.'));
    reader.readAsDataURL(blob);
  });

const resolveRenderableImagePath = (value: string, nodes: ReturnType<typeof useVault>['nodes'], currentPath?: string | null) => {
  if (value.startsWith(INTERNAL_EMBED_PREFIX)) {
    const target = decodeURIComponent(value.slice(INTERNAL_EMBED_PREFIX.length));
    const resolved = resolveVaultEmbed(target, nodes, currentPath);
    return resolved?.type === 'image' ? resolved.path : value;
  }
  const resolved = resolveVaultEmbed(value, nodes, currentPath);
  return resolved?.type === 'image' ? resolved.path : value;
};

const VaultImage: React.FC<{ src: string; alt?: string; currentPath?: string | null }> = ({ src, alt, currentPath }) => {
  const { nodes } = useVault();
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    const assetPath = resolveRenderableImagePath(src, nodes, currentPath);
    if (!isImagePath(assetPath) || typeof window.api.files.dataUrl !== 'function') {
      setResolvedSrc(assetPath);
      return () => {
        cancelled = true;
      };
    }

    window.api.files.dataUrl(assetPath)
      .then(url => {
        if (!cancelled) setResolvedSrc(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedSrc(assetPath);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPath, nodes, src]);

  return <img src={resolvedSrc} alt={alt} style={{ maxWidth: '100%', borderRadius: 8, margin: 'var(--space-4) 0' }} />;
};

class InlineImagePreviewWidget extends WidgetType {
  constructor(private readonly label: string, private readonly rawSrc: string, private readonly altText: string, private readonly resolvedVaultPath: string | null) {
    super();
  }

  eq(other: WidgetType) {
    return other instanceof InlineImagePreviewWidget && other.label === this.label && other.rawSrc === this.rawSrc && other.altText === this.altText && other.resolvedVaultPath === this.resolvedVaultPath;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '8px';
    wrapper.style.maxWidth = '100%';
    wrapper.style.margin = '8px 0';

    const pill = document.createElement('span');
    pill.textContent = `[${this.label}]`;
    pill.style.display = 'inline-flex';
    pill.style.alignItems = 'center';
    pill.style.width = 'fit-content';
    pill.style.padding = '2px 8px';
    pill.style.borderRadius = '9999px';
    pill.style.background = 'var(--accent-soft)';
    pill.style.color = 'var(--accent)';
    pill.style.fontSize = '12px';
    pill.style.fontWeight = '600';
    pill.style.lineHeight = '1.6';
    pill.style.userSelect = 'none';

    const image = document.createElement('img');
    image.alt = this.altText || this.label;
    image.style.maxWidth = 'min(100%, 420px)';
    image.style.maxHeight = '320px';
    image.style.height = 'auto';
    image.style.borderRadius = '10px';
    image.style.border = '1px solid var(--border)';
    image.style.background = 'var(--bg-secondary)';
    image.style.objectFit = 'contain';

    const applySource = (value: string) => {
      image.src = value;
    };

    if (this.rawSrc.startsWith('data:') || this.rawSrc.startsWith('http://') || this.rawSrc.startsWith('https://')) {
      applySource(this.rawSrc);
    } else if (this.resolvedVaultPath && typeof window.api.files.dataUrl === 'function') {
      window.api.files.dataUrl(this.resolvedVaultPath).then(applySource).catch(() => {
        image.alt = this.altText || `${this.label} unavailable`;
      });
    } else {
      applySource(this.rawSrc);
    }

    wrapper.appendChild(pill);
    wrapper.appendChild(image);
    return wrapper;
  }
}

const buildInlineImagePlaceholders = (view: EditorView, nodes: ReturnType<typeof useVault>['nodes'], currentPath?: string | null): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();
  const selection = view.state.selection.main;
  const matches: Array<{ from: number; to: number; rawSrc: string; altText: string; label: string }> = [];
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
  const wikilinkImageRegex = /!\[\[([^\]\n]+)\]\]/g;
  let match: RegExpExecArray | null;
  let imageIndex = 0;

  while ((match = markdownImageRegex.exec(doc)) !== null) {
    imageIndex += 1;
    const rawSrc = match[2].trim();
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      rawSrc,
      altText: match[1],
      label: `Image${imageIndex}`,
    });
  }

  while ((match = wikilinkImageRegex.exec(doc)) !== null) {
    imageIndex += 1;
    const inner = match[1].trim();
    const [targetPart, aliasPart] = inner.split('|');
    const rawSrc = targetPart.trim();
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      rawSrc,
      altText: aliasPart?.trim() || rawSrc.split('/').pop() || rawSrc,
      label: `Image${imageIndex}`,
    });
  }

  matches.sort((a, b) => a.from - b.from || a.to - b.to);

  for (const item of matches) {
    const overlapsSelection = selection.from < item.to && selection.to > item.from;
    if (overlapsSelection) continue;
    builder.add(item.from, item.to, Decoration.replace({
      widget: new InlineImagePreviewWidget(
        item.label,
        item.rawSrc,
        item.altText,
        isImagePath(resolveRenderableImagePath(item.rawSrc, nodes, currentPath)) ? resolveRenderableImagePath(item.rawSrc, nodes, currentPath) : null,
      ),
      inclusive: false,
    }));
  }

  return builder.finish();
};

const inlineImagePlaceholderPlugin = (nodes: ReturnType<typeof useVault>['nodes'], currentPath?: string | null) => ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildInlineImagePlaceholders(view, nodes, currentPath);
  }

  update(update: { view: EditorView; docChanged: boolean; selectionSet: boolean }) {
    if (update.docChanged || update.selectionSet) {
      this.decorations = buildInlineImagePlaceholders(update.view, nodes, currentPath);
    }
  }
}, {
  decorations: value => value.decorations,
});

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
  const { closeTab, updateTabTitle, updateTabFilePath, splitRight, splitDown } = useTabs();
  const { confirm, prompt, alert } = useModal();
  const { theme } = useActivity();
  const { settings } = useAppSettings();

  const handleError = useCallback((err: unknown, action: string) => {
    const msg = err instanceof Error ? err.message : String(err);
    const isNotFound = msg.includes('ENOENT') || msg.includes('not found');
    alert({
      title: `Failed to ${action}`,
      message: isNotFound
        ? `The file or folder could not be found. It may have been moved or deleted.\n\n${msg}`
        : msg,
    });
    if (isNotFound) refreshFileTree(undefined, { showLoading: false }).catch(() => {});
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
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
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

  // Load content from backend when tab opens; auto-select title only if file is genuinely empty
  useEffect(() => {
    const nodeContent = (node as any)?.content;
    if (typeof nodeContent === 'string') {
      setContent(nodeContent);
      if (nodeContent === '' && titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    } else if (vault && tab.filePath) {
      readFile(tab.filePath)
        .then(text => {
          const loaded = text ?? '';
          setContent(loaded);
          if (loaded === '' && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
          }
        })
        .catch(err => handleError(err, 'read file'));
    }
  }, [tab.filePath, vault]);

  // Scroll to initialLine and highlight the search match
  const scrollAndHighlight = useCallback((lineNum: number, query?: string, caseSensitive?: boolean) => {
    requestAnimationFrame(() => {
      const view = editorViewRef.current;
      if (!view) return;
      try {
        const clampedLine = Math.min(lineNum, view.state.doc.lines);
        const line = view.state.doc.line(clampedLine);
        if (query) {
          const lineText = line.text;
          const idx = caseSensitive ? lineText.indexOf(query) : lineText.toLowerCase().indexOf(query.toLowerCase());
          if (idx !== -1) {
            const anchor = line.from + idx;
            const head = anchor + query.length;
            view.dispatch({
              selection: { anchor, head },
              effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
            });
            view.focus();
            return;
          }
        }
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        });
        view.focus();
      } catch {}
    });
  }, []);

  // Scroll to initialLine when content first loads
  const scrolledForContentRef = useRef(false);
  useEffect(() => { scrolledForContentRef.current = false; }, [tab.filePath]);
  useEffect(() => {
    if (!tab.initialLine || !content) return;
    if (scrolledForContentRef.current) return;
    scrolledForContentRef.current = true;
    scrollAndHighlight(tab.initialLine, tab.searchQuery, tab.searchCaseSensitive);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-scroll when user clicks a search result for an already-open tab
  useEffect(() => {
    if (!tab.scrollNonce || !tab.initialLine) return;
    scrollAndHighlight(tab.initialLine, tab.searchQuery, tab.searchCaseSensitive);
  }, [tab.scrollNonce]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (tab.filePath) {
        const dirPath = tab.filePath.includes('/') ? tab.filePath.slice(0, tab.filePath.lastIndexOf('/')) : '';
        const newPath = dirPath ? `${dirPath}/${newName}` : newName;
        renameItem(tab.filePath, newName)
          .then(() => {
            updateTabFilePath(tab.id, newPath);
            refreshFileTree(undefined, { showLoading: false });
          })
          .catch(err => handleError(err, 'rename file'));
      }
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
        if (tab.filePath) {
          const dirPath = tab.filePath.includes('/') ? tab.filePath.slice(0, tab.filePath.lastIndexOf('/')) : '';
          const newPath = dirPath ? `${dirPath}/${newName}` : newName;
          renameItem(tab.filePath, newName)
            .then(() => {
              updateTabFilePath(tab.id, newPath);
              refreshFileTree(undefined, { showLoading: false });
            })
            .catch(err => handleError(err, 'rename file'));
        }
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

  const handleImageInsert = useCallback(async (files: File[], view: EditorView, coords?: { x: number; y: number }) => {
    if (!files.length || typeof window.api.files.writeBinary !== 'function') return false;

    try {
      const existingPaths = listVaultFilePaths(nodes);
      const fragments: string[] = [];

      for (const file of files) {
        const dataUrl = await blobToDataUrl(file);
        const fileName = buildTimestampedImageName(file.type || 'image/png');
        const destination = resolveAttachmentDestination(settings, tab.filePath, fileName);
        const uniquePath = ensureUniqueVaultPath(destination.fullPath, existingPaths);
        existingPaths.add(uniquePath);
        const base64 = dataUrl.split(',')[1] ?? '';
        await window.api.files.writeBinary(uniquePath, base64);
        const embedTarget = settings.attachments.attachmentLocation === 'same-folder-as-note'
          ? uniquePath.split('/').pop() ?? uniquePath
          : uniquePath;
        fragments.push(`![[${embedTarget}]]`);
      }

      if (fragments.length) {
        if (coords) {
          const position = view.posAtCoords(coords);
          if (typeof position === 'number') {
            view.dispatch({ selection: { anchor: position } });
          }
        }
        insertTextAtSelection(view, fragments.join('\n\n'));
      }
      refreshFileTree(undefined, { showLoading: false }).catch(() => {});
      return true;
    } catch (err) {
      handleError(err, 'insert image');
      return true;
    }
  }, [handleError, nodes, refreshFileTree, settings, tab.filePath]);

  const handleImagePaste = useCallback(async (event: ClipboardEvent, view: EditorView) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageFiles = items
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => !!file);
    if (imageFiles.length === 0) return false;

    event.preventDefault();
    return handleImageInsert(imageFiles, view);
  }, [handleImageInsert]);

  const handleImageDrop = useCallback(async (event: DragEvent, view: EditorView) => {
    const files = Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return false;
    event.preventDefault();
    return handleImageInsert(files, view, { x: event.clientX, y: event.clientY });
  }, [handleImageInsert]);

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
        type: target.type === 'draw' ? 'class' : target.type === 'image' ? 'image' : 'file',
        apply: (view: EditorView, _completion: Completion, replaceFrom: number, replaceTo: number) => {
          replaceCompletionText(view, replaceFrom, replaceTo, target.type === 'image' ? target.path : target.title, ']]');
        },
      })),
      validFor: /^[^#|\]]*$/i,
    };
  }, [content, loadAnchorsForPath, nodes, tab.filePath]);

  const liveMarkdownExtensions = [
    hybridMarkdown({ theme }),
    autocompletion({ override: [obsidianCompletionSource] }),
    keymap.of([{ key: 'Enter', run: insertNewlineContinueMarkup }]),
    inlineImagePlaceholderPlugin(nodes, tab.filePath),
    EditorView.domEventHandlers({
      paste: (event, view) => {
        const hasImage = Array.from(event.clipboardData?.items ?? []).some(item => item.type.startsWith('image/'));
        if (!hasImage) return false;
        void handleImagePaste(event, view);
        return true;
      },
      drop: (event, view) => {
        const hasImage = Array.from(event.dataTransfer?.files ?? []).some(item => item.type.startsWith('image/'));
        if (!hasImage) return false;
        void handleImageDrop(event, view);
        return true;
      },
    }),
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
                <MenuItem icon={<PanelRight size={14} />} label="Split left" onClick={() => { setMenuOpen(false); splitRight(); }} />
                <MenuItem icon={<PanelBottom size={14} />} label="Split down" onClick={() => { setMenuOpen(false); splitDown(); }} />
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
            <div onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}>
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
            {ctxMenu && editorViewRef.current && (
              <EditorContextMenu
                x={ctxMenu.x} y={ctxMenu.y}
                view={editorViewRef.current}
                onClose={() => setCtxMenu(null)}
                currentPath={tab.filePath}
              />
            )}
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

const resolveBrowserUrl = (target: string) => {
  const trimmed = target.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  const hasWhitespace = /\s/.test(trimmed);
  const looksLikeLocalhost = /^localhost(?::\d+)?(?:[/?#].*)?$/i.test(trimmed);
  const looksLikeIPv4 = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:[/?#].*)?$/.test(trimmed);
  const looksLikeDomain = /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?::\d+)?(?:[/?#].*)?$/.test(trimmed);

  if (!hasWhitespace && (looksLikeLocalhost || looksLikeIPv4)) return `http://${trimmed}`;
  if (!hasWhitespace && looksLikeDomain) return `https://${trimmed}`;

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
};

const deriveBrowserTitle = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
};

const browserFaviconCache = new Map<string, string>();

const getUrlOrigin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const deriveBrowserFaviconFallback = (url: string) => {
  const origin = getUrlOrigin(url);
  if (!origin) return undefined;
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(origin)}`;
};

const getCachedBrowserFavicon = (url: string) => {
  const origin = getUrlOrigin(url);
  if (!origin) return undefined;
  return browserFaviconCache.get(origin);
};

const getBrowserFaviconForUrl = (url: string) => {
  return getCachedBrowserFavicon(url) ?? deriveBrowserFaviconFallback(url);
};

const cacheBrowserFavicon = (url: string, faviconUrl?: string) => {
  if (!faviconUrl) return;
  const origin = getUrlOrigin(url);
  if (!origin) return;
  browserFaviconCache.set(origin, faviconUrl);
};

const BrowserTab: React.FC<{ tab: any }> = ({ tab }) => {
  const webviewRef = useRef<any>(null);
  const { updateTabTitle, updateTabUrl, updateTabFavicon, openTab } = useTabs();
  const { theme } = useActivity();
  const bgColor = theme === 'dark' ? '#1e1e1e' : '#ffffff';
  const textColor = theme === 'dark' ? '#ffffff' : '#1e1e1e';
  const dimColor = theme === 'dark' ? '#a3a3a3' : '#737373';
  const isNewTab = !tab.url || tab.url === 'about:blank' || tab.url === 'chrome://newtab';
  const [inputUrl, setInputUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clock, setClock] = useState('00:00');
  const [greeting, setGreeting] = useState('Good evening');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; url: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, url });
  };

  useEffect(() => {
    const handleClick = () => setCtxMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClock(`${h}:${m}`);
      const hour = now.getHours();
      let greet = 'Good evening';
      if (hour < 12) greet = 'Good morning';
      else if (hour < 18) greet = 'Good afternoon';
      setGreeting(`${greet}, explorer`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = inputUrl.trim();
    if (!query) return;
    const urlPattern = /^(https?:\/\/)?([\w\d-]+\.)+[\w-]+(\/.*)?$/i;
    if (urlPattern.test(query)) {
      const dest = query.startsWith('http') ? query : `https://${query}`;
      navigate(dest);
    } else {
      navigate(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    }
  };

  // Stable refs so event handlers never go stale and the effect runs once
  const currentUrlRef = useRef(currentUrl);
  const tabIdRef = useRef(tab.id);
  const updateTabTitleRef = useRef(updateTabTitle);
  const updateTabUrlRef = useRef(updateTabUrl);
  const updateTabFaviconRef = useRef(updateTabFavicon);
  useEffect(() => { currentUrlRef.current = currentUrl; }, [currentUrl]);
  useEffect(() => { updateTabTitleRef.current = updateTabTitle; }, [updateTabTitle]);
  useEffect(() => { updateTabUrlRef.current = updateTabUrl; }, [updateTabUrl]);
  useEffect(() => { updateTabFaviconRef.current = updateTabFavicon; }, [updateTabFavicon]);

  const navigate = (target: string) => {
    const nextUrl = resolveBrowserUrl(target);
    setCurrentUrl(nextUrl);
    setInputUrl(nextUrl);
    updateTabUrl(tab.id, nextUrl);
    updateTabTitle(tab.id, deriveBrowserTitle(nextUrl));
    updateTabFavicon(tab.id, getBrowserFaviconForUrl(nextUrl));
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(inputUrl);
  };

  const updateNavState = (wv: any) => {
    try {
      setCanGoBack(wv.canGoBack?.() ?? false);
      setCanGoForward(wv.canGoForward?.() ?? false);
    } catch { /* webview not ready */ }
  };

  useEffect(() => {
    const nextUrl = tab.url || '';
    setInputUrl(isNewTab ? '' : nextUrl);
    setCurrentUrl(nextUrl);
    if (!tab.url) updateTabUrl(tab.id, nextUrl);
    if (tab.faviconUrl) {
      cacheBrowserFavicon(nextUrl, tab.faviconUrl);
    } else if (nextUrl) {
      updateTabFavicon(tab.id, getBrowserFaviconForUrl(nextUrl));
    } else {
      updateTabFavicon(tab.id, '');
    }
  }, [tab.faviconUrl, tab.id, tab.url, updateTabFavicon, updateTabUrl]);

  // Mount-once effect — uses refs so listeners are never torn down mid-load
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onNav = (e: any) => {
      const nextUrl = e?.url || wv.getURL?.() || currentUrlRef.current;
      if (!nextUrl) return;
      setInputUrl(nextUrl);
      setCurrentUrl(nextUrl);
      currentUrlRef.current = nextUrl;
      updateTabUrlRef.current(tabIdRef.current, nextUrl);
      updateTabFaviconRef.current(tabIdRef.current, getBrowserFaviconForUrl(nextUrl));
      updateNavState(wv);
    };
    const onTitle = (e: any) => {
      const nextTitle = typeof e?.title === 'string' && e.title.trim()
        ? e.title.trim()
        : deriveBrowserTitle(currentUrlRef.current);
      updateTabTitleRef.current(tabIdRef.current, nextTitle);
    };
    const onFavicon = (e: any) => {
      const favicons = Array.isArray(e?.favicons) ? e.favicons.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : [];
      const favicon = favicons[0];
      cacheBrowserFavicon(currentUrlRef.current, favicon);
      updateTabFaviconRef.current(tabIdRef.current, favicon);
    };
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    const done = () => { if (stopTimer) clearTimeout(stopTimer); stopTimer = null; setIsLoading(false); updateNavState(wv); };
    const onStartLoad   = () => { if (stopTimer) clearTimeout(stopTimer); setIsLoading(true);  updateNavState(wv); };
    const onFinishLoad  = () => done();
    const onFailLoad    = () => done();
    const onStopLoad    = () => { stopTimer = setTimeout(done, 300); };
    const onDomReady    = () => { updateNavState(wv); try { wv.setBackgroundColor?.(bgColor); } catch {} };
    const onReload = (e: Event) => {
      const detail = (e as CustomEvent<{ tabId?: string }>).detail;
      if (detail?.tabId !== tabIdRef.current) return;
      wv.reload();
    };

    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    wv.addEventListener('page-title-updated', onTitle);
    wv.addEventListener('page-favicon-updated', onFavicon);
    wv.addEventListener('did-start-loading', onStartLoad);
    wv.addEventListener('did-finish-load', onFinishLoad);
    wv.addEventListener('did-fail-load', onFailLoad);
    wv.addEventListener('did-stop-loading', onStopLoad);
    wv.addEventListener('dom-ready', onDomReady);
    window.addEventListener('ibsidian:browser-tab-reload', onReload as EventListener);
    return () => {
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
      wv.removeEventListener('page-title-updated', onTitle);
      wv.removeEventListener('page-favicon-updated', onFavicon);
      wv.removeEventListener('did-start-loading', onStartLoad);
      wv.removeEventListener('did-finish-load', onFinishLoad);
      wv.removeEventListener('did-fail-load', onFailLoad);
      wv.removeEventListener('did-stop-loading', onStopLoad);
      wv.removeEventListener('dom-ready', onDomReady);
      if (stopTimer) clearTimeout(stopTimer);
      window.removeEventListener('ibsidian:browser-tab-reload', onReload as EventListener);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep webview background in sync with theme changes
  useEffect(() => {
    try { webviewRef.current?.setBackgroundColor?.(bgColor); } catch {}
  }, [bgColor]);

const navBtn = (disabled: boolean, onClick: () => void, children: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, border: 'none', background: 'transparent',
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );

  if (isNewTab) {
    const shortcuts = [
      { label: 'GitHub', url: 'https://github.com', icon: 'G' },
      { label: 'YouTube', url: 'https://youtube.com', icon: 'Y' },
      { label: 'Reddit', url: 'https://reddit.com', icon: 'R' },
      { label: 'Notion', url: 'https://notion.so', icon: 'N' },
    ];
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
        <div style={{ height: 36, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {navBtn(true, () => {}, <ArrowLeft size={14} />)}
            {navBtn(true, () => {}, <ArrowRight size={14} />)}
            {navBtn(false, () => {}, <RefreshCw size={14} />)}
          </div>
          <form onSubmit={handleSearch} style={{ flex: 1 }}>
            <div style={{ width: '100%', height: 28, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 9999, padding: '0 12px' }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#4285f4', flexShrink: 0 }}>G</span>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Search the web or enter URL..."
                style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
          </form>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ fontSize: '5rem', fontWeight: 300, letterSpacing: '-2px', marginBottom: 8, color: textColor }}>{clock}</div>
          <div style={{ fontSize: '1.5rem', color: dimColor, marginBottom: 40, fontWeight: 400 }}>{greeting}</div>
          <form onSubmit={handleSearch} style={{ width: '100%', maxWidth: 600, padding: '0 20px', zIndex: 10 }}>
            <div style={{
              width: '100%', padding: '4px 4px 4px 16px', borderRadius: 24,
              background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              display: 'flex', alignItems: 'center',
            }}>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Search the web or enter URL..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', padding: '12px 0',
                  fontSize: '1rem', color: textColor, outline: 'none',
                }}
                autoFocus
              />
              <button type="submit" style={{
                width: 36, height: 36, borderRadius: 18, border: 'none',
                background: '#4285f4', color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            </div>
          </form>
          <div style={{ marginTop: 48, display: 'flex', gap: 24 }}>
            {shortcuts.map(s => (
              <button
                key={s.url}
                onClick={() => navigate(s.url)}
                onContextMenu={(e) => handleContextMenu(e, s.url)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textDecoration: 'none', color: dimColor,
                  transition: 'transform 0.2s, color 0.2s', cursor: 'pointer',
                  background: 'transparent', border: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.color = textColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.color = dimColor; }}
              >
                <div style={{
                  width: 48, height: 48,
                  background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8, fontSize: '1.2rem', color: textColor,
                }}>{s.icon}</div>
                <span style={{ fontSize: '0.75rem' }}>{s.label}</span>
              </button>
            ))}
          </div>
          {ctxMenu && (
            <div style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 1000,
              padding: '4px 0', minWidth: 160,
            }}>
              <button
                onClick={() => { navigate(ctxMenu.url); setCtxMenu(null); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
                  background: 'transparent', border: 'none', fontSize: 13,
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                Open in this tab
              </button>
              <button
                onClick={() => { openTab({ type: 'browser', title: 'New Tab', url: ctxMenu.url, groupId: '' }); setCtxMenu(null); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
                  background: 'transparent', border: 'none', fontSize: 13,
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                Open in new tab
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ height: 36, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {navBtn(!canGoBack,    () => webviewRef.current?.goBack(),    <ArrowLeft size={14} />)}
          {navBtn(!canGoForward, () => webviewRef.current?.goForward(), <ArrowRight size={14} />)}
          {navBtn(false, () => webviewRef.current?.reload(),
            <RefreshCw size={14} style={isLoading ? { animation: 'spin 0.7s linear infinite' } : undefined} />
          )}
        </div>
        <form onSubmit={handleNavigate} style={{ flex: 1 }}>
          <div style={{ width: '100%', height: 28, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 9999, padding: '0 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Search Google or type a URL"
              style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
        </form>
      </div>
      {/* @ts-ignore - webview is an Electron-specific tag */}
      <webview ref={webviewRef} src={currentUrl} style={{ flex: 1, border: 'none', background: bgColor }} />
    </div>
  );
};

const ImageTab: React.FC<{ tab: any }> = ({ tab }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!tab.filePath) return () => { cancelled = true; };

    window.api.files.dataUrl(tab.filePath)
      .then(url => {
        if (!cancelled) {
          setImageUrl(url);
          setError('');
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [tab.filePath]);

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 24 }}>
        Failed to open image: {error}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)', padding: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      {imageUrl && <img src={imageUrl} alt={tab.title} style={{ maxWidth: '100%', height: 'auto', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }} />}
    </div>
  );
};

// ── Draw tab ─────────────────────────────────────────────────────────

const DRAW_SAVE_DEBOUNCE_MS = 400;
const EXCALIDRAW_LINK_HREFS = [
  'https://github.com/excalidraw/excalidraw',
  'https://x.com/excalidraw',
  'https://twitter.com/excalidraw',
  'https://discord.gg/UexuTaE',
  'https://docs.excalidraw.com',
  'https://plus.excalidraw.com/blog',
  'https://youtube.com/@excalidraw',
  'https://github.com/excalidraw/excalidraw/issues',
];

const hideExcalidrawBrandLinks = () => {
  const root = document.querySelector('.excalidraw');
  if (!root) return;

  root.querySelectorAll('a').forEach(anchor => {
    const href = (anchor as HTMLAnchorElement).href;
    if (!EXCALIDRAW_LINK_HREFS.some(target => href === target || href.startsWith(`${target}/`))) return;

    const section = anchor.closest('.HelpDialog__island, .HelpDialog__header, .Socials') as HTMLElement | null;
    (section ?? anchor).remove();
  });

  root.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p').forEach(node => {
    if (node.textContent?.trim() !== 'Excalidraw links') return;

    const section = node.closest('.HelpDialog__island, .HelpDialog__header, .Socials') as HTMLElement | null;
    (section ?? node).remove();
  });
};

const DrawTab: React.FC<{ tab: Tab }> = ({ tab }) => {
  const { readFile, writeFile } = useVault();
  const saveTimerRef = useRef<number | null>(null);
  const lastSerializedRef = useRef<string>('');
  const [initialData, setInitialData] = useState<ExcalidrawSceneFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    lastSerializedRef.current = '';

    if (!tab.filePath) {
      setInitialData(null);
      setIsLoading(false);
      setLoadError('This drawing tab is missing a vault file path.');
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setLoadError('');
    setNotice('');
    setSaveError('');

    readFile(tab.filePath)
      .then(content => {
        if (cancelled) return;
        const { scene, wasRecovered } = parseExcalidrawFileContent(content);
        lastSerializedRef.current = serializeAsJSON(
          scene.elements as never[],
          scene.appState,
          scene.files as never,
          'local'
        );
        setInitialData(scene);
        setNotice(wasRecovered ? 'This drawing file was invalid or legacy data, so Ibsidian opened a blank scene. Saving will replace it with a valid .excalidraw document.' : '');
        setIsLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setInitialData(null);
        setLoadError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [tab.filePath, readFile]);

  const scheduleSave = useCallback((serialized: string) => {
    if (!tab.filePath) return;
    if (serialized === lastSerializedRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      writeFile(tab.filePath!, serialized)
        .then(() => {
          lastSerializedRef.current = serialized;
          setSaveError('');
        })
        .catch(err => setSaveError(err instanceof Error ? err.message : String(err)));
    }, DRAW_SAVE_DEBOUNCE_MS);
  }, [tab.filePath, writeFile]);

  useLayoutEffect(() => {
    hideExcalidrawBrandLinks();
    const observer = new MutationObserver(() => hideExcalidrawBrandLinks());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 24 }}>
        Loading drawing…
      </div>
    );
  }

  if (loadError || !initialData) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
        Failed to open drawing: {loadError || 'Unknown error'}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative' }}>
      {(notice || saveError) && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: saveError ? '#ef4444' : 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
          {saveError || notice}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          key={tab.filePath}
          initialData={{
            elements: initialData.elements as never[],
            appState: initialData.appState,
            files: initialData.files as never,
          }}
          onChange={(elements, appState, files) => {
            scheduleSave(serializeAsJSON(elements, appState, files, 'local'));
          }}
        />
      </div>
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
      if (tab.command) {
        window.api.terminal.input(sessionId, tab.command);
      }
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
        {tab.type === 'claude' ? <ClaudeIcon size={12} /> : tab.type === 'codex' ? <CodexIcon size={12} /> : tab.type === 'pi' ? <PiIcon size={12} /> : <SquareTerminal size={12} />}
        <span>{tab.type === 'claude' ? 'claude' : tab.type === 'codex' ? 'codex' : tab.type === 'pi' ? 'pi' : 'bash'} — {cols}×{rows}</span>
      </div>
      <div ref={terminalRef} style={{ flex: 1, padding: 8 }} />
    </div>
  );
};
