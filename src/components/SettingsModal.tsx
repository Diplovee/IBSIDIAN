import React, { useEffect, useRef, useState } from 'react';
import { X, Sun, Moon, Check, LogOut, ChevronDown } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { ClaudeIcon, CodexIcon, PiIcon, ProductivityIcon } from './AgentIcons';
import type { AgentKey } from '../types';

const CATEGORIES = [
  { id: 'general',      label: 'General' },
  { id: 'appearance',   label: 'Appearance' },
  { id: 'editor',       label: 'Editor' },
  { id: 'files',        label: 'Files & Links' },
  { id: 'agents',       label: 'Agents' },
  { id: 'productivity', label: 'Productivity' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

const PRODUCTIVITY_MODELS = [
  { id: 'gpt-5.2', label: 'GPT-5.2 — recommended' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
] as const;
const DEFAULT_PRODUCTIVITY_MODEL = 'gpt-5.2';

function normalizeProductivityModel(model: string | null | undefined): string {
  if (model === 'codex-mini-latest') return DEFAULT_PRODUCTIVITY_MODEL;
  if (PRODUCTIVITY_MODELS.some(option => option.id === model)) return model as string;
  return DEFAULT_PRODUCTIVITY_MODEL;
}

const SectionLabel: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: first ? 0 : 24 }}>
    {children}
  </div>
);

const OptionBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 0.1s' }}
  >
    {children}
  </button>
);

const ProductivityModelPicker: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = PRODUCTIVITY_MODELS.find(model => model.id === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handleClickAway = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 20 }}>
      <button
        onClick={() => setOpen(current => !current)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
      >
        <span>{label}</span>
        <ChevronDown size={14} style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: 4, zIndex: 40 }}>
          {PRODUCTIVITY_MODELS.map(model => (
            <button
              key={model.id}
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none', background: model.id === value ? 'var(--bg-hover)' : 'none', color: model.id === value ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => { if (model.id !== value) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (model.id !== value) e.currentTarget.style.background = 'none'; }}
            >
              {model.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const GeneralPanel: React.FC<{
  appVersion: string;
  aboutText: string;
  onOpenChangelog: () => void;
  updateStatus: string;
  updateBusy: boolean;
  updateLog: string;
  canRestartAfterUpdate: boolean;
  onCheckUpdates: () => void;
  onApplyUpdate: () => void;
  onRestartNow: () => void;
}> = ({ appVersion, aboutText, onOpenChangelog, updateStatus, updateBusy, updateLog, canRestartAfterUpdate, onCheckUpdates, onApplyUpdate, onRestartNow }) => (
  <div>
    <SectionLabel first>Version</SectionLabel>
    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>Ibsidian {appVersion}</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={onOpenChangelog}
        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
      >
        View changelog
      </button>
      <button
        onClick={onCheckUpdates}
        disabled={updateBusy}
        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: updateBusy ? 'default' : 'pointer', opacity: updateBusy ? 0.6 : 1 }}
      >
        {updateBusy ? 'Checking…' : 'Check updates'}
      </button>
      <button
        onClick={onApplyUpdate}
        disabled={updateBusy}
        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: updateBusy ? 'default' : 'pointer', opacity: updateBusy ? 0.6 : 1 }}
      >
        {updateBusy ? 'Updating…' : 'Update now'}
      </button>
      {canRestartAfterUpdate && (
        <button
          onClick={onRestartNow}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Restart now
        </button>
      )}
    </div>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>{updateStatus}</p>
    {updateLog && (
      <pre style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: 11, maxHeight: 140, overflow: 'auto', color: 'var(--text-secondary)' }}>
        {updateLog}
      </pre>
    )}
    <SectionLabel>About</SectionLabel>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{aboutText}</p>
  </div>
);

