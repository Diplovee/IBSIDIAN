import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Search, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Zap, LogOut, ChevronDown, ChevronRight, Pin } from 'lucide-react';
import { ProductivityIcon, CodexIcon } from './AgentIcons';
import { AgentActivityTimeline, AgentActivityItem } from './AgentActivityIndicator';
import { FileMentionInput, FileMention } from './FileMentionInput';
import { MessageActions, RichText, StyledMarkdown, ToolVisualization, TypingDots } from './productivity/renderers';
import { VAULT_TOOLS, VISUAL_TOOL_NAMES, runTool } from './productivity/tools';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import type { Tab } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: string;
  mentions?: FileMention[];
}
interface Session { id: string; title: string; messages: Message[]; group: string; pinned?: boolean; activities?: AgentActivityItem[]; }
type Creds = { access: string; refresh: string; expires: number; accountId: string };

const CODEX_MODELS = [
  { id: 'gpt-5.1-codex-mini', label: 'Codex Mini' },
  { id: 'gpt-5.1-codex', label: 'Codex' },
  { id: 'gpt-5.2-codex', label: 'Codex v2' },
  { id: 'gpt-5.3-codex', label: 'Codex v3' },
] as const;
const DEFAULT_MODEL = 'gpt-5.1-codex';
const MAX_VISIBLE_PROJECTS = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateGroup(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 days';
  return 'Older';
}

function normalizeModelId(model: string | null | undefined): string {
  if (model === 'codex-mini-latest') return DEFAULT_MODEL;
  if (CODEX_MODELS.some(option => option.id === model)) return model as string;
  return DEFAULT_MODEL;
}

function buildChatTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(message => message.role === 'user');
  const source = firstUserMessage?.content?.trim();
  if (!source) return 'New chat';

  const cleaned = source
    .replace(/\s+/g, ' ')
    .replace(/^(hey|hi|hello|yo)\b[\s,!.:-]*/i, '')
    .replace(/^(can you|could you|please|help me|i need to|i want to|let'?s)\b[\s,!.:-]*/i, '')
    .replace(/^(umm+|um+|uh+)\b[\s,!.:-]*/i, '')
    .trim();
  const titleSource = cleaned || source;
  const firstClause = titleSource.split(/[.!?\n]/).find(part => part.trim().length > 0)?.trim() ?? titleSource;
  const words = firstClause.split(/\s+/).slice(0, 7).join(' ');
  const titled = words.replace(/\b\w/g, char => char.toUpperCase());
  return titled.length > 48 ? `${titled.slice(0, 45).trimEnd()}...` : titled;
}

function persistProductivityModel(model: string): string {
  const normalized = normalizeModelId(model);
  localStorage.setItem('productivity-model', normalized);
  return normalized;
}

async function getValidToken(creds: Creds, setCreds: (c: Creds) => void): Promise<string> {
  if (Date.now() < creds.expires - 60_000) return creds.access;
  const refreshed = await window.api.auth.codexRefresh();
  setCreds(refreshed);
  return refreshed.access;
}

// ── Input bar ─────────────────────────────────────────────────────────────────
const InputBar: React.FC<{ onSend: (text: string) => void; disabled?: boolean }> = ({ onSend, disabled }) => {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(() => {
    const t = val.trim();
    if (!t || disabled) return;
    onSend(t);
    setVal('');
    if (ref.current) ref.current.style.height = 'auto';
  }, [val, disabled, onSend]);

  return (
    <div style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', borderRadius: 999, border: '1px solid var(--border)', padding: '12px 12px 12px 20px', transition: 'border-color 0.15s' }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb,#8B5CF6 55%,var(--border))')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0, flexShrink: 0, lineHeight: 0 }}>
          <Plus size={22} strokeWidth={1.8} />
        </button>
        <textarea
          ref={ref}
          value={val}
          rows={1}
          placeholder="Ask anything"
          onChange={e => { setVal(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.5, fontFamily: 'inherit', maxHeight: 140, overflow: 'auto', padding: 0, margin: 0, display: 'block' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={send}
            disabled={!val.trim() || disabled}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: val.trim() && !disabled ? 'pointer' : 'default', background: val.trim() && !disabled ? 'var(--text-primary)' : 'var(--bg-primary)', color: val.trim() && !disabled ? 'var(--bg-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}
          >
            <Zap size={17} fill="currentColor" />
          </button>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8, paddingBottom: 4 }}>
        Productivity can make mistakes. Check important info.
      </div>
    </div>
  );
};

