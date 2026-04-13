import type { Dispatch, SetStateAction } from 'react';
import type { AgentActivityItem } from '../AgentActivityIndicator';
import type { ProductivityCreds, ProductivityMessage } from './types';

interface RunProductivityAgentParams {
  creds: ProductivityCreds;
  setCreds: (c: ProductivityCreds) => void;
  model: string;
  systemPrompt: string;
  initialMessages: ProductivityMessage[];
  abortSignal: AbortSignal;
  tools: unknown[];
  runTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  setMessages: Dispatch<SetStateAction<ProductivityMessage[]>>;
  setActivities: Dispatch<SetStateAction<AgentActivityItem[]>>;
  setIsStreaming: (v: boolean) => void;
  onComplete?: (finalMessages: ProductivityMessage[], finalActivities: AgentActivityItem[]) => void;
}

async function getValidToken(creds: ProductivityCreds, setCreds: (c: ProductivityCreds) => void): Promise<string> {
  if (Date.now() < creds.expires - 60_000) return creds.access;
  const refreshed = await window.api.auth.codexRefresh();
  setCreds(refreshed);
  return refreshed.access;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApiInput(msgs: ProductivityMessage[]): any[] {
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
}

export async function runProductivityAgent(params: RunProductivityAgentParams): Promise<void> {
  const {
    creds,
    setCreds,
    model,
    systemPrompt,
    initialMessages,
    abortSignal,
    tools,
    runTool,
    setMessages,
    setActivities,
    setIsStreaming,
    onComplete,
  } = params;

  const activityLog: AgentActivityItem[] = [];
  const pushActivity = (activity: AgentActivityItem) => {
    activityLog.push(activity);
    setActivities(prev => [...prev, activity]);
  };

  const agentLoop = async (msgs: ProductivityMessage[]): Promise<void> => {
    let token = '';
    try {
      token = await getValidToken(creds, setCreds);
    } catch {
      const errMsg: ProductivityMessage = { id: Date.now().toString(), role: 'assistant', content: 'Failed to refresh credentials. Please sign in again.' };
      setMessages(prev => [...prev, errMsg]);
      setIsStreaming(false);
      return;
    }

    let assistantContent = '';
    const assistantId = `a_${Date.now()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls: any[] = [];

    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    pushActivity({
      id: `act_${Date.now()}_thinking`,
      type: 'thinking',
      message: 'Processing your request',
      timestamp: Date.now(),
    });

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
        signal: abortSignal,
        body: JSON.stringify({
          model,
          store: false,
          stream: true,
          instructions: systemPrompt,
          input: toApiInput(msgs),
          tools,
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
      const errMsg: ProductivityMessage = { id: assistantId, role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` };
      setMessages(prev => prev.map(m => m.id === assistantId ? errMsg : m));

      pushActivity({
        id: `act_${Date.now()}_error`,
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      });

      setIsStreaming(false);
      return;
    }

    const assistantMsg: ProductivityMessage = { id: assistantId, role: 'assistant', content: assistantContent };
    let updatedMsgs = [...msgs, assistantMsg];
    setMessages(prev => prev.map(m => m.id === assistantId ? assistantMsg : m));

    if (toolCalls.length > 0) {
      pushActivity({
        id: `act_${Date.now()}_thinking_plan`,
        type: 'thinking',
        message: `Planning ${toolCalls.length} action${toolCalls.length > 1 ? 's' : ''}`,
        timestamp: Date.now(),
      });

      const toolResultMsgs: ProductivityMessage[] = [];
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.args); } catch { /* ignore */ }

        const detailText = typeof args.path === 'string'
          ? args.path
          : typeof args.content === 'string'
            ? args.content.slice(0, 50)
            : JSON.stringify(args).slice(0, 30);

        pushActivity({
          id: `act_${Date.now()}_${tc.name}`,
          type: 'thinking',
          message: `Using ${tc.name}`,
          details: detailText,
          timestamp: Date.now(),
        });

        const result = await runTool(tc.name, args);
        const toolMsg: ProductivityMessage = {
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

      pushActivity({
        id: `act_${Date.now()}_complete`,
        type: 'complete',
        message: 'All actions completed',
        timestamp: Date.now(),
      });

      await agentLoop(updatedMsgs);
      return;
    }

    pushActivity({
      id: `act_${Date.now()}_complete`,
      type: 'complete',
      message: 'Response complete',
      timestamp: Date.now(),
    });

    onComplete?.(updatedMsgs, activityLog);
    setIsStreaming(false);
  };

  await agentLoop(initialMessages);
}