const AppearancePanel: React.FC = () => {
  const { theme, setTheme } = useActivity();
  const { settings, updateAppearanceSettings, updateFileTreeSettings } = useAppSettings();
  const fontSize = settings.appearance?.fontSize ?? 'medium';
  const compactMode = settings.appearance?.compactMode ?? false;

  return (
    <div>
      <SectionLabel first>Base color scheme</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        <OptionBtn active={theme === 'light'} onClick={() => setTheme('light')}>
          <Sun size={13} /> Light
        </OptionBtn>
        <OptionBtn active={theme === 'dark'} onClick={() => setTheme('dark')}>
          <Moon size={13} /> Dark
        </OptionBtn>
      </div>

      <SectionLabel>Font size</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['small', 'medium', 'large'] as const).map(s => (
          <OptionBtn key={s} active={fontSize === s} onClick={() => updateAppearanceSettings({ fontSize: s })}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </OptionBtn>
        ))}
      </div>

      <SectionLabel>Interface density</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        <OptionBtn active={!compactMode} onClick={() => updateAppearanceSettings({ compactMode: false })}>Default</OptionBtn>
        <OptionBtn active={compactMode} onClick={() => updateAppearanceSettings({ compactMode: true })}>Compact</OptionBtn>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
        Compact reduces file tree row height for a denser layout.
      </p>

      <SectionLabel>File tree style</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['original', 'hierarchy'] as const).map(s => (
          <OptionBtn key={s} active={settings.fileTree.style === s} onClick={() => updateFileTreeSettings({ style: s })}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </OptionBtn>
        ))}
      </div>
    </div>
  );
};

const EDITOR_PREFERENCE_KEY = 'editor';

const EditorPanel: React.FC = () => {
  const [editor, setEditor] = useState<'codemirror' | 'tiptap'>(() => (
    localStorage.getItem(EDITOR_PREFERENCE_KEY) === 'tiptap' ? 'tiptap' : 'codemirror'
  ));

  const setPreferredEditor = (next: 'codemirror' | 'tiptap') => {
    setEditor(next);
    localStorage.setItem(EDITOR_PREFERENCE_KEY, next);
    window.dispatchEvent(new CustomEvent('ibsidian:editor-preference-changed'));
  };

  return (
    <div>
      <SectionLabel first>Primary editor engine</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        <OptionBtn active={editor === 'codemirror'} onClick={() => setPreferredEditor('codemirror')}>
          CodeMirror
        </OptionBtn>
        <OptionBtn active={editor === 'tiptap'} onClick={() => setPreferredEditor('tiptap')}>
          TipTap (experimental)
        </OptionBtn>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
        Switches instantly for open notes. If TipTap causes issues, switch back to CodeMirror here.
      </p>
    </div>
  );
};

const FilesPanel: React.FC = () => {
  const { settings, updateAttachmentSettings } = useAppSettings();
  return (
    <div>
      <SectionLabel first>Default location for new attachments</SectionLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <OptionBtn
          active={settings.attachments.attachmentLocation === 'specific-folder'}
          onClick={() => updateAttachmentSettings({ attachmentLocation: 'specific-folder' })}
        >
          Specific folder
        </OptionBtn>
        <OptionBtn
          active={settings.attachments.attachmentLocation === 'same-folder-as-note'}
          onClick={() => updateAttachmentSettings({ attachmentLocation: 'same-folder-as-note' })}
        >
          Same folder as note
        </OptionBtn>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Default attachment folder</div>
      <input
        type="text"
        value={settings.attachments.attachmentFolderPath}
        disabled={settings.attachments.attachmentLocation !== 'specific-folder'}
        onChange={(e) => updateAttachmentSettings({ attachmentFolderPath: e.target.value })}
        placeholder="attachments/images"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: settings.attachments.attachmentLocation === 'specific-folder' ? 'var(--bg-primary)' : 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
      />
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
        New pasted or dropped images are saved inside the vault and embedded with `![[...]]`.
      </p>
    </div>
  );
};

const AGENT_DEFS: Record<AgentKey, { label: string; description: string; color?: string; hasGradient?: boolean; Icon: React.FC<{ size?: number }> }> = {
  claude:       { label: 'Claude',       description: "Anthropic's Claude Code CLI", color: '#D97757', Icon: ClaudeIcon },
  codex:        { label: 'Codex',        description: 'OpenAI Codex CLI', hasGradient: true, Icon: CodexIcon },
  pi:           { label: 'Pi',           description: 'Pi agent CLI', color: '#3B82F6', Icon: PiIcon },
  productivity: { label: 'Productivity', description: 'Personal productivity assistant', color: '#8B5CF6', Icon: ProductivityIcon },
};

