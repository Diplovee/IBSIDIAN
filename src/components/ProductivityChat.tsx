import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Search, RotateCcw, Copy, ThumbsUp, ThumbsDown, Share2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Zap } from 'lucide-react';
import { ProductivityIcon } from './AgentIcons';
import type { Tab } from '../types';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }
interface Session { id: string; title: string; messages: Message[]; group: string; }

const MOCK_SESSIONS: Session[] = [
  { id: 's1', title: 'Morning routine optimization', messages: [], group: 'Today' },
  { id: 's2', title: 'Deep work scheduling', messages: [], group: 'Today' },
  { id: 's3', title: 'Project priority matrix', messages: [], group: 'Yesterday' },
  { id: 's4', title: 'Weekly review setup', messages: [], group: 'Yesterday' },
  { id: 's5', title: 'Focus timer strategies', messages: [], group: 'Previous 7 days' },
  { id: 's6', title: 'Email batching workflow', messages: [], group: 'Previous 7 days' },
  { id: 's7', title: 'Context switching reduction', messages: [], group: 'Previous 7 days' },
];

const MOCK_PROJECTS = ['Work Goals 2026', 'Personal Development', 'Side Projects'];

const MOCK_REPLIES = [
  "Noted. I'll keep that in mind as we work through your day.",
  "Good call. Protecting deep work time is one of the highest-leverage things you can do.",
  "That makes sense. Want me to break it into smaller steps so it feels less daunting?",
  "On it. I'd suggest tackling that first — it'll unblock everything downstream.",
  "This is a preview. Full AI integration is coming soon, but I hear you.",
  "Absolutely. Time-blocking that now means fewer decisions to make later.",
];

const DEMO_MESSAGES: Message[] = [
  { id: '1', role: 'user', content: 'hey' },
  { id: '2', role: 'assistant', content: "You again. Persistent. I'll give you that.\n\nWhat do you want?" },
];

// ─── Render text with **bold** support ───────────────────────────────────────
const RichText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j}>{p.slice(2, -2)}</strong>
              : <span key={j}>{p}</span>
          )}
        </React.Fragment>
      );
    })}
  </>
);

// ─── Action button row under assistant messages ───────────────────────────────
const MessageActions: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | 'up' | 'down'>(null);
  const btn = (content: React.ReactNode, onClick?: () => void, active = false) => (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px',
        borderRadius: 6, color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', transition: 'color 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = active ? 'var(--text-primary)' : 'var(--text-muted)')}
    >
      {content}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 6, marginLeft: 2 }}>
      {btn(<Copy size={14} />, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      {copied && <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 2 }}>Copied</span>}
      {btn(<ThumbsUp size={14} />, () => setLiked(l => l === 'up' ? null : 'up'), liked === 'up')}
      {btn(<ThumbsDown size={14} />, () => setLiked(l => l === 'down' ? null : 'down'), liked === 'down')}
      {btn(<Share2 size={14} />)}
      {btn(<RotateCcw size={14} />)}
      {btn(<MoreHorizontal size={14} />)}
    </div>
  );
};

// ─── Typing dots ─────────────────────────────────────────────────────────────
const TypingDots: React.FC = () => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
    <style>{`@keyframes _pcDot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}`}</style>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', animation: `_pcDot 1.2s ease-in-out ${i * 0.16}s infinite` }} />
    ))}
  </div>
);

