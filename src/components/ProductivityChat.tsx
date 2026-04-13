import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Search, PanelLeftClose, PanelLeftOpen, Pencil, LogOut } from 'lucide-react';
import { ProductivityIcon } from './AgentIcons';
import { AgentActivityTimeline, AgentActivityItem } from './AgentActivityIndicator';
import { FileMentionInput, FileMention } from './FileMentionInput';
import { MessageActions, RichText, StyledMarkdown, ToolVisualization, TypingDots } from './productivity/renderers';
import { LoginModal, ModelPicker, Sidebar, GroqApiKeyModal as OpenRouterApiKeyModal } from './productivity/ui';
import { runProductivityAgent } from './productivity/agent';
import { VAULT_TOOLS, VISUAL_TOOL_NAMES, runTool } from './productivity/tools';
import type { ProductivityCreds, ProductivityMessage, ProductivitySession } from './productivity/types';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import type { Tab, ProductivityProvider } from '../types';

const CODEX_MODELS = [
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
] as const;

const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
  { id: 'google/gemma-3-27b-it', label: 'Gemma 3 27B' },
] as const;

const DEFAULT_CODEX_MODEL = 'gpt-5.2';
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct';

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

function normalizeModelId(model: string | null | undefined, provider?: ProductivityProvider): string {
  if (model === 'codex-mini-latest') return DEFAULT_CODEX_MODEL;
  const models = provider === 'openrouter' ? OPENROUTER_MODELS : CODEX_MODELS;
  const defaultModel = provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_CODEX_MODEL;
  if (models.some(option => option.id === model)) return model as string;
  return defaultModel;
}

function getModelsForProvider(provider: ProductivityProvider) {
  return provider === 'openrouter' ? OPENROUTER_MODELS : CODEX_MODELS;
}

function buildChatTitle(messages: ProductivityMessage[]): string {
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

function persistProductivityModel(model: string, provider: ProductivityProvider): string {
  const normalized = normalizeModelId(model, provider);
  localStorage.setItem('productivity-model', normalized);
  return normalized;
}

function extractSandcatSegments(text: string): Array<{ name: string; payload: string; start: number; end: number }> {
  const segments: Array<{ name: string; payload: string; start: number; end: number }> = [];
  const marker = '(sandcat:';
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf(marker, cursor);
    if (start === -1) break;

    const nameStart = start + marker.length;
    const nameEnd = text.indexOf(':', nameStart);
    if (nameEnd === -1) break;

    const name = text.slice(nameStart, nameEnd).trim();
    let payloadStart = nameEnd + 1;
    while (payloadStart < text.length && /\s/.test(text[payloadStart])) payloadStart += 1;
    if (text[payloadStart] !== '{') {
      cursor = nameEnd + 1;
      continue;
    }

    let depth = 0;
    let payloadEnd = -1;
    for (let i = payloadStart; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          payloadEnd = i;
          break;
        }
      }
    }
    if (payloadEnd === -1) break;

    let end = payloadEnd + 1;
    while (end < text.length && /\s/.test(text[end])) end += 1;
    if (text[end] === ')') end += 1;

    segments.push({
      name,
      payload: text.slice(payloadStart, payloadEnd + 1),
      start,
      end,
    });

    cursor = end;
  }

  return segments;
}

function stripSandcatToolMarkup(text: string): string {
  const withLabels = text.replace(/\[([^\]]+)\]\(sandcat:[\s\S]*?\)/g, '$1');
  const segments = extractSandcatSegments(withLabels);
  if (segments.length === 0) return withLabels;

  let out = '';
  let last = 0;
  for (const seg of segments) {
    out += withLabels.slice(last, seg.start);
    last = seg.end;
  }
  out += withLabels.slice(last);

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function extractEmbeddedVisuals(text: string, sourceId: string): ProductivityMessage[] {
  const segments = extractSandcatSegments(text);
  const visuals: ProductivityMessage[] = [];

  segments.forEach((segment, index) => {
    if (!VISUAL_TOOL_NAMES.has(segment.name)) return;
    try {
      const payload = JSON.parse(segment.payload) as Record<string, unknown>;
      visuals.push({
        id: `${sourceId}_embedded_${index}`,
        role: 'tool',
        toolName: segment.name,
        content: JSON.stringify(payload),
      });
    } catch {
      // ignore malformed embedded payload
    }
  });

  return visuals;
}

