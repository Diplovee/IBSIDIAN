import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Search, RotateCcw, Copy, ThumbsUp, ThumbsDown, Share2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Zap, LogOut } from 'lucide-react';
import { ProductivityIcon, CodexIcon } from './AgentIcons';
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
}
interface Session { id: string; title: string; messages: Message[]; group: string; }
type Creds = { access: string; refresh: string; expires: number; accountId: string };

const CODEX_MODELS = [
  { id: 'codex-mini-latest', label: 'Codex Mini (Latest)' },
  { id: 'gpt-5.1-codex-mini', label: 'Codex Mini' },
  { id: 'gpt-5.1-codex', label: 'Codex' },
  { id: 'gpt-5.2-codex', label: 'Codex v2' },
  { id: 'gpt-5.3-codex', label: 'Codex v3' },
] as const;
const DEFAULT_MODEL = 'codex-mini-latest';

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

async function getValidToken(creds: Creds, setCreds: (c: Creds) => void): Promise<string> {
  if (Date.now() < creds.expires - 60_000) return creds.access;
  const refreshed = await window.api.auth.codexRefresh();
  setCreds(refreshed);
  return refreshed.access;
}

// ── Tool definitions for the Codex Responses API ─────────────────────────────
const VAULT_TOOLS = [
  {
    type: 'function' as const,
    name: 'read_file',
    description: 'Read the content of a file in the vault. Use relative paths like "daily.md" or "folder/note.md".',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path to the file inside the vault' } },
      required: ['path'],
    },
  },
  {
    type: 'function' as const,
    name: 'write_file',
    description: 'Create or overwrite a file in the vault with the given content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to write, e.g. "notes/todo.md"' },
        content: { type: 'string', description: 'Full file content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    type: 'function' as const,
    name: 'list_files',
    description: 'List all files and folders in the vault as a JSON tree.',
    parameters: { type: 'object', properties: {} },
  },
];

async function runTool(name: string, args: Record<string, string>): Promise<string> {
  try {
    if (name === 'read_file') {
      return await window.api.files.read(args['path'] ?? '');
    }
    if (name === 'write_file') {
      await window.api.files.write(args['path'] ?? '', args['content'] ?? '');
      return `File "${args['path']}" written successfully.`;
    }
    if (name === 'list_files') {
      const tree = await window.api.files.tree();
      return JSON.stringify(tree, null, 2);
    }
    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ── Render text with bold + clickable URLs ────────────────────────────────────
const RichText: React.FC<{ text: string; onLink: (url: string) => void }> = ({ text, onLink }) => {
  const URL_RE = /https?:\/\/[^\s)\]>]+/g;
  const BOLD_RE = /\*\*([^*]+)\*\*/g;

  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const segments: React.ReactNode[] = [];
        let last = 0;
        const combined = new RegExp(`${URL_RE.source}|${BOLD_RE.source}`, 'g');
        let m: RegExpExecArray | null;
        combined.lastIndex = 0;
        while ((m = combined.exec(line)) !== null) {
          if (m.index > last) segments.push(<span key={`t${m.index}`}>{line.slice(last, m.index)}</span>);
          if (m[0].startsWith('http')) {
            const url = m[0];
            segments.push(
              <span
                key={`u${m.index}`}
                onClick={() => onLink(url)}
                style={{ color: '#8B5CF6', cursor: 'pointer', textDecoration: 'underline' }}
                title={url}
              >
                {url}
              </span>
            );
          } else if (m[1]) {
            segments.push(<strong key={`b${m.index}`}>{m[1]}</strong>);
          }
          last = m.index + m[0].length;
        }
        if (last < line.length) segments.push(<span key={`te${i}`}>{line.slice(last)}</span>);
        return (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {segments}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ── Action button row ─────────────────────────────────────────────────────────
const MessageActions: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | 'up' | 'down'>(null);
  const btn = (el: React.ReactNode, onClick?: () => void, active = false) => (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, color: active ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', transition: 'color 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = active ? 'var(--text-primary)' : 'var(--text-muted)')}
    >{el}</button>
  );
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 6, marginLeft: 2 }}>
      {btn(<Copy size={14} />, () => { navigator.clipboard.writeText(content).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      {copied && <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 2 }}>Copied</span>}
      {btn(<ThumbsUp size={14} />, () => setLiked(l => l === 'up' ? null : 'up'), liked === 'up')}
      {btn(<ThumbsDown size={14} />, () => setLiked(l => l === 'down' ? null : 'down'), liked === 'down')}
      {btn(<Share2 size={14} />)}
      {btn(<RotateCcw size={14} />)}
      {btn(<MoreHorizontal size={14} />)}
    </div>
  );
};