// ─── Input bar ────────────────────────────────────────────────────────────────
const InputBar: React.FC<{ onSend: (text: string) => void; disabled?: boolean }> = ({ onSend, disabled }) => {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(() => {
    const t = val.trim();
    if (!t || disabled) return;
    onSend(t);
    setVal('');
    if (ref.current) { ref.current.style.height = 'auto'; }
  }, [val, disabled, onSend]);

  return (
    <div style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-secondary)',
          borderRadius: 999,
          border: '1px solid var(--border)',
          padding: '12px 12px 12px 20px',
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb,#8B5CF6 55%,var(--border))')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        {/* + button */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0, flexShrink: 0, lineHeight: 0 }}>
          <Plus size={22} strokeWidth={1.8} />
        </button>

        <textarea
          ref={ref}
          value={val}
          rows={1}
          placeholder="Ask anything"
          onChange={e => {
            setVal(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)',
            fontSize: 16, lineHeight: 1.5, fontFamily: 'inherit',
            maxHeight: 140, overflow: 'auto', padding: 0, margin: 0,
            display: 'block',
          }}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={send}
            disabled={!val.trim() || disabled}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              cursor: val.trim() && !disabled ? 'pointer' : 'default',
              background: val.trim() && !disabled ? 'var(--text-primary)' : 'var(--bg-primary)',
              color: val.trim() && !disabled ? 'var(--bg-primary)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s', flexShrink: 0,
            }}
          >
            <Zap size={17} fill="currentColor" />
          </button>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8, paddingBottom: 4 }}>
        Productivity can make mistakes. This is a mock preview.
      </div>
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar: React.FC<{
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}> = ({ sessions, activeId, onSelect, onNew }) => {
  const groups = ['Today', 'Yesterday', 'Previous 7 days'];
  const [search, setSearch] = useState('');
  const filtered = sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* New chat + search */}
      <div style={{ padding: '12px 10px 8px', flexShrink: 0 }}>
        <button
          onClick={onNew}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <Plus size={16} />
          New chat
        </button>
        <button
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: 13, transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={() => {}}
        >
          <Search size={15} />
          Search chats
        </button>
      </div>

      {/* Search input (when active) */}
      {search !== undefined && false && (
        <div style={{ padding: '0 10px 8px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
          />
        </div>
      )}

      {/* Projects */}
      <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', padding: '2px 12px 6px', textTransform: 'uppercase' }}>Projects</div>
        {MOCK_PROJECTS.map(p => (
          <button
            key={p}
            style={{
              width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: 7,
              border: 'none', background: 'none', color: 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer', transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ width: 'calc(100% - 20px)', margin: '4px 10px', height: 1, background: 'var(--border)' }} />

      {/* Recents */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', padding: '4px 12px 6px', textTransform: 'uppercase' }}>Recents</div>
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
                  style={{
                    width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: 7,
                    border: 'none', cursor: 'pointer', fontSize: 13,
                    background: activeId === s.id ? 'var(--bg-hover)' : 'none',
                    color: activeId === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'background 0.1s',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
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

// ─── Main component ───────────────────────────────────────────────────────────
export const ProductivityChat: React.FC<{ tab: Tab }> = () => {
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>('s1');
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const replyIdx = useRef(0);

  // If no active session, show empty state; otherwise show messages
  const isEmpty = !activeSessionId || messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    // load demo messages for first session, empty for others
    setMessages(id === 's1' ? DEMO_MESSAGES : []);
  }, []);

  const handleSend = useCallback((text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => {
      const next = [...prev, userMsg];
      // If first message in a new chat, create session
      if (!activeSessionId) {
        const newId = `s_${Date.now()}`;
        const newSession: Session = { id: newId, title: text.slice(0, 40), messages: next, group: 'Today' };
        setSessions(s => [newSession, ...s]);
        setActiveSessionId(newId);
      }
      return next;
    });
    setIsTyping(true);
    setTimeout(() => {
      const reply = MOCK_REPLIES[replyIdx.current % MOCK_REPLIES.length];
      replyIdx.current++;
      setIsTyping(false);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
    }, 800 + Math.random() * 500);
  }, [activeSessionId]);

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ProductivityIcon size={18} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Productivity</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          <Sidebar sessions={sessions} activeId={activeSessionId} onSelect={handleSelectSession} onNew={handleNewChat} />
        </div>
      )}

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Top bar (toggle + optional actions) */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8, flexShrink: 0 }}>
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          {messages.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={handleNewChat}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'none',
                  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Plus size={13} /> New chat
              </button>
            </div>
          )}
        </div>

        {isEmpty ? (
          /* ── Empty state ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px 80px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 40, textAlign: 'center' }}>
              What's on the agenda today?
            </h1>
            <InputBar onSend={handleSend} disabled={isTyping} />
          </div>
        ) : (
          /* ── Chat state ── */
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>
              <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {messages.map(msg => (
                  <div key={msg.id}>
                    {msg.role === 'user' ? (
                      /* User bubble — pill, right-aligned */
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          maxWidth: '70%',
                          padding: '10px 18px',
                          borderRadius: 999,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}>
                          <RichText text={msg.content} />
                        </div>
                      </div>
                    ) : (
                      /* Assistant — plain text, no bubble */
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.65 }}>
                          <RichText text={msg.content} />
                        </div>
                        <MessageActions />
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div>
                    <TypingDots />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input pinned to bottom */}
            <div style={{ flexShrink: 0, paddingBottom: 16 }}>
              <InputBar onSend={handleSend} disabled={isTyping} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