// ── Main component ─────────────────────────────────────────────────────────────
export const ProductivityChat: React.FC<{ tab: Tab }> = () => {
  const { openTab } = useTabs();
  const { vault, nodes } = useVault();
  const { settings, updateAgentSettings } = useAppSettings();

  const provider = (settings.agents.productivityProvider ?? 'codex') as ProductivityProvider;
  const openrouterApiKey = settings.agents.openrouterApiKey;

  const [creds, setCreds] = useState<ProductivityCreds | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions] = useState<ProductivitySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProductivityMessage[]>([]);
  const [activities, setActivities] = useState<AgentActivityItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [timelineCollapsed, setTimelineCollapsed] = useState(true);
  const [mentions, setMentions] = useState<FileMention[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => normalizeModelId(localStorage.getItem('productivity-model'), provider)
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
    if (provider === 'openrouter') {
      setAuthLoading(false);
      return;
    }
    window.api.auth.codexGet()
      .then(c => { setCreds(c); setAuthLoading(false); })
      .catch(() => setAuthLoading(false));
  }, [provider]);

  useEffect(() => {
    const normalized = persistProductivityModel(selectedModel, provider);
    if (normalized !== selectedModel) {
      setSelectedModel(normalized);
    }
  }, [selectedModel, provider]);

  // Load sessions from vault
  useEffect(() => {
    if (!vault) return;
    window.api.files.read('.pi/productivity-sessions.json')
      .then(raw => {
        const parsed = JSON.parse(raw) as ProductivitySession[];
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
    const effectiveCreds = provider === 'openrouter' ? null : creds;
    if (provider === 'codex' && !effectiveCreds) return;

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

    const userMsg: ProductivityMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedText,
      mentions: effectiveMentions.length > 0 ? effectiveMentions : undefined,
    };
    const currentMessages: ProductivityMessage[] = [...baseMessages, userMsg];

    setInputValue('');

    if (!currentSessionId) {
      const newId = `s_${Date.now()}`;
      const newSession: ProductivitySession = { id: newId, title: buildChatTitle(currentMessages), messages: currentMessages, group: dateGroup(Date.now()), activities: [] };
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

    await runProductivityAgent({
      provider,
      openrouterApiKey: provider === 'openrouter' ? openrouterApiKey : undefined,
      creds: effectiveCreds,
      setCreds,
      model: selectedModel,
      systemPrompt,
      initialMessages: currentMessages,
      abortSignal: abortRef.current!.signal,
      tools: VAULT_TOOLS,
      runTool,
      setMessages,
      setActivities,
      setIsStreaming,
      onComplete: (finalMessages, finalActivities) => {
        setSessions(ss => ss.map(s => s.id === currentSessionId ? {
          ...s,
          title: buildChatTitle(finalMessages),
          messages: finalMessages,
          activities: finalActivities,
        } : s));
      },
    });
  }, [creds, activeSessionId, selectedModel, messages, provider, openrouterApiKey]);

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

      {/* Login modal — shown when not authenticated (Codex) */}
      {provider === 'codex' && !creds && <LoginModal onLogin={setCreds} />}

      {/* OpenRouter API key modal - shown when no key configured */}
      {provider === 'openrouter' && !openrouterApiKey && (
        <OpenRouterApiKeyModal
          onSubmit={async (key) => {
            await updateAgentSettings({ openrouterApiKey: key });
          }}
          onCancel={() => {}}
        />
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Experimental warning */}
        {provider === 'openrouter' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(249, 115, 22, 0.15)', flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#f97316' }}>Experimental — some models may not support tools</span>
          </div>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8, flexShrink: 0 }}>
          <ModelPicker
            models={getModelsForProvider(provider)}
            value={selectedModel}
            onChange={value => setSelectedModel(persistProductivityModel(value, provider))}
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
              onStop={() => abortRef.current?.abort()}
              disabled={isStreaming || (provider === 'codex' && !creds) || (provider === 'openrouter' && !openrouterApiKey)}
              isStreaming={isStreaming}
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
                  const visibleMessages = messages.filter(msg => msg.role !== 'tool' || VISUAL_TOOL_NAMES.has(msg.toolName ?? ''));
                  const rows: React.ReactNode[] = [];

                  for (let i = 0; i < visibleMessages.length; i += 1) {
                    const msg = visibleMessages[i];

                    if (msg.role === 'user') {
                      rows.push(
                        <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                      );
                      continue;
                    }

                    const turnItems: typeof visibleMessages = [];
                    let nextIndex = i;
                    while (nextIndex < visibleMessages.length && visibleMessages[nextIndex].role !== 'user') {
                      turnItems.push(visibleMessages[nextIndex]);
                      nextIndex += 1;
                    }
                    i = nextIndex - 1;

                    const assistantItems = turnItems.filter(item => item.role === 'assistant');
                    const timelineVisualItems = turnItems.filter(item => item.role === 'tool');
                    const embeddedVisualItems = assistantItems.flatMap(item => extractEmbeddedVisuals(item.content, item.id));
                    const visualItems = [...timelineVisualItems, ...embeddedVisualItems];
                    const assistantItemsWithCleanContent = assistantItems.map(item => ({
                      ...item,
                      content: stripSandcatToolMarkup(item.content),
                    }));
                    const latestAssistant = [...assistantItemsWithCleanContent].reverse().find(item => item.content.trim().length > 0);
                    const hasAssistantText = assistantItemsWithCleanContent.some(item => item.content.trim().length > 0);
                    const isLatestTurn = nextIndex >= visibleMessages.length;

                    rows.push(
                      <div key={`turn_${turnItems[0]?.id ?? i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ alignSelf: 'flex-start', maxWidth: '80%', width: '100%', borderRadius: 8, background: 'var(--bg-secondary)', padding: '10px 12px' }}>
                          {activities.length > 0 && isLatestTurn && (
                            <div style={{ position: isStreaming ? 'sticky' : 'static', top: 8, zIndex: 1, marginBottom: 10 }}>
                              <AgentActivityTimeline
                                activities={activities}
                                isActive={isStreaming}
                                collapsed={timelineCollapsed}
                                onToggleCollapse={() => setTimelineCollapsed(c => !c)}
                              />
                            </div>
                          )}

                          {assistantItemsWithCleanContent.map((assistantItem, index) => (
                            assistantItem.content.trim().length > 0 ? (
                              <div key={assistantItem.id} style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, padding: '0 6px', marginTop: index > 0 ? 10 : 0 }}>
                                <StyledMarkdown text={assistantItem.content} onLink={handleLink} />
                              </div>
                            ) : null
                          ))}

                          {visualItems.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: hasAssistantText ? 8 : 0 }}>
                              {visualItems.map(toolMessage => (
                                <ToolVisualization key={toolMessage.id} message={toolMessage} />
                              ))}
                            </div>
                          )}
                        </div>
                        {latestAssistant?.content && <MessageActions content={latestAssistant.content} />}
                      </div>
                    );
                  }

                  return rows;
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
              onStop={() => abortRef.current?.abort()}
              disabled={isStreaming || (provider === 'codex' && !creds) || (provider === 'openrouter' && !openrouterApiKey)}
              isStreaming={isStreaming}
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
