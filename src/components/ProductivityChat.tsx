import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Search, PanelLeftClose, PanelLeftOpen, Pencil, LogOut } from 'lucide-react';
import { ProductivityIcon } from './AgentIcons';
import { AgentActivityTimeline, AgentActivityItem } from './AgentActivityIndicator';
import { FileMentionInput, FileMention } from './FileMentionInput';
import { MessageActions, RichText, StyledMarkdown, ToolVisualization, TypingDots } from './productivity/renderers';
import { LoginModal, ModelPicker, Sidebar } from './productivity/ui';
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
            models={CODEX_MODELS}
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