// ── Typing dots ───────────────────────────────────────────────────────────────
const TypingDots: React.FC = () => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
    <style>{`@keyframes _pcDot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}`}</style>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', animation: `_pcDot 1.2s ease-in-out ${i * 0.16}s infinite` }} />
    ))}
  </div>
);

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

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar: React.FC<{
  sessions: Session[];
  projects: string[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}> = ({ sessions, projects, activeId, onSelect, onNew }) => {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const groups = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
  const filtered = sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));

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
        <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', padding: '2px 12px 6px', textTransform: 'uppercase' }}>Projects</div>
          {projects.map(p => (
            <button
              key={p}
              style={{ width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: 7, border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {p}
            </button>
          ))}
          <div style={{ width: 'calc(100% - 20px)', margin: '4px 10px', height: 1, background: 'var(--border)' }} />
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px' }}>
        {sessions.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', padding: '4px 12px 6px', textTransform: 'uppercase' }}>Recents</div>
        )}
        {groups.map(group => {
          const items = filtered.filter(s => s.group === group);
          if (!items.length) return null;
          return (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 12px 4px', opacity: 0.6 }}>{group}</div>
              {items.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, background: activeId === s.id ? 'var(--bg-hover)' : 'none', color: activeId === s.id ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'background 0.1s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  onMouseEnter={e => { if (activeId !== s.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (activeId !== s.id) e.currentTarget.style.background = 'none'; }}
                >
                  {s.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('productivity-model') ?? DEFAULT_MODEL
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Projects = top-level vault folders
  const projects = nodes.filter(n => n.type === 'folder').map(n => n.name);

  // Load stored credentials on mount
  useEffect(() => {
    window.api.auth.codexGet()
      .then(c => { setCreds(c); setAuthLoading(false); })
      .catch(() => setAuthLoading(false));
  }, []);

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
    if (!vault || sessions.length === 0) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      window.api.files.write('.pi/productivity-sessions.json', JSON.stringify(sessions)).catch(() => {});
    }, 500);
    return () => { if (saveRef.current) clearTimeout(saveRef.current); };
  }, [sessions, vault]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveSessionId(null);
    setMessages([]);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    abortRef.current?.abort();
    const session = sessions.find(s => s.id === id);
    setActiveSessionId(id);
    setMessages(session?.messages ?? []);
  }, [sessions]);

  const handleLink = useCallback((url: string) => {
    openTab({ type: 'browser', title: url, url });
  }, [openTab]);

  const handleLogout = useCallback(async () => {
    await window.api.auth.codexLogout().catch(() => {});
    setCreds(null);
  }, []);

  // ── Real AI send ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!creds) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    let currentSessionId = activeSessionId;
    let currentMessages: Message[] = [];

    setMessages(prev => {
      const next = [...prev, userMsg];
      currentMessages = next;
      if (!currentSessionId) {
        const newId = `s_${Date.now()}`;
        const newSession: Session = { id: newId, title: text.slice(0, 50), messages: next, group: dateGroup(Date.now()) };
        setSessions(s => [newSession, ...s]);
        currentSessionId = newId;
        setActiveSessionId(newId);
      }
      return next;
    });

    setIsStreaming(true);
    abortRef.current = new AbortController();

    const systemPrompt = `You are a personal productivity assistant embedded in a note-taking app (IBSIDIAN). You have access to the user's vault files and can read, write, and list them. Be concise and action-oriented. Today is ${new Date().toLocaleDateString()}.`;

    // Build input array for the Codex Responses API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toApiInput = (msgs: Message[]): any[] => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any[] = [];
      for (const m of msgs) {
        if (m.role === 'user') {
          result.push({ role: 'user', content: [{ type: 'input_text', text: m.content }] });
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
        setIsStreaming(false);
        return;
      }

      // Finalize assistant message
      const assistantMsg: Message = { id: assistantId, role: 'assistant', content: assistantContent };
      let updatedMsgs = [...msgs, assistantMsg];
      setMessages(prev => prev.map(m => m.id === assistantId ? assistantMsg : m));

      // Handle tool calls
      if (toolCalls.length > 0) {
        const toolResultMsgs: Message[] = [];
        for (const tc of toolCalls) {
          let args: Record<string, string> = {};
          try { args = JSON.parse(tc.args); } catch { /* ignore */ }
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

        // Continue the loop with tool results
        await agentLoop(updatedMsgs, model);
        return;
      }

      // Save final session messages
      setMessages(prev => {
        const finalMsgs = prev;
        setSessions(ss => ss.map(s => s.id === currentSessionId ? { ...s, messages: finalMsgs } : s));
        return finalMsgs;
      });
      setIsStreaming(false);
    };

    await agentLoop(currentMessages, selectedModel);
  }, [creds, activeSessionId, selectedModel]);

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
          <Sidebar sessions={sessions} projects={projects} activeId={activeSessionId} onSelect={handleSelectSession} onNew={handleNewChat} />
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
          <select
            value={selectedModel}
            onChange={e => { setSelectedModel(e.target.value); localStorage.setItem('productivity-model', e.target.value); }}
            disabled={isStreaming}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', outline: 'none' }}
          >
            {CODEX_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
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
            <InputBar onSend={handleSend} disabled={isStreaming || !creds} />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>
              <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {messages.filter(m => m.role !== 'tool').map(msg => (
                  <div key={msg.id}>
                    {msg.role === 'user' ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ maxWidth: '70%', padding: '10px 18px', borderRadius: 999, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5 }}>
                          <RichText text={msg.content} onLink={handleLink} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.65 }}>
                          <RichText text={msg.content} onLink={handleLink} />
                        </div>
                        {msg.content && <MessageActions content={msg.content} />}
                      </div>
                    )}
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div><TypingDots /></div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
            <div style={{ flexShrink: 0, paddingBottom: 16 }}>
              <InputBar onSend={handleSend} disabled={isStreaming || !creds} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
