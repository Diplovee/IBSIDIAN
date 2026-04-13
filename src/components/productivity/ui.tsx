import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, LogOut, ChevronDown, ChevronRight, Pin } from 'lucide-react';
import { ProductivityIcon, CodexIcon } from '../AgentIcons';

const MAX_VISIBLE_PROJECTS = 4;
const GROUPS = ['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Older'];

interface SessionItem {
  id: string;
  title: string;
  group: string;
  pinned?: boolean;
}

interface SessCtxMenu { x: number; y: number; id: string }

const SessionContextMenu: React.FC<{
  menu: SessCtxMenu;
  session: SessionItem;
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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
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

export const ModelPicker: React.FC<{ models: readonly { id: string; label: string }[]; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ models, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = models.find(m => m.id === value)?.label ?? value;

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
          {models.map(m => (
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

export const Sidebar: React.FC<{
  sessions: SessionItem[];
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

  const filtered = sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
  const visibleProjects = showAllProjects ? projects : projects.slice(0, MAX_VISIBLE_PROJECTS);

  const openCtx = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
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
        {GROUPS.map(group => {
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

export type LoginCreds = { access: string; refresh: string; expires: number; accountId: string };

export const LoginModal: React.FC<{ onLogin: (creds: LoginCreds) => void }> = ({ onLogin }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setPending(true);
    setError(null);
    try {
      await window.api.auth.codexStartLogin();
      const unlisten = window.api.auth.onCodexComplete((payload) => {
        unlisten();
        if (payload.error) {
          setError(payload.error);
          setPending(false);
        } else if (payload.creds) {
          onLogin(payload.creds as LoginCreds);
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
