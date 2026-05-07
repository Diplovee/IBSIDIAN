import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
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
import { useLibrary } from '../contexts/LibraryContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ClaudeIcon, CodexIcon, PiIcon } from './AgentIcons';
import { ProductivityChat } from './ProductivityChat';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { DrawList } from './DrawList';
import { PaneTabBar } from './PaneTabBar';
import { EditorContextMenu } from './EditorContextMenu';
import {
  Globe, SquareTerminal, RefreshCw, ArrowLeft, ArrowRight,
  MoreHorizontal, Code, PanelRight, PanelBottom, PanelLeft,
  ExternalLink, Pencil, FolderInput, Bookmark,
  Download, Search, Copy, Check, History, Link2, ArrowUpRight, FolderOpen,
  Trash2, ChevronRight, X, Pin, Eye, EyeOff, Plus,
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
import type { AppSettings, BrowserShortcut, ExcalidrawSceneFile, Tab } from '../types';
import { parseExcalidrawFileContent } from '../utils/excalidraw';
import { isGroupableTab, promptCreateGroupFromTab } from '../utils/tabGrouping';
import { MonacoEditor } from './editor/MonacoEditor';
import { MonacoToolbar } from './editor/MonacoToolbar';
import { insertAtCursor } from './editor/codemirrorActions';

const UPDATE_AVAILABLE_KEY = 'ibsidian:update-available';
const UPDATE_CURRENT_KEY = 'ibsidian:update-current';
const UPDATE_LATEST_KEY = 'ibsidian:update-latest';

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
    pre: ({ children }: any) => {
      const [copied, setCopied] = useState(false);
      const extractText = (node: React.ReactNode): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (React.isValidElement(node)) return extractText((node.props as any).children);
        return '';
      };
      const handleCopy = () => {
        const text = extractText(children).replace(/\n$/, '');
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      };
      return (
        <div style={{ position: 'relative', margin: 'var(--space-4) 0' }}>
          <pre style={{ padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            {children}
          </pre>
          <button
            onClick={handleCopy}
            title="Copy"
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied ? 'var(--accent)' : 'var(--text-muted)', transition: 'color 0.15s' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      );
    },
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

export const Canvas: React.FC = () => {
  const {
    activeTabId,
    fullscreenTabId,
    tabs,
    panes,
    paneSizes,
    splitDirection,
    activePaneId,
    setActivePane,
    setActiveTabId,
    openTab,
    closeTab,
    toggleTabPinned,
    updateTabCustomTitle,
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
    clearFullscreenTab,
  } = useTabs();
  const { saveGroup } = useLibrary();
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [stackTabCtxMenu, setStackTabCtxMenu] = useState<{ x: number; y: number; tabId: string; paneId: string } | null>(null);
  const [fullscreenRailOpen, setFullscreenRailOpen] = useState(false);
  const { prompt: promptModal, confirm: confirmModal } = useModal();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          openTab({ type: 'terminal', title: 'Terminal' }, activePaneId);
        } else if (e.key === '\\') {
          e.preventDefault();
          splitRight();
        } else if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          if (activeTabId) closeTab(activeTabId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openTab, activePaneId, splitRight, closeTab, activeTabId]);

  useEffect(() => {
    if (!stackTabCtxMenu) return;
    const close = () => setStackTabCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [stackTabCtxMenu]);

  useEffect(() => {
    if (!fullscreenTabId) return;
    const fullscreenTab = tabs.find(t => t.id === fullscreenTabId);
    if (!fullscreenTab || (fullscreenTab.type !== 'browser' && fullscreenTab.type !== 'draw')) {
      clearFullscreenTab();
    }
  }, [clearFullscreenTab, fullscreenTabId, tabs]);

  useEffect(() => {
    setFullscreenRailOpen(false);
  }, [fullscreenTabId]);

  const fullscreenTab = fullscreenTabId ? tabs.find(t => t.id === fullscreenTabId) ?? null : null;
  const isFullscreenTab = !!fullscreenTab && (fullscreenTab.type === 'browser' || fullscreenTab.type === 'draw');
  const fullscreenPaneId = fullscreenTab?.paneId ?? 'main';
  const isFullscreenBrowser = fullscreenTab?.type === 'browser';

  const renderPane = (paneId: string) => {
    const pane = panes.find(p => p.id === paneId);
    const activeTab = pane?.activeTabId ? tabs.find(t => t.id === pane.activeTabId) : null;
    const paneTabs = tabs.filter(t => (t.paneId ?? 'main') === paneId);
    const paneBrowserTabs = paneTabs.filter(t => t.type === 'browser');
    const paneTerminalTabs = paneTabs.filter(t => t.type === 'terminal' || t.type === 'claude' || t.type === 'codex' || t.type === 'pi');
    const paneProductivityTabs = paneTabs.filter(t => t.type === 'productivity');

    return (
      <div
        key={paneId}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}
        onClick={() => setActivePane(paneId)}
      >
        {paneBrowserTabs.map(t => (
          <div key={t.id} style={{ display: activeTab?.id === t.id ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <BrowserTab tab={t} />
          </div>
        ))}
        {paneTerminalTabs.map(t => (
          <div key={t.id} style={{ display: activeTab?.id === t.id ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <TerminalTab tab={t} />
          </div>
        ))}
        {paneProductivityTabs.map(t => (
          <div key={t.id} style={{ display: activeTab?.id === t.id ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <ProductivityChat tab={t} />
          </div>
        ))}

        {activeTab && activeTab.type !== 'terminal' && activeTab.type !== 'claude' && activeTab.type !== 'codex' && activeTab.type !== 'pi' && activeTab.type !== 'browser' && activeTab.type !== 'productivity' ? (
          <>
            {(activeTab.type === 'note' || activeTab.type === 'code') && <EditorTab key={activeTab.id} tab={activeTab} />}
            {activeTab.type === 'draw' && <DrawTab key={activeTab.id} tab={activeTab} />}
            {activeTab.type === 'draw-list' && <DrawList key={activeTab.id} />}
            {activeTab.type === 'image' && <ImageTab key={activeTab.id} tab={activeTab} />}
            {activeTab.type === 'new-tab' && <NewTabScreen key={activeTab.id} tab={activeTab} />}
          </>
        ) : !activeTab ? (
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
        ) : null}
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
    const paneIsFullscreen = isFullscreenTab && paneId === fullscreenPaneId;
    const showTabBar = !isFullscreenTab || !paneIsFullscreen;

    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          position: paneIsFullscreen ? 'fixed' : 'relative',
          inset: paneIsFullscreen ? 0 : undefined,
          zIndex: paneIsFullscreen ? 8 : 'auto',
          background: 'var(--bg-primary)',
          overflow: 'hidden',
          visibility: isFullscreenTab && !paneIsFullscreen ? 'hidden' : 'visible',
          pointerEvents: isFullscreenTab && !paneIsFullscreen ? 'none' : 'auto',
        }}
      >
        {showTabBar && (
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
            toggleTabPinned={toggleTabPinned}
            toggleBrowserGroupCollapsed={toggleBrowserGroupCollapsed}
            updateBrowserGroup={updateBrowserGroup}
            duplicateBrowserGroup={duplicateBrowserGroup}
            deleteBrowserGroup={deleteBrowserGroup}
            closeBrowserGroup={closeBrowserGroup}
            saveGroup={saveGroup}
            promptValue={promptModal}
            paneCount={panes.length}
            onClosePane={async () => {
              const paneTabs = tabs.filter(t => (t.paneId ?? 'main') === paneId);
              const msg = paneTabs.length > 0
                ? `Close this pane and its ${paneTabs.length} tab${paneTabs.length === 1 ? '' : 's'}?`
                : 'Close this pane?';
              const ok = await confirmModal({ title: 'Close pane', message: msg, confirmLabel: 'Close', danger: true });
              if (!ok) return;
              closePane(paneId);
            }}
            onSplitRight={() => { setActivePane(paneId); splitRight(); }}
            onSplitDown={() => { setActivePane(paneId); splitDown(); }}
          />
        )}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>{renderPane(paneId)}</div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div
        ref={splitContainerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: splitDirection === 'vertical' ? 'column' : 'row',
          overflow: 'hidden',
          position: 'relative',
        }}
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

      {isFullscreenTab && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 220,
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <div
            onMouseEnter={() => setFullscreenRailOpen(true)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 12,
              pointerEvents: 'auto',
              background: 'linear-gradient(to right, color-mix(in srgb, var(--bg-primary) 30%, transparent), transparent)',
              borderRight: '1px solid transparent',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'stretch',
              pointerEvents: 'auto',
              transform: fullscreenRailOpen ? 'translateX(0)' : 'translateX(-208px)',
              transition: 'transform 0.16s ease',
            }}
            onMouseEnter={() => setFullscreenRailOpen(true)}
            onMouseLeave={() => setFullscreenRailOpen(false)}
          >
            <div
              style={{
                width: 220,
                padding: '12px 10px 12px 12px',
                background: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
                borderRight: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                backdropFilter: 'blur(12px)',
              }}
            >
              <RailButton label="Exit fullscreen" onClick={clearFullscreenTab} />
              {isFullscreenBrowser && fullscreenTab && (
                <>
                  <RailButton label="Back" onClick={() => window.dispatchEvent(new CustomEvent('ibsidian:browser-tab-control', { detail: { tabId: fullscreenTab.id, action: 'back' } }))} />
                  <RailButton label="Forward" onClick={() => window.dispatchEvent(new CustomEvent('ibsidian:browser-tab-control', { detail: { tabId: fullscreenTab.id, action: 'forward' } }))} />
                  <RailButton label="Reload" onClick={() => window.dispatchEvent(new CustomEvent('ibsidian:browser-tab-control', { detail: { tabId: fullscreenTab.id, action: 'reload' } }))} />
                </>
              )}
            </div>
            <div style={{ width: 12, height: '100%', background: 'transparent' }} />
          </div>
        </div>
      )}

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
            <MenuItem icon={<Pencil size={14} />} label="Rename" onClick={() => {
              setStackTabCtxMenu(null);
              promptModal({
                title: 'Rename tab',
                defaultValue: targetTab.customTitle ?? targetTab.title,
                placeholder: 'Tab title',
              }).then(name => {
                if (name !== undefined && name !== null && name.trim()) {
                  updateTabCustomTitle(targetTab.id, name.trim());
                } else if (!name) {
                  updateTabCustomTitle(targetTab.id, undefined);
                }
              });
            }} />
            <Sep />
            <MenuItem
              icon={<Pin size={14} color="var(--accent)" />}
              label={targetTab.pinned ? 'Unpin tab' : 'Pin tab'}
              onClick={() => { toggleTabPinned(targetTab.id); setStackTabCtxMenu(null); }}
            />
            <Sep />
            <MenuItem icon={<X size={14} />} label="Close" disabled={!!targetTab.pinned} onClick={() => { closeTab(targetTab.id); setStackTabCtxMenu(null); }} />
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
  const { openTab, closeTab } = useTabs();
  const { prompt } = useModal();
  const { createFileRemote, refreshFileTree, nextUntitledName } = useVault();

  const createMarkdownNote = async () => {
    const requestedName = await prompt({
      title: 'New note',
      placeholder: 'Note name',
      defaultValue: nextUntitledName(),
      confirmLabel: 'Create',
    });
    if (!requestedName) return;
    const name = requestedName.trim().replace(/\.md$/, '');
    if (!name) return;
    await createFileRemote('', name, 'md');
    await refreshFileTree(undefined, { showLoading: false });
    openTab({ type: 'note', title: name, filePath: `${name}.md` });
    closeTab(tab.id);
  };

  const openBrowserTab = () => {
    openTab({ type: 'browser', title: 'New Tab', url: 'about:blank', groupId: '' });
  };

  const openTerminalTab = () => {
    openTab({ type: 'terminal', title: 'Terminal' });
  };

  const openDrawingsList = () => {
    openTab({ type: 'draw-list', title: 'Drawings', filePath: 'ibsidian://drawings' });
    closeTab(tab.id);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 32 }}>
      <div style={{ width: '100%', maxWidth: 520, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--bg-secondary)', padding: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>New tab</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Start a note or open another workspace tab.
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={() => { void createMarkdownNote(); }} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>New note</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Create a Markdown note in the vault.</div>
          </button>
          <button onClick={openDrawingsList} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Manage drawings</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Open the drawings gallery to view and create sketches.</div>
          </button>
          <button onClick={openBrowserTab} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>New browser tab</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Open an empty browser tab.</div>
          </button>
          <button onClick={openTerminalTab} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>New terminal</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Open a shell session.</div>
          </button>
        </div>
      </div>
    </div>
  );
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read pasted image.'));
    reader.readAsDataURL(blob);
  });

const CALLOUT_STYLES = {
  note: { label: 'Note', color: '#9ca3af' },
  info: { label: 'Info', color: '#3b82f6' },
  todo: { label: 'Todo', color: '#0ea5e9' },
  tip: { label: 'Tip', color: '#22c55e' },
  success: { label: 'Success', color: '#10b981' },
  question: { label: 'Question', color: '#f59e0b' },
  warning: { label: 'Warning', color: '#fbbf24' },
  failure: { label: 'Failure', color: '#f43f5e' },
  danger: { label: 'Danger', color: '#ef4444' },
  bug: { label: 'Bug', color: '#a855f7' },
  example: { label: 'Example', color: '#6366f1' },
  quote: { label: 'Quote', color: '#94a3b8' },
};

const calloutCompletions: Completion[] = Object.entries(CALLOUT_STYLES).map(([key, value]) => ({
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

const RailButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      textAlign: 'left',
      padding: '9px 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
    }}
  >
    {label}
  </button>
);

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
  const { settings, updateEditorSettings } = useAppSettings();
  const showFormattingBar = settings.editor.showFormattingBar;
  const isCodeTab = tab.type === 'code';
  const [updateAvailable, setUpdateAvailable] = useState(() => localStorage.getItem(UPDATE_AVAILABLE_KEY) === 'true');
  const [updateCurrent, setUpdateCurrent] = useState(() => localStorage.getItem(UPDATE_CURRENT_KEY) || '');
  const [updateLatest, setUpdateLatest] = useState(() => localStorage.getItem(UPDATE_LATEST_KEY) || '');

  useEffect(() => {
    const syncUpdateStatus = () => {
      setUpdateAvailable(localStorage.getItem(UPDATE_AVAILABLE_KEY) === 'true');
      setUpdateCurrent(localStorage.getItem(UPDATE_CURRENT_KEY) || '');
      setUpdateLatest(localStorage.getItem(UPDATE_LATEST_KEY) || '');
    };
    window.addEventListener('storage', syncUpdateStatus);
    window.addEventListener('ibsidian:update-status-changed', syncUpdateStatus as EventListener);
    return () => {
      window.removeEventListener('storage', syncUpdateStatus);
      window.removeEventListener('ibsidian:update-status-changed', syncUpdateStatus as EventListener);
    };
  }, []);

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
  const editorRef = useRef<any>(null); // Monaco editor instance
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const anchorCacheRef = useRef(new Map<string, ReturnType<typeof extractMarkdownAnchors>>());

  // Sync title if node name changes externally
  useEffect(() => {
    if (node?.name) setTitleValue(stripExt(node.name));
  }, [node?.name]);

  useEffect(() => {
    editorRef.current = null;
  }, [tab.filePath]);

  useEffect(() => {
    anchorCacheRef.current.clear();
  }, [nodes]);

  // Load content from backend when tab opens
  useEffect(() => {
    const nodeContent = (node as any)?.content;
    if (typeof nodeContent === 'string') {
      setContent(nodeContent);
    } else if (vault && tab.filePath) {
      readFile(tab.filePath)
        .then(text => {
          const loaded = text ?? '';
          setContent(loaded);
        })
        .catch(err => handleError(err, 'read file'));
    }
  }, [tab.filePath, vault]);

  // Scroll to initialLine when content first loads
  const scrolledForContentRef = useRef(false);
  useEffect(() => { scrolledForContentRef.current = false; }, [tab.filePath]);
  useEffect(() => {
    if (!tab.initialLine || !content || !editorRef.current) return;
    if (scrolledForContentRef.current) return;
    scrolledForContentRef.current = true;
    const editor = editorRef.current;
    const lineNum = Math.min(tab.initialLine, editor.getModel()?.getLineCount() || 1);
    editor.setPosition({ lineNumber: lineNum, column: 1 });
    editor.revealLineInCenter(lineNum);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-scroll when user clicks a search result for an already-open tab
  useEffect(() => {
    if (!tab.scrollNonce || !tab.initialLine || !editorRef.current) return;
    const editor = editorRef.current;
    const lineNum = Math.min(tab.initialLine, editor.getModel()?.getLineCount() || 1);
    editor.setPosition({ lineNumber: lineNum, column: 1 });
    editor.revealLineInCenter(lineNum);
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
      if (editorRef.current) editorRef.current.focus();
    }
  };

  const charCount = content.length;
  const lineCount = content ? content.split('\n').length : 1;
  const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
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
        insertAtCursor(view, fragments.join('\n\n'));
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

  const handleUpdateBadgeClick = async () => {
    const shouldUpdate = await confirm({
      title: 'Update available',
      message: 'A new version of Ibsidian is available. Update now?',
      confirmText: 'Update now',
      cancelText: 'Later',
    });
    if (!shouldUpdate) return;

    try {
      const result = await window.api.app.applyUpdate();
      await alert({ title: result.ok ? 'Update complete' : 'Update failed', message: result.message });
      if (result.ok) {
        localStorage.setItem(UPDATE_AVAILABLE_KEY, 'false');
        localStorage.removeItem(UPDATE_CURRENT_KEY);
        localStorage.removeItem(UPDATE_LATEST_KEY);
        window.dispatchEvent(new CustomEvent('ibsidian:update-status-changed'));
        const shouldRestart = await confirm({
          title: 'Restart required',
          message: 'Update installed. Restart now?',
          confirmText: 'Restart',
          cancelText: 'Later',
        });
        if (shouldRestart) await window.api.app.restart();
      }
    } catch (error) {
      await alert({ title: 'Update failed', message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <style>{`@keyframes _updateBlink{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
      
      {/* Editor */}
      <div ref={scrollAreaRef} style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', overflow: 'auto' }}>
          <div style={{ 
            height: '100%',
            maxWidth: 'none', 
            margin: 0, 
            padding: isCodeTab ? 0 : '16px 20px' 
          }}>
            <div
              onContextMenu={(event) => {
                if (isCodeTab) return;
                event.preventDefault();
                event.stopPropagation();
                setCtxMenu({ x: event.clientX, y: event.clientY });
              }}
              onMouseDownCapture={(event) => {
                if (isCodeTab || event.button !== 2) return;
                event.preventDefault();
                event.stopPropagation();
                setCtxMenu({ x: event.clientX, y: event.clientY });
              }}
              style={{ cursor: 'text', height: '100%', width: '100%' }}
            >
              <MonacoEditor
                value={content}
                onChange={handleChange}
                language={isCodeTab ? (tab.filePath?.split('.').pop() || 'text') : 'markdown'}
                filePath={tab.filePath}
                onContextMenu={(event) => {
                  if (isCodeTab) return;
                  event.preventDefault();
                  setCtxMenu({ x: event.clientX, y: event.clientY });
                }}
                onEditorMount={(editor) => {
                  editorRef.current = editor;
                  if (!isCodeTab && tab.initialLine) {
                    setTimeout(() => {
                      if (editor) {
                        const lineNum = Math.min(tab.initialLine, editor.getModel()?.getLineCount() || 1);
                        editor.setPosition({ lineNumber: lineNum, column: 1 });
                        editor.revealLineInCenter(lineNum);
                      }
                    }, 100);
                  }
                }}
              />
            </div>
            {!isCodeTab && ctxMenu && editorRef.current?.getView?.() && (
              <EditorContextMenu
                x={ctxMenu.x} y={ctxMenu.y}
                view={editorRef.current.getView()}
                onClose={() => setCtxMenu(null)}
                currentPath={tab.filePath}
              />
            )}
          </div>
        </div>
      </div>

      {/* Floating Status Bar */}
      <div style={{ 
        position: 'absolute', 
        bottom: 20, 
        right: 20, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        padding: '6px 12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 30,
        pointerEvents: 'none',
        opacity: 0.8,
        transition: 'opacity 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span>{isCodeTab ? (tab.filePath?.split('.').pop()?.toUpperCase() || 'TEXT') : 'MARKDOWN'}</span>
        </div>
        <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{isCodeTab ? `${lineCount} lines` : `${wordCount} words`}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{charCount} chars</span>
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
  return `${origin}/favicon.ico`;
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

const normalizeBrowserShortcut = (shortcut: Partial<BrowserShortcut>) => {
  const label = typeof shortcut.label === 'string' ? shortcut.label.trim() : '';
  const url = typeof shortcut.url === 'string' ? resolveBrowserUrl(shortcut.url) : '';
  if (!label || !url) return null;
  return { label, url };
};

const ShortcutFavicon: React.FC<{ url: string; label: string; theme: string; textColor: string }> = ({ url, label, theme, textColor }) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = (() => {
    const values: string[] = [];
    const add = (value?: string) => {
      const next = value?.trim();
      if (next && !values.includes(next)) values.push(next);
    };

    add(getBrowserFaviconForUrl(url));

    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        add(`${parsed.origin}/favicon.png`);
        add(`${parsed.origin}/apple-touch-icon.png`);
        add(`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsed.href)}&sz=64`);
      }
    } catch {
      // Ignore invalid URLs and fall back to text.
    }

    return values;
  })();

  useEffect(() => {
    setLoadFailed(false);
    setCandidateIndex(0);
  }, [url]);

  const handleError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex(i => i + 1);
      return;
    }
    setLoadFailed(true);
  };

  const src = candidates[candidateIndex];

  if (!src || loadFailed) {
    return (
      <span style={{
        fontSize: '1.2rem',
        color: textColor,
        fontWeight: 500,
        lineHeight: 1,
      }}>
        {label.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={handleError}
      style={{
        width: 24,
        height: 24,
        borderRadius: theme === 'dark' ? 7 : 6,
        objectFit: 'cover',
      }}
    />
  );
};

const buildBrowserLiteCss = (browser: AppSettings['browser']) => {
  if (!browser.liteMode) return '';
  const rules: string[] = [
    'html { scroll-behavior: auto !important; }',
  ];

  if (browser.disableAnimations) {
    rules.push(`
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
        caret-color: auto !important;
      }
    `);
  }

  if (browser.disableFilters) {
    rules.push(`
      *, *::before, *::after {
        filter: none !important;
        backdrop-filter: none !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
    `);
  }

  if (browser.blockImages) {
    rules.push(`
      img, picture, video, canvas, svg {
        visibility: hidden !important;
      }
      [style*="background-image"], [class*="bg-"] {
        background-image: none !important;
      }
    `);
  }

  return rules.join('\n');
};

const buildBrowserLiteScript = (browser: AppSettings['browser']) => `(() => {
  const options = ${JSON.stringify(browser)};
  const stateKey = '__ibsidianBrowserLiteState';
  const previous = window[stateKey];
  if (previous?.cleanup) {
    try { previous.cleanup(); } catch {}
  }

  if (!options.liteMode) {
    window[stateKey] = null;
    return true;
  }

  const disposers = [];

  if (options.disableVideoAutoplay) {
    const pauseMedia = (root) => {
      const target = root && root.querySelectorAll ? root : document;
      target.querySelectorAll('video, audio').forEach((media) => {
        try {
          media.autoplay = false;
          media.removeAttribute('autoplay');
          media.pause();
          media.preload = 'none';
        } catch {}
      });
    };

    pauseMedia(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          pauseMedia(node);
          if (node.matches?.('video, audio')) {
            try {
              node.autoplay = false;
              node.removeAttribute('autoplay');
              node.pause();
              node.preload = 'none';
            } catch {}
          }
        });
      });
    });

    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    disposers.push(() => observer.disconnect());
  }

  window[stateKey] = {
    cleanup: () => {
      disposers.forEach((dispose) => {
        try { dispose(); } catch {}
      });
    },
  };

  return true;
})();`;

const BrowserTab: React.FC<{ tab: any }> = ({ tab }) => {
  const webviewRef = useRef<any>(null);
  const { updateTabTitle, updateTabUrl, updateTabFavicon, updateTabLoading, openTab } = useTabs();
  const { addToHistory, updateHistoryTitle } = useLibrary();
  const { settings, updateBrowserSettings } = useAppSettings();
  const { theme } = useActivity();
  const browserSettings = settings.browser;
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
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; shortcut: BrowserShortcut } | null>(null);
  const [isAddingShortcut, setIsAddingShortcut] = useState(false);
  const [editingShortcutUrl, setEditingShortcutUrl] = useState<string | null>(null);
  const [shortcutLabel, setShortcutLabel] = useState('');
  const [shortcutUrl, setShortcutUrl] = useState('');
  const [pageCtxMenu, setPageCtxMenu] = useState<{
    x: number;
    y: number;
    linkURL?: string;
    selectionText?: string;
    isEditable?: boolean;
    srcURL?: string;
  } | null>(null);
  const browserCssKeyRef = useRef<string | null>(null);
  const browserSettingsRef = useRef(browserSettings);

  const resetShortcutForm = () => {
    setIsAddingShortcut(false);
    setEditingShortcutUrl(null);
    setShortcutLabel('');
    setShortcutUrl('');
  };

  const handleContextMenu = (e: React.MouseEvent, shortcut: BrowserShortcut) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, shortcut });
  };

  useEffect(() => {
    const handleClick = () => {
      setCtxMenu(null);
      setPageCtxMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    browserSettingsRef.current = browserSettings;
  }, [browserSettings]);

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
  const groupIdRef = useRef<string | undefined>(tab.groupId);
  const groupNameRef = useRef<string | undefined>(typeof tab.customTitle === 'string' && tab.customTitle.trim().length > 0 ? tab.customTitle : tab.title);
  const updateTabTitleRef = useRef(updateTabTitle);
  const updateTabUrlRef = useRef(updateTabUrl);
  const updateTabFaviconRef = useRef(updateTabFavicon);
  const updateTabLoadingRef = useRef(updateTabLoading);
  useEffect(() => { currentUrlRef.current = currentUrl; }, [currentUrl]);
  useEffect(() => { tabIdRef.current = tab.id; }, [tab.id]);
  useEffect(() => { groupIdRef.current = tab.groupId; }, [tab.groupId]);
  useEffect(() => {
    groupNameRef.current = typeof tab.customTitle === 'string' && tab.customTitle.trim().length > 0
      ? tab.customTitle
      : tab.title;
  }, [tab.customTitle, tab.title]);
  useEffect(() => { updateTabTitleRef.current = updateTabTitle; }, [updateTabTitle]);
  useEffect(() => { updateTabUrlRef.current = updateTabUrl; }, [updateTabUrl]);
  useEffect(() => { updateTabFaviconRef.current = updateTabFavicon; }, [updateTabFavicon]);
  useEffect(() => { updateTabLoadingRef.current = updateTabLoading; }, [updateTabLoading]);

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

  const applyBrowserLitePolicies = async (wv: any) => {
    const next = browserSettingsRef.current;
    const css = buildBrowserLiteCss(next);

    if (browserCssKeyRef.current) {
      try { await wv.removeInsertedCSS?.(browserCssKeyRef.current); } catch {}
      browserCssKeyRef.current = null;
    }

    if (css) {
      try {
        browserCssKeyRef.current = await wv.insertCSS(css);
      } catch {}
    }

    try {
      await wv.executeJavaScript(buildBrowserLiteScript(next));
    } catch {}
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
      const nextTitle = deriveBrowserTitle(nextUrl);
      const nextFavicon = getBrowserFaviconForUrl(nextUrl);
      setInputUrl(nextUrl);
      setCurrentUrl(nextUrl);
      currentUrlRef.current = nextUrl;
      updateTabUrlRef.current(tabIdRef.current, nextUrl);
      updateTabTitleRef.current(tabIdRef.current, nextTitle);
      updateTabFaviconRef.current(tabIdRef.current, nextFavicon);
      addToHistory({
        url: nextUrl,
        title: nextTitle,
        faviconUrl: nextFavicon,
        visitedAt: Date.now(),
        groupId: groupIdRef.current,
        groupName: groupNameRef.current,
      });
      updateNavState(wv);
    };
    const onTitle = (e: any) => {
      const nextTitle = typeof e?.title === 'string' && e.title.trim()
        ? e.title.trim()
        : deriveBrowserTitle(currentUrlRef.current);
      updateTabTitleRef.current(tabIdRef.current, nextTitle);
      updateHistoryTitle(currentUrlRef.current, nextTitle, undefined, groupIdRef.current);
    };
    const onFavicon = (e: any) => {
      const favicons = Array.isArray(e?.favicons) ? e.favicons.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : [];
      const favicon = favicons[0];
      if (!favicon) return;
      cacheBrowserFavicon(currentUrlRef.current, favicon);
      updateTabFaviconRef.current(tabIdRef.current, favicon);
      updateHistoryTitle(currentUrlRef.current, deriveBrowserTitle(currentUrlRef.current), favicon, groupIdRef.current);
    };
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    const done = () => { if (stopTimer) clearTimeout(stopTimer); stopTimer = null; setIsLoading(false); updateTabLoadingRef.current(tabIdRef.current, false); updateNavState(wv); };
    const onStartLoad   = () => { if (stopTimer) clearTimeout(stopTimer); setIsLoading(true); updateTabLoadingRef.current(tabIdRef.current, true); updateNavState(wv); };
    const onFinishLoad  = () => done();
    const onFailLoad    = () => done();
    const onStopLoad    = () => { stopTimer = setTimeout(done, 300); };
    const onDomReady    = () => {
      updateNavState(wv);
      try { wv.setBackgroundColor?.(bgColor); } catch {}
      void applyBrowserLitePolicies(wv);
    };
    const onReload = (e: Event) => {
      const detail = (e as CustomEvent<{ tabId?: string }>).detail;
      if (detail?.tabId !== tabIdRef.current) return;
      wv.reload();
    };
    const onControl = (e: Event) => {
      const detail = (e as CustomEvent<{ tabId?: string; action?: 'back' | 'forward' | 'reload' | 'copy' | 'paste' | 'cut' | 'select-all' }>).detail;
      if (detail?.tabId !== tabIdRef.current) return;
      switch (detail.action) {
        case 'back':
          wv.goBack?.();
          break;
        case 'forward':
          wv.goForward?.();
          break;
        case 'reload':
          wv.reload?.();
          break;
        case 'copy':
          wv.copy?.();
          break;
        case 'paste':
          wv.paste?.();
          break;
        case 'cut':
          wv.cut?.();
          break;
        case 'select-all':
          wv.selectAll?.();
          break;
      }
    };
    const onContextMenu = (e: any) => {
      const params = e?.params ?? e ?? {};
      if (typeof e?.preventDefault === 'function') e.preventDefault();
      setPageCtxMenu({
        x: typeof params.x === 'number' ? params.x : 0,
        y: typeof params.y === 'number' ? params.y : 0,
        linkURL: typeof params.linkURL === 'string' && params.linkURL.trim() ? params.linkURL : undefined,
        selectionText: typeof params.selectionText === 'string' && params.selectionText.trim() ? params.selectionText : undefined,
        isEditable: typeof params.isEditable === 'boolean' ? params.isEditable : undefined,
        srcURL: typeof params.srcURL === 'string' && params.srcURL.trim() ? params.srcURL : undefined,
      });
    };
    const onBlur = () => {
      setPageCtxMenu(null);
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
    wv.addEventListener('context-menu', onContextMenu as EventListener);
    wv.addEventListener('blur', onBlur);
    window.addEventListener('ibsidian:browser-tab-reload', onReload as EventListener);
    window.addEventListener('ibsidian:browser-tab-control', onControl as EventListener);
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
      wv.removeEventListener('context-menu', onContextMenu as EventListener);
      wv.removeEventListener('blur', onBlur);
      if (stopTimer) clearTimeout(stopTimer);
      if (browserCssKeyRef.current) {
        try { wv.removeInsertedCSS?.(browserCssKeyRef.current); } catch {}
        browserCssKeyRef.current = null;
      }
      updateTabLoadingRef.current(tabIdRef.current, false);
      window.removeEventListener('ibsidian:browser-tab-reload', onReload as EventListener);
      window.removeEventListener('ibsidian:browser-tab-control', onControl as EventListener);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep webview background in sync with theme changes
  useEffect(() => {
    try { webviewRef.current?.setBackgroundColor?.(bgColor); } catch {}
  }, [bgColor]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    void applyBrowserLitePolicies(wv);
  }, [browserSettings]);

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
    const shortcuts = browserSettings.shortcuts;
    const saveShortcut = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const nextShortcut = normalizeBrowserShortcut({ label: shortcutLabel, url: shortcutUrl });
      if (!nextShortcut) return;
      const nextShortcuts = editingShortcutUrl
        ? shortcuts.map(existing => existing.url === editingShortcutUrl ? nextShortcut : existing)
        : [...shortcuts.filter(existing => existing.url !== nextShortcut.url), nextShortcut];
      await updateBrowserSettings({ shortcuts: nextShortcuts });
      resetShortcutForm();
    };
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
          <div style={{ marginTop: 48, display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, padding: '0 20px' }}>
            {shortcuts.map(s => (
              <button
                key={s.url}
                onClick={() => navigate(s.url)}
                onContextMenu={(e) => handleContextMenu(e, s)}
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
                }}>
                  <ShortcutFavicon url={s.url} label={s.label} theme={theme} textColor={textColor} />
                </div>
                <span style={{ fontSize: '0.75rem' }}>{s.label}</span>
              </button>
            ))}
            {isAddingShortcut ? (
              <form
                onSubmit={saveShortcut}
                style={{
                  width: 220,
                  padding: 12,
                  borderRadius: 16,
                  background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={shortcutLabel}
                  onChange={(e) => setShortcutLabel(e.target.value)}
                  placeholder="Shortcut name"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: textColor,
                    outline: 'none',
                  }}
                  autoFocus
                />
                <input
                  type="text"
                  value={shortcutUrl}
                  onChange={(e) => setShortcutUrl(e.target.value)}
                  placeholder="https://example.com"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: textColor,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 10,
                      border: 'none',
                      background: '#4285f4',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {editingShortcutUrl ? 'Update' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={resetShortcutForm}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 10,
                      border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                      background: 'transparent',
                      color: dimColor,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingShortcut(true)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: dimColor,
                  transition: 'transform 0.2s, color 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.color = textColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.color = dimColor; }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                  color: textColor,
                }}>
                  <Plus size={20} />
                </div>
                <span style={{ fontSize: '0.75rem' }}>Add shortcut</span>
              </button>
            )}
          </div>
          {ctxMenu && (
            <div style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 1000,
              padding: '4px 0', minWidth: 160,
            }}>
              <button
                onClick={() => { navigate(ctxMenu.shortcut.url); setCtxMenu(null); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
                  background: 'transparent', border: 'none', fontSize: 13,
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                Open in this tab
              </button>
              <button
                onClick={() => { openTab({ type: 'browser', title: 'New Tab', url: ctxMenu.shortcut.url, groupId: '' }); setCtxMenu(null); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
                  background: 'transparent', border: 'none', fontSize: 13,
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                Open in new tab
              </button>
              <button
                onClick={() => {
                  setIsAddingShortcut(true);
                  setEditingShortcutUrl(ctxMenu.shortcut.url);
                  setShortcutLabel(ctxMenu.shortcut.label);
                  setShortcutUrl(ctxMenu.shortcut.url);
                  setCtxMenu(null);
                }}
                style={{
                  display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
                  background: 'transparent', border: 'none', fontSize: 13,
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                Edit shortcut
              </button>
              <button
                onClick={async () => {
                  await updateBrowserSettings({ shortcuts: shortcuts.filter(existing => existing.url !== ctxMenu.shortcut.url) });
                  resetShortcutForm();
                  setCtxMenu(null);
                }}
                style={{
                  display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left',
                  background: 'transparent', border: 'none', fontSize: 13,
                  color: '#dc2626', cursor: 'pointer',
                }}
              >
                Remove shortcut
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
              placeholder="Search web or type URL"
              style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
        </form>
      </div>
      {/* @ts-ignore - webview is an Electron-specific tag */}
      <webview ref={webviewRef} src={currentUrl} style={{ flex: 1, border: 'none', background: bgColor }} />
      {pageCtxMenu && (
        <div
          onMouseDown={() => setPageCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setPageCtxMenu(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'transparent',
          }}
        />
      )}
      {pageCtxMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: pageCtxMenu.x,
            top: pageCtxMenu.y,
            zIndex: 1000,
            minWidth: 220,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-md)',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <MenuItem icon={<ArrowLeft size={14} />} label="Back" disabled={!canGoBack} onClick={() => { webviewRef.current?.goBack?.(); setPageCtxMenu(null); }} />
          <MenuItem icon={<ArrowRight size={14} />} label="Forward" disabled={!canGoForward} onClick={() => { webviewRef.current?.goForward?.(); setPageCtxMenu(null); }} />
          <MenuItem icon={<RefreshCw size={14} />} label="Reload" onClick={() => { webviewRef.current?.reload?.(); setPageCtxMenu(null); }} />
          <MenuSep />
          {pageCtxMenu.linkURL && (
            <>
              <MenuItem icon={<ExternalLink size={14} />} label="Open link in new tab" onClick={() => {
                openTab({ type: 'browser', title: pageCtxMenu.linkURL!, url: pageCtxMenu.linkURL!, groupId: '' });
                setPageCtxMenu(null);
              }} />
              <MenuItem icon={<Copy size={14} />} label="Copy link" onClick={() => {
                navigator.clipboard.writeText(pageCtxMenu.linkURL!).catch(() => {});
                setPageCtxMenu(null);
              }} />
              <MenuSep />
            </>
          )}
          {pageCtxMenu.selectionText && (
            <>
              <MenuItem icon={<Copy size={14} />} label="Copy selection" onClick={() => {
                webviewRef.current?.copy?.();
                setPageCtxMenu(null);
              }} />
              <MenuItem icon={<Search size={14} />} label="Search selection" onClick={() => {
                openTab({ type: 'browser', title: pageCtxMenu.selectionText!, url: `https://www.google.com/search?q=${encodeURIComponent(pageCtxMenu.selectionText!)}`, groupId: '' });
                setPageCtxMenu(null);
              }} />
            </>
          )}
          {pageCtxMenu.isEditable && (
            <>
              <MenuItem icon={<Copy size={14} />} label="Copy" onClick={() => { webviewRef.current?.copy?.(); setPageCtxMenu(null); }} />
              <MenuItem icon={<Check size={14} />} label="Paste" onClick={() => { webviewRef.current?.paste?.(); setPageCtxMenu(null); }} />
              <MenuItem icon={<Trash2 size={14} />} label="Cut" onClick={() => { webviewRef.current?.cut?.(); setPageCtxMenu(null); }} />
              <MenuSep />
            </>
          )}
          <MenuItem icon={<Check size={14} />} label="Select all" onClick={() => { webviewRef.current?.selectAll?.(); setPageCtxMenu(null); }} />
        </div>
      )}
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
  const { activeTabId, updateTabCustomTitle, openTab } = useTabs();
  const [cols, setCols] = useState(80);
  const [rows, setRows] = useState(24);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const xtermTheme = {
    light: {
      background: '#ffffff',
      foreground: '#2e3338',
      cursor: '#7c3aed',
      selectionBackground: 'rgba(124, 58, 237, 0.3)',
    },
    dark: {
      background: '#1e1e1e',
      foreground: '#dcddde',
      cursor: '#7c3aed',
      selectionBackground: 'rgba(124, 58, 237, 0.3)',
    },
  };

  useEffect(() => {
    const handleClose = () => setCtxMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

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

    // Link handling: open in browser tab
    term.registerLinkProvider({
      provideLinks: (lineNumber, callback) => {
        const line = term.buffer.active.getLine(lineNumber - 1);
        if (!line) return callback(undefined);
        const text = line.translateToString(true);
        const urlRegex = /https?:\/\/[^\s"<>{}|\^~`[\]\\]+/g;
        const links: any[] = [];
        let match;
        while ((match = urlRegex.exec(text)) !== null) {
          const url = match[0];
          links.push({
            range: {
              start: { x: match.index + 1, y: lineNumber },
              end: { x: match.index + url.length, y: lineNumber }
            },
            text: url,
            activate: (event: MouseEvent, text: string) => {
              if (event.ctrlKey || event.metaKey) {
                openTab({ type: 'browser', title: text, url: text, groupId: '' });
              }
            },
            hover: (event: MouseEvent) => {
              if (terminalRef.current && (event.ctrlKey || event.metaKey)) {
                terminalRef.current.style.cursor = 'pointer';
              } else if (terminalRef.current) {
                terminalRef.current.style.cursor = '';
              }
            },
            leave: () => {
              if (terminalRef.current) {
                terminalRef.current.style.cursor = '';
              }
            }
          });
        }
        callback(links);
      }
    });

    setCols(term.cols);
    setRows(term.rows);

    // Create PTY session via IPC
    window.api.terminal.create(term.cols, term.rows, tab.cwd).then(sessionId => {
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

  const startEditing = useCallback(() => {
    setEditing(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  }, []);

  const doneEditing = useCallback((value: string) => {
    setEditing(false);
    const name = value.trim();
    if (name && name !== (tab.customTitle ?? tab.title)) {
      updateTabCustomTitle(tab.id, name);
    } else if (!name) {
      updateTabCustomTitle(tab.id, undefined);
    }
  }, [tab.id, tab.customTitle, tab.title, updateTabCustomTitle]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative' }}>
      <div
        style={{ height: 32, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, fontSize: 11, color: 'var(--text-muted)', cursor: 'default' }}
        onDoubleClick={() => { if (!editing) startEditing(); }}
        title="Double-click to rename"
      >
        {tab.type === 'claude' ? <ClaudeIcon size={12} /> : tab.type === 'codex' ? <CodexIcon size={12} /> : tab.type === 'pi' ? <PiIcon size={12} /> : <SquareTerminal size={12} />}
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={tab.customTitle ?? tab.title}
            onBlur={(e) => doneEditing(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doneEditing(e.currentTarget.value); if (e.key === 'Escape') setEditing(false); }}
            onClick={(e) => e.stopPropagation()}
            style={{
              height: 20, fontSize: 11, fontFamily: 'inherit',
              background: 'var(--bg-primary)', border: '1px solid var(--accent)',
              borderRadius: 3, padding: '0 4px', color: 'var(--text-primary)',
              outline: 'none', width: 'auto', minWidth: 60, flex: 1, maxWidth: 120,
            }}
          />
        ) : (
          <span style={{ cursor: 'text' }}>{tab.customTitle ?? (tab.type === 'claude' ? 'claude' : tab.type === 'codex' ? 'codex' : tab.type === 'pi' ? 'pi' : 'bash')} — {cols}×{rows}</span>
        )}
      </div>
      <div
        ref={terminalRef}
        style={{ flex: 1, padding: 8 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      />

      {ctxMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 1000,
            minWidth: 160,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-md)',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <MenuItem
            icon={<Copy size={14} />}
            label="Copy"
            disabled={!xtermRef.current?.hasSelection()}
            onClick={() => {
              const sel = xtermRef.current?.getSelection();
              if (sel) navigator.clipboard.writeText(sel);
              setCtxMenu(null);
            }}
          />
          <MenuItem
            icon={<Check size={14} />}
            label="Paste"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text && sessionIdRef.current) {
                  window.api.terminal.input(sessionIdRef.current, text);
                }
              } catch (err) {
                console.error('Failed to read clipboard', err);
              }
              setCtxMenu(null);
            }}
          />
          <MenuSep />
          <MenuItem
            icon={<Check size={14} />}
            label="Select all"
            onClick={() => {
              xtermRef.current?.selectAll();
              setCtxMenu(null);
            }}
          />
          <MenuSep />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Clear terminal"
            onClick={() => {
              xtermRef.current?.clear();
              setCtxMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