const ALL_KEYS: AgentKey[] = ['claude', 'codex', 'pi', 'productivity'];

const AgentsPanel: React.FC = () => {
  const { settings, updateAgentSettings } = useAppSettings();
  const agents = settings.agents ?? { claude: true, codex: true, pi: true, productivity: true, order: ALL_KEYS as AgentKey[] };
  const order: AgentKey[] = agents.order?.length ? agents.order : ALL_KEYS;

  const dragSrc = useRef<AgentKey | null>(null);
  const [activeGap, setActiveGap] = useState<number | null>(null); // gap index: 0=before first, 1=between 0&1, etc.

  const handleDragStart = (e: React.DragEvent, key: AgentKey) => {
    dragSrc.current = key;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGapDragOver = (e: React.DragEvent, gapIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveGap(gapIdx);
  };

  const handleGapDrop = (e: React.DragEvent, gapIdx: number) => {
    e.preventDefault();
    const src = dragSrc.current;
    if (!src) { cleanup(); return; }
    const srcIdx = order.indexOf(src);
    // gapIdx is the position to insert before; adjust for removal
    const insertAt = gapIdx > srcIdx ? gapIdx - 1 : gapIdx;
    if (insertAt === srcIdx) { cleanup(); return; }
    const next = [...order];
    next.splice(srcIdx, 1);
    next.splice(insertAt, 0, src);
    updateAgentSettings({ order: next });
    cleanup();
  };

  const cleanup = () => { dragSrc.current = null; setActiveGap(null); };

  const handleToggle = (key: AgentKey) => {
    if (!agents[key]) {
      // Append to end of order so bar position = enable order
      const newOrder = [...order.filter(k => k !== key), key];
      updateAgentSettings({ [key]: true, order: newOrder });
    } else {
      updateAgentSettings({ [key]: false });
    }
  };

  // A gap zone between / around cards
  const Gap: React.FC<{ idx: number }> = ({ idx }) => (
    <div
      onDragOver={e => handleGapDragOver(e, idx)}
      onDrop={e => handleGapDrop(e, idx)}
      style={{ width: 16, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <div style={{
        width: 2, height: '80%', borderRadius: 1,
        background: activeGap === idx ? 'var(--accent)' : 'transparent',
        transition: 'background 0.1s',
      }} />
    </div>
  );

  return (
    <div onDragEnd={cleanup}>
      <SectionLabel first>Activity bar agents</SectionLabel>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Click to toggle — agents are added to the bar in the order you enable them. Drag to reorder.
      </p>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {order.map((key, idx) => {
          const { label, description, color, hasGradient, Icon } = AGENT_DEFS[key];
          const enabled = agents[key];
          const accentColor = color ?? '#888';
          const isDragging = dragSrc.current === key;

          return (
            <React.Fragment key={key}>
              <Gap idx={idx} />
              <div
                draggable
                onDragStart={e => handleDragStart(e, key)}
                style={{
                  width: 130, flexShrink: 0,
                  padding: '16px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${enabled ? accentColor : 'var(--border)'}`,
                  background: enabled
                    ? hasGradient
                      ? 'linear-gradient(135deg,rgba(244,114,182,.08) 0%,rgba(251,146,60,.08) 40%,rgba(251,191,36,.08) 70%,rgba(147,197,253,.10) 100%)'
                      : `color-mix(in srgb,${accentColor} 8%,var(--bg-secondary))`
                    : 'var(--bg-secondary)',
                  cursor: 'grab',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  transition: 'border-color .15s, background .15s, opacity .15s',
                  position: 'relative',
                  opacity: isDragging ? 0.4 : 1,
                  userSelect: 'none',
                }}
              >
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 7, height: 7, borderRadius: '50%',
                  background: enabled ? accentColor : 'var(--text-muted)',
                  opacity: enabled ? 1 : 0.4,
                  transition: 'background .15s',
                }} />
                <button
                  onClick={() => handleToggle(key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 0 }}
                >
                  <div style={{ filter: enabled ? 'none' : 'grayscale(1) opacity(0.35)', transition: 'filter .15s', display: 'flex' }}>
                    <Icon size={28} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: 2, transition: 'color .15s' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {description}
                    </div>
                  </div>
                </button>
              </div>
            </React.Fragment>
          );
        })}
        {/* trailing gap */}
        <Gap idx={order.length} />
      </div>
    </div>
  );
};

// ── Productivity panel ────────────────────────────────────────────────────────
type CodexCreds = { access: string; refresh: string; expires: number; accountId: string };

const ProductivityPanel: React.FC = () => {
  const [creds, setCreds] = useState<CodexCreds | null | 'loading'>('loading');
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => normalizeProductivityModel(localStorage.getItem('productivity-model')));

  useEffect(() => {
    window.api.auth.codexGet().then(c => setCreds(c)).catch(() => setCreds(null));
  }, []);

  useEffect(() => {
    const normalized = normalizeProductivityModel(selectedModel);
    localStorage.setItem('productivity-model', normalized);
    if (normalized !== selectedModel) setSelectedModel(normalized);
  }, [selectedModel]);

  const handleLogin = async () => {
    setLoginPending(true);
    setLoginError(null);
    try {
      await window.api.auth.codexStartLogin();
      const unlisten = window.api.auth.onCodexComplete((payload) => {
        unlisten();
        setLoginPending(false);
        if (payload.error) { setLoginError(payload.error); }
        else if (payload.creds) { setCreds(payload.creds as CodexCreds); }
      });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
      setLoginPending(false);
    }
  };

  const handleLogout = async () => {
    await window.api.auth.codexLogout().catch(() => {});
    setCreds(null);
  };

  const COMING_SOON = [
    { name: 'Groq', description: 'Ultra-fast inference with Llama & Mixtral' },
  ];

  return (
    <div>
      <SectionLabel first>Providers</SectionLabel>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Connect AI providers to power the Productivity agent.
      </p>

      {/* Codex / ChatGPT */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CodexIcon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>ChatGPT (Codex)</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {creds === 'loading' ? 'Checking…'
              : creds ? `Connected · ${creds.accountId ? `ID: ${creds.accountId.slice(0, 12)}…` : 'account linked'}`
              : 'Not connected'}
          </div>
        </div>
        {creds && creds !== 'loading' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#34d399', fontWeight: 500 }}>
              <Check size={13} /> Connected
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', transition: 'all 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loginPending || creds === 'loading'}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: loginPending ? 'default' : 'pointer', opacity: (loginPending || creds === 'loading') ? 0.6 : 1, flexShrink: 0, transition: 'background 0.1s' }}
            onMouseEnter={e => { if (!loginPending) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-primary)'; }}
          >
            {loginPending ? 'Opening…' : 'Connect'}
          </button>
        )}
      </div>
      {loginError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{loginError}</div>}

      <SectionLabel>Model</SectionLabel>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Choose the Codex model used by the Productivity agent.
      </p>
      <ProductivityModelPicker
        value={selectedModel}
        onChange={value => setSelectedModel(normalizeProductivityModel(value))}
      />

      {/* Coming soon providers */}
      {COMING_SOON.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', marginBottom: 10, opacity: 0.6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
            {p.name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.description}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0 }}>
            Coming soon
          </div>
        </div>
      ))}
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings } = useActivity();
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');
  const [hoveredNav, setHoveredNav] = useState<CategoryId | null>(null);
  const [isChangelogOpen, setChangelogOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('Unknown');
  const [changelogText, setChangelogText] = useState('Loading changelog...');
  const [updateStatus, setUpdateStatus] = useState('Updates can be checked from your local git clone.');
  const [updateLog, setUpdateLog] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [canRestartAfterUpdate, setCanRestartAfterUpdate] = useState(false);
  const aboutText = 'Ibsidian is a local-first desktop knowledge vault for notes, drawings, attachments, and research, built with Electron, React, and CodeMirror.';

  useEffect(() => {
    window.api.app.version().then(v => setAppVersion(v)).catch(() => {});
    window.api.app.changelog().then(text => setChangelogText(text ?? 'Failed to load changelog.')).catch(() => setChangelogText('Failed to load changelog.'));
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isChangelogOpen) setChangelogOpen(false);
        else closeSettings();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSettingsOpen, isChangelogOpen, closeSettings]);

  const handleCheckUpdates = async () => {
    setUpdateBusy(true);
    setUpdateLog('');
    try {
      const result = await window.api.app.checkForUpdates();
      const branch = result.branch || 'main';
      const hasUpdate = result.supported && result.updateAvailable;
      localStorage.setItem('ibsidian:update-available', hasUpdate ? 'true' : 'false');
      if (hasUpdate) {
        if (result.current) localStorage.setItem('ibsidian:update-current', result.current);
        if (result.latest) localStorage.setItem('ibsidian:update-latest', result.latest);
      } else {
        localStorage.removeItem('ibsidian:update-current');
        localStorage.removeItem('ibsidian:update-latest');
      }
      window.dispatchEvent(new CustomEvent('ibsidian:update-status-changed'));
      setCanRestartAfterUpdate(false);
      setUpdateStatus(`${result.message}${result.hasLocalChanges ? ' Local changes detected.' : ''}`);
      if (result.supported && result.current && result.latest) {
        setUpdateLog(`branch: ${branch}\ncurrent: ${result.current}\nlatest:  ${result.latest}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUpdateStatus(`Failed to check updates: ${message}`);
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleApplyUpdate = async () => {
    setUpdateBusy(true);
    try {
      const result = await window.api.app.applyUpdate();
      setUpdateStatus(result.message);
      setUpdateLog(result.log || '');
      setCanRestartAfterUpdate(result.ok);
      if (result.ok) {
        localStorage.setItem('ibsidian:update-available', 'false');
        localStorage.removeItem('ibsidian:update-current');
        localStorage.removeItem('ibsidian:update-latest');
        window.dispatchEvent(new CustomEvent('ibsidian:update-status-changed'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUpdateStatus(`Failed to update: ${message}`);
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleRestartNow = async () => {
    await window.api.app.restart();
  };

  if (!isSettingsOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.25)' }}
      onClick={() => {
        if (isChangelogOpen) setChangelogOpen(false);
        else closeSettings();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(780px, calc(100vw - 32px))', height: 'min(620px, calc(100vh - 32px))', display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '14px 16px', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</span>
          <button
            onClick={closeSettings}
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}
          >
            <X size={14} color="var(--bg-primary)" />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* Left nav */}
          <div style={{ width: 180, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '8px 0', overflowY: 'auto' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                onMouseEnter={() => setHoveredNav(cat.id)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', fontSize: 13, fontWeight: activeCategory === cat.id ? 600 : 400, border: 'none', cursor: 'pointer', borderRadius: 0, background: activeCategory === cat.id ? 'var(--accent-soft)' : hoveredNav === cat.id ? 'var(--bg-hover)' : 'transparent', color: activeCategory === cat.id ? 'var(--accent)' : hoveredNav === cat.id ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'background 0.1s, color 0.1s' }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {activeCategory === 'general' && (
              <GeneralPanel
                appVersion={appVersion}
                aboutText={aboutText}
                onOpenChangelog={() => setChangelogOpen(true)}
                updateStatus={updateStatus}
                updateBusy={updateBusy}
                updateLog={updateLog}
                canRestartAfterUpdate={canRestartAfterUpdate}
                onCheckUpdates={handleCheckUpdates}
                onApplyUpdate={handleApplyUpdate}
                onRestartNow={handleRestartNow}
              />
            )}
            {activeCategory === 'appearance' && <AppearancePanel />}
            {activeCategory === 'editor' && <EditorPanel />}
            {activeCategory === 'files' && <FilesPanel />}
            {activeCategory === 'agents' && <AgentsPanel />}
            {activeCategory === 'productivity' && <ProductivityPanel />}
          </div>
        </div>
      </div>

      {/* Changelog overlay */}
      {isChangelogOpen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, zIndex: 111, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            style={{ width: '100%', maxWidth: 760, maxHeight: '78vh', display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Changelog</span>
              <button
                onClick={() => setChangelogOpen(false)}
                style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}
              >
                <X size={14} color="var(--bg-primary)" />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: 16 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {changelogText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