// ── Model picker (custom dropdown) ────────────────────────────────────────────
const ModelPicker: React.FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = CODEX_MODELS.find(m => m.id === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: disabled ? 'default' : 'pointer', outline: 'none', opacity: disabled ? 0.5 : 1 }}
      >
        {label}
        <ChevronDown size={12} style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 200, minWidth: 160, padding: 4 }}>
          {CODEX_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => { onChange(m.id); setOpen(false); }}
              style={{ width: '100%', textAlign: 'left', padding: '7px 12px', borderRadius: 6, border: 'none', background: m.id === value ? 'var(--bg-hover)' : 'none', color: m.id === value ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => { if (m.id !== value) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (m.id !== value) e.currentTarget.style.background = 'none'; }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Session context menu ──────────────────────────────────────────────────────
interface SessCtxMenu { x: number; y: number; id: string }

const SessionContextMenu: React.FC<{
  menu: SessCtxMenu;
  session: Session;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onPin: (id: string) => void;
}> = ({ menu, session, onClose, onDelete, onRename, onPin }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    setPos({ x: menu.x + r.width > vw ? vw - r.width - 8 : menu.x, y: menu.y + r.height > vh ? vh - r.height - 8 : menu.y });
  }, [menu.x, menu.y]);

  const btn = (label: string, icon: React.ReactNode, action: () => void, danger = false) => (
    <button
      key={label}
      onClick={() => { action(); onClose(); }}
      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: 'none', background: 'none', color: danger ? '#f87171' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', borderRadius: 6 }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >{icon}{label}</button>
  );

  return (
    <div ref={ref} style={{ position: 'fixed', top: pos.y, left: pos.x, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: '0 4px 20px rgba(0,0,0,0.22)', zIndex: 9999, minWidth: 160, padding: 4 }}>
      {btn(session.pinned ? 'Unpin' : 'Pin', <Pin size={13} />, () => onPin(menu.id))}
      {btn('Rename', <Pencil size={13} />, () => onRename(menu.id))}
      {btn('Delete', <MoreHorizontal size={13} />, () => onDelete(menu.id), true)}
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar: React.FC<{
  sessions: Session[];
  projects: string[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string) => void;
}> = ({ sessions, projects, activeId, onSelect, onNew, onDelete, onRename, onPin }) => {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<SessCtxMenu | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const groups = ['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Older'];
  const filtered = sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
  const visibleProjects = showAllProjects ? projects : projects.slice(0, MAX_VISIBLE_PROJECTS);

  const openCtx = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, id });
  };

  const commitRename = (id: string, value: string) => {
    const nextTitle = value.trim();
    if (nextTitle) onRename(id, nextTitle);
    setRenaming(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 10px 8px', flexShrink: 0 }}>
        <button
          onClick={onNew}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'background 0.1s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <Plus size={16} /> New chat
        </button>
        <button
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, transition: 'background 0.1s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={() => setShowSearch(s => !s)}
        >
          <Search size={15} /> Search chats
        </button>
      </div>

      {showSearch && (
        <div style={{ padding: '0 10px 8px' }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {projects.length > 0 && (
        <div style={{ padding: '4px 10px', flexShrink: 0 }}>
          <button
            onClick={() => setProjectsOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {projectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Projects
          </button>
          {projectsOpen && (
            <>
              {visibleProjects.map(p => (
                <button
                  key={p}
                  style={{ width: '100%', textAlign: 'left', padding: '5px 12px', borderRadius: 7, border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {p}
                </button>
              ))}
              {projects.length > MAX_VISIBLE_PROJECTS && !showAllProjects && (
                <button
                  onClick={() => setShowAllProjects(true)}
                  style={{ width: '100%', textAlign: 'left', padding: '4px 12px', borderRadius: 6, border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  …{projects.length - MAX_VISIBLE_PROJECTS} more
                </button>
              )}
              {showAllProjects && projects.length > MAX_VISIBLE_PROJECTS && (
                <button
                  onClick={() => setShowAllProjects(false)}
                  style={{ width: '100%', textAlign: 'left', padding: '4px 12px', borderRadius: 6, border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  Show less
                </button>
              )}
            </>
          )}
          <div style={{ width: 'calc(100% - 20px)', margin: '4px 10px', height: 1, background: 'var(--border)' }} />
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px' }}>
        {sessions.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', padding: '4px 12px 6px', textTransform: 'uppercase' }}>Recents</div>
        )}
        {groups.map(group => {
          const items = group === 'Pinned'
            ? filtered.filter(s => s.pinned)
            : filtered.filter(s => !s.pinned && s.group === group);
          if (!items.length) return null;
          return (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 12px 4px', opacity: 0.6 }}>{group}</div>
              {items.map(s => (
                <div
                  key={s.id}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {renaming?.id === s.id ? (
                    <input
                      autoFocus
                      value={renaming.value}
                      onChange={e => setRenaming(r => r ? { ...r, value: e.target.value } : r)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(s.id, renaming.value);
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onBlur={() => commitRename(s.id, renaming.value)}
                      style={{ width: '100%', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <button
                      onClick={() => onSelect(s.id)}
                      onContextMenu={e => openCtx(e, s.id)}
                      style={{ width: '100%', textAlign: 'left', padding: '6px 28px 6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, background: activeId === s.id ? 'var(--bg-hover)' : 'none', color: activeId === s.id ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'background 0.1s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      onMouseEnter={e => { if (activeId !== s.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { if (activeId !== s.id) e.currentTarget.style.background = 'none'; }}
                    >
                      {s.pinned && <Pin size={10} style={{ display: 'inline', marginRight: 5, opacity: 0.5, verticalAlign: 'middle' }} />}
                      {s.title}
                    </button>
                  )}
                  {hoveredId === s.id && renaming?.id !== s.id && (
                    <button
                      onClick={e => openCtx(e, s.id)}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 5, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {ctxMenu && (() => {
        const sess = sessions.find(s => s.id === ctxMenu.id);
        if (!sess) return null;
        return (
          <SessionContextMenu
            menu={ctxMenu}
            session={sess}
            onClose={() => setCtxMenu(null)}
            onDelete={onDelete}
            onRename={id => setRenaming({ id, value: sessions.find(s => s.id === id)?.title ?? '' })}
            onPin={onPin}
          />
        );
      })()}
    </div>
  );
};

// ── Login modal ───────────────────────────────────────────────────────────────
const LoginModal: React.FC<{ onLogin: (creds: Creds) => void }> = ({ onLogin }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setPending(true);
    setError(null);
    try {
      // Tell main process to open the auth BrowserWindow
      await window.api.auth.codexStartLogin();

      // Listen for the token exchange result pushed back from main process
      const unlisten = window.api.auth.onCodexComplete((payload) => {
        unlisten();
        if (payload.error) {
          setError(payload.error);
          setPending(false);
        } else if (payload.creds) {
          onLogin(payload.creds as Creds);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setPending(false);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', zIndex: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-secondary)', maxWidth: 360, width: '100%', textAlign: 'center' }}>
        {/* Icon pair showing Productivity → ChatGPT connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ProductivityIcon size={28} />
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
            <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CodexIcon size={28} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Sign in to Productivity</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>Connect your ChatGPT account to get started. Your vault files stay local.</div>
        </div>
        <button
          onClick={handleLogin}
          disabled={pending}
          style={{ width: '100%', padding: '12px 24px', borderRadius: 10, border: 'none', background: pending ? 'var(--bg-hover)' : 'var(--text-primary)', color: pending ? 'var(--text-muted)' : 'var(--bg-primary)', fontSize: 15, fontWeight: 600, cursor: pending ? 'default' : 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          {pending ? (
            <>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', animation: '_spin 0.7s linear infinite' }} />
              Opening browser…
            </>
          ) : (
            <>
              <CodexIcon size={18} />
              Sign in with ChatGPT
            </>
          )}
        </button>
        {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
        <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const ProductivityChat: React.FC<{ tab: Tab }> = () => {
  const { openTab } = useTabs();
  const { vault, nodes } = useVault();

  const [creds, setCreds] = useState<Creds | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<AgentActivityItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [timelineCollapsed, setTimelineCollapsed] = useState(true);
  const [mentions, setMentions] = useState<FileMention[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => normalizeModelId(localStorage.getItem('productivity-model'))
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mentionsRef = useRef<FileMention[]>([]);

  const addMention = useCallback((mention: FileMention) => {
    setMentions(prev => {
      if (prev.some(item => item.path === mention.path)) {
        mentionsRef.current = prev;
        return prev;
      }
      const next = [...prev, mention];
      mentionsRef.current = next;
      return next;
    });
  }, []);

  const removeMention = useCallback((path: string) => {
    setMentions(prev => {
      const next = prev.filter(item => item.path !== path);
      mentionsRef.current = next;
      return next;
    });
  }, []);

  // Projects = top-level vault folders
  const projects = nodes.filter(n => n.type === 'folder').map(n => n.name);

  // File options for mention dropdown
  const fileOptions = nodes
    .filter(n => n.type === 'file')
    .map(n => ({ path: n.id, name: n.name }));

  // Load stored credentials on mount
  useEffect(() => {
    window.api.auth.codexGet()
      .then(c => { setCreds(c); setAuthLoading(false); })
      .catch(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    const normalized = persistProductivityModel(selectedModel);
    if (normalized !== selectedModel) {
      setSelectedModel(normalized);
    }
  }, [selectedModel]);

  // Load sessions from vault
  useEffect(() => {
    if (!vault) return;
    window.api.files.read('.pi/productivity-sessions.json')
      .then(raw => {
        const parsed = JSON.parse(raw) as Session[];
        setSessions(Array.isArray(parsed) ? parsed : []);
      })
      .catch(() => setSessions([]));
  }, [vault]);

  // Persist sessions to vault whenever they change
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!vault) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      window.api.files.write('.pi/productivity-sessions.json', JSON.stringify(sessions)).catch(() => {});
    }, 500);
    return () => { if (saveRef.current) clearTimeout(saveRef.current); };
  }, [sessions, vault]);

  // Auto-scroll (keep anchored without smooth jump)
  useEffect(() => {
    const scroller = scrollAreaRef.current;
    if (!scroller) return;

    const distanceToBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const shouldStickToBottom = isStreaming || distanceToBottom < 140;

    if (shouldStickToBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isStreaming]);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveSessionId(null);
    setMessages([]);
    setActivities([]);
    setTimelineCollapsed(true);
    setMentions([]);
    mentionsRef.current = [];
    setInputValue('');
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    abortRef.current?.abort();
    const session = sessions.find(s => s.id === id);
    setActiveSessionId(id);
    setMessages(session?.messages ?? []);
    setActivities(session?.activities ?? []);
    setTimelineCollapsed(true);
    setMentions([]);
    mentionsRef.current = [];
    setInputValue('');
  }, [sessions]);

  const handleLink = useCallback((url: string) => {
    openTab({ type: 'browser', title: url, url });
  }, [openTab]);

  const handleLogout = useCallback(async () => {
    await window.api.auth.codexLogout().catch(() => {});
    setCreds(null);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    abortRef.current?.abort();
    setSessions(prev => prev.filter(session => session.id !== id));
    if (id === activeSessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [activeSessionId]);

  const handleRenameSession = useCallback((id: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setSessions(prev => prev.map(session => session.id === id ? { ...session, title: nextTitle } : session));
  }, []);

  const handlePinSession = useCallback((id: string) => {
    setSessions(prev => prev.map(session => session.id === id ? { ...session, pinned: !session.pinned } : session));
  }, []);

  // ── Real AI send ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string, currentMentions: FileMention[] = []) => {
    if (!creds) return;

    const trimmedText = text.trim();
    if (!trimmedText) return;

    let currentSessionId = activeSessionId;
    const baseMessages = currentSessionId ? messages : [];
    const safeMentions = Array.isArray(currentMentions) ? currentMentions : [];
    const isFileReference = /\b(the|this|that)\s+files?\b/i.test(trimmedText);
    const inferredMentions = (safeMentions.length === 0 && isFileReference)
      ? [...baseMessages].reverse().find(message => message.role === 'user' && message.mentions && message.mentions.length > 0)?.mentions ?? []
      : [];
    const effectiveMentions = safeMentions.length > 0 ? safeMentions : inferredMentions;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedText,
      mentions: effectiveMentions.length > 0 ? effectiveMentions : undefined,
    };
    const currentMessages: Message[] = [...baseMessages, userMsg];

    setInputValue('');

    if (!currentSessionId) {
      const newId = `s_${Date.now()}`;
      const newSession: Session = { id: newId, title: buildChatTitle(currentMessages), messages: currentMessages, group: dateGroup(Date.now()), activities: [] };
      setSessions(s => [newSession, ...s]);
      currentSessionId = newId;
      setActiveSessionId(newId);
    }

    setMessages(currentMessages);

    setIsStreaming(true);
    abortRef.current = new AbortController();
    setActivities([]);
    setTimelineCollapsed(true);
    setMentions([]);
    mentionsRef.current = [];
    
    // Build mention context for system prompt
    const mentionContext = effectiveMentions.length > 0 
      ? `\nUser mentioned the following files: ${effectiveMentions.map(m => `@${m.path}`).join(', ')}. You can use read_file to access them if needed.`
      : '';

    const systemPrompt = `You are a personal productivity assistant embedded in a note-taking app (IBSIDIAN). You have access to the user's vault files and can read, write, and list them. You can also generate visual outputs using tools (tables, pie charts, and graphs). Be concise and action-oriented. Today is ${new Date().toLocaleDateString()}.${mentionContext}`;

    // Build input array for the Codex Responses API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toApiInput = (msgs: Message[]): any[] => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any[] = [];
      for (const m of msgs) {
        if (m.role === 'user') {
          const content = [{ type: 'input_text', text: m.content }];
          if (m.mentions && m.mentions.length > 0) {
            content.push({
              type: 'input_text',
              text: `Mentioned files: ${m.mentions.map(mention => `@${mention.path}`).join(', ')}. If the request refers to these files, use read_file with the exact path.`,
            });
          }
          result.push({ role: 'user', content });
        } else if (m.role === 'assistant' && m.content) {
          result.push({ role: 'assistant', content: [{ type: 'output_text', text: m.content }] });
        } else if (m.role === 'tool') {
          result.push({ type: 'function_call', call_id: m.toolCallId ?? '', name: m.toolName ?? '', arguments: m.toolArgs ?? '{}' });
          result.push({ type: 'function_call_output', call_id: m.toolCallId ?? '', output: m.content });
        }
      }
      return result;
    };

    // Agentic loop: stream → handle tool calls → stream again
    const agentLoop = async (msgs: Message[], model: string): Promise<void> => {
      let token = '';
      try {
        token = await getValidToken(creds, setCreds);
      } catch {
        const errMsg: Message = { id: Date.now().toString(), role: 'assistant', content: 'Failed to refresh credentials. Please sign in again.' };
        setMessages(prev => [...prev, errMsg]);
        setIsStreaming(false);
        return;
      }

      let assistantContent = '';
      const assistantId = `a_${Date.now()}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCalls: any[] = [];

      // Add placeholder BEFORE fetch so errors can replace it
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);
      
      // Add initial activity
      const analyzingId = `act_${Date.now()}_analyzing`;
      setActivities(prev => [...prev, {
        id: analyzingId,
        type: 'analyzing',
        message: 'Processing your request',
        timestamp: Date.now(),
      }]);

      try {
        const res = await fetch('https://chatgpt.com/backend-api/codex/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'chatgpt-account-id': creds.accountId,
            'OpenAI-Beta': 'responses=experimental',
            'accept': 'text/event-stream',
            'originator': 'pi',
          },
          signal: abortRef.current!.signal,
          body: JSON.stringify({
            model,
            store: false,
            stream: true,
            instructions: systemPrompt,
            input: toApiInput(msgs),
            tools: VAULT_TOOLS,
            tool_choice: 'auto',
            text: { verbosity: 'medium' },
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`API error ${res.status}: ${errText}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (!value) continue;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') { done = true; break; }
            let parsed: Record<string, unknown>;
            try { parsed = JSON.parse(data); } catch { continue; }

            const evtType = parsed.type as string | undefined;
            if (evtType === 'response.output_text.delta') {
              assistantContent += (parsed.delta as string) ?? '';
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
            } else if (evtType === 'response.output_item.done') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const item = parsed.item as any;
              if (item?.type === 'function_call') {
                toolCalls.push({ id: item.call_id, name: item.name, args: item.arguments ?? '{}' });
              }
            } else if (evtType === 'response.completed') {
              done = true;
            } else if (evtType === 'error') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const errData = parsed as any;
              throw new Error(errData.message ?? errData.error?.message ?? 'Stream error');
            }
          }
        }

      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          if (!assistantContent) setMessages(prev => prev.filter(m => m.id !== assistantId));
          setIsStreaming(false);
          return;
        }
        const errMsg: Message = { id: assistantId, role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` };
        setMessages(prev => prev.map(m => m.id === assistantId ? errMsg : m));
        
        // Add error activity
        const errorId = `act_${Date.now()}_error`;
        setActivities(prev => [...prev, {
          id: errorId,
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        }]);
        
        setIsStreaming(false);
        return;
      }

      // Finalize assistant message
      const assistantMsg: Message = { id: assistantId, role: 'assistant', content: assistantContent };
      let updatedMsgs = [...msgs, assistantMsg];
      setMessages(prev => prev.map(m => m.id === assistantId ? assistantMsg : m));

      // Handle tool calls
      if (toolCalls.length > 0) {
        // Add planning activity
        const planningId = `act_${Date.now()}_planning`;
        setActivities(prev => [...prev, {
          id: planningId,
          type: 'planning',
          message: `Planning ${toolCalls.length} action${toolCalls.length > 1 ? 's' : ''}`,
          timestamp: Date.now(),
        }]);

        const toolResultMsgs: Message[] = [];
        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.args); } catch { /* ignore */ }

          const detailText = typeof args.path === 'string'
            ? args.path
            : typeof args.content === 'string'
              ? args.content.slice(0, 50)
              : JSON.stringify(args).slice(0, 30);

          // Add tool execution activity
          const toolType = tc.name === 'read_file' ? 'reading' : tc.name === 'write_file' ? 'writing' : tc.name === 'list_files' ? 'listing' : 'planning';
          const toolActivityId = `act_${Date.now()}_${tc.name}`;
          setActivities(prev => [...prev, {
            id: toolActivityId,
            type: toolType,
            message: `Executing ${tc.name}`,
            details: detailText,
            timestamp: Date.now(),
          }]);

          const result = await runTool(tc.name, args);
          const toolMsg: Message = {
            id: `tr_${Date.now()}_${tc.id}`,
            role: 'tool',
            content: result,
            toolCallId: tc.id,
            toolName: tc.name,
            toolArgs: tc.args,
          };
          toolResultMsgs.push(toolMsg);
        }
        updatedMsgs = [...updatedMsgs, ...toolResultMsgs];
        setMessages(prev => [...prev, ...toolResultMsgs]);

        // Add complete activity
        const completeId = `act_${Date.now()}_complete`;
        setActivities(prev => [...prev, {
          id: completeId,
          type: 'complete',
          message: 'All actions completed',
          timestamp: Date.now(),
        }]);

        // Continue the loop with tool results
        await agentLoop(updatedMsgs, model);
        return;
      }

      // Add complete activity for non-tool-call responses
      const completeId = `act_${Date.now()}_complete`;
      setActivities(prev => [...prev, {
        id: completeId,
        type: 'complete',
        message: 'Response complete',
        timestamp: Date.now(),
      }]);

      // Save final session messages
      setMessages(prev => {
        const finalMsgs = prev;
        setSessions(ss => ss.map(s => s.id === currentSessionId ? { ...s, title: buildChatTitle(finalMsgs), messages: finalMsgs, activities } : s));
        return finalMsgs;
      });
      setIsStreaming(false);
    };

    await agentLoop(currentMessages, selectedModel);
  }, [creds, activeSessionId, selectedModel, messages]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const isEmpty = !activeSessionId || messages.length === 0;

  if (authLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative' }}>

      {/* Login modal — shown when not authenticated */}
      {!creds && <LoginModal onLogin={setCreds} />}

      {/* Sidebar */}
      {sidebarOpen ? (
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ProductivityIcon size={18} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Productivity</span>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {creds && (
                <button
                  title="Sign out"
                  onClick={handleLogout}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <LogOut size={14} />
                </button>
              )}
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>
          <Sidebar
            sessions={sessions}
            projects={projects}
            activeId={activeSessionId}
            onSelect={handleSelectSession}
            onNew={handleNewChat}
            onDelete={handleDeleteSession}
            onRename={handleRenameSession}
            onPin={handlePinSession}
          />
        </div>
      ) : (
        <div style={{ width: 48, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 4 }}>
          {[
            { icon: <PanelLeftOpen size={18} />, onClick: () => setSidebarOpen(true), title: 'Open sidebar' },
            { icon: <Pencil size={17} />, onClick: handleNewChat, title: 'New chat' },
            { icon: <Search size={17} />, onClick: () => setSidebarOpen(true), title: 'Search chats' },
          ].map(({ icon, onClick, title }) => (
            <button
              key={title}
              title={title}
              onClick={onClick}
              style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8, flexShrink: 0 }}>
          <ModelPicker
            value={selectedModel}
            onChange={value => setSelectedModel(persistProductivityModel(value))}
            disabled={isStreaming}
          />
          {messages.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={handleNewChat}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Plus size={13} /> New chat
              </button>
            </div>
          )}
        </div>

        {isEmpty ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px 80px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 40, textAlign: 'center' }}>
              What's on the agenda today?
            </h1>
            <FileMentionInput 
              value={inputValue} 
              onChange={setInputValue}
              onSend={() => handleSend(inputValue, mentionsRef.current)}
              disabled={isStreaming || !creds}
              mentions={mentions}
              onAddMention={addMention}
              onRemoveMention={removeMention}
              fileOptions={fileOptions}
            />
          </div>
        ) : (
          <>
            <div ref={scrollAreaRef} style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>
              <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {(() => {
                  const assistantMsgs = messages.filter(m => m.role === 'assistant');
                  const lastAssistantId = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].id : null;
                  return messages
                    .filter(msg => msg.role !== 'tool' || VISUAL_TOOL_NAMES.has(msg.toolName ?? ''))
                    .map(msg => (
                      <div key={msg.id}>
                        {msg.role === 'user' ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ maxWidth: '70%', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, padding: '10px 18px' }}>
                              {msg.mentions && msg.mentions.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                                  {msg.mentions.map(m => (
                                    <button
                                      key={m.path}
                                      onClick={() => openTab({ type: 'file', path: m.path, title: m.title })}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        padding: '2px 6px 2px 8px',
                                        borderRadius: 4,
                                        background: 'rgba(139, 92, 246, 0.15)',
                                        border: '1px solid rgba(139, 92, 246, 0.3)',
                                        color: '#8B5CF6',
                                        fontSize: 10,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                      </svg>
                                      <span style={{ fontWeight: 500 }}>{m.title}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <RichText text={msg.content} onLink={handleLink} />
                            </div>
                          </div>
                        ) : msg.role === 'assistant' ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {activities.length > 0 && msg.id === lastAssistantId && (
                              <AgentActivityTimeline
                                activities={activities}
                                isActive={isStreaming}
                                collapsed={timelineCollapsed}
                                onToggleCollapse={() => setTimelineCollapsed(c => !c)}
                              />
                            )}
                            <div style={{ alignSelf: 'flex-start', maxWidth: '70%', borderRadius: 6, background: 'var(--bg-secondary)', padding: '10px 18px', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5 }}>
                              <StyledMarkdown text={msg.content} onLink={handleLink} />
                            </div>
                            {msg.content && <MessageActions content={msg.content} />}
                          </div>
                        ) : (
                          <ToolVisualization message={msg} />
                        )}
                      </div>
                    ));
                })()}
                 {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                   <div><TypingDots /></div>
                 )}
                <div ref={bottomRef} />
              </div>
            </div>
            <div style={{ flexShrink: 0, paddingBottom: 16 }}>
            <FileMentionInput 
              value={inputValue} 
              onChange={setInputValue}
              onSend={() => handleSend(inputValue, mentionsRef.current)}
              disabled={isStreaming || !creds}
              mentions={mentions}
              onAddMention={addMention}
              onRemoveMention={removeMention}
              fileOptions={fileOptions}
            />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
