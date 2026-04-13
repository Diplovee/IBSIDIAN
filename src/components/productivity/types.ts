import type { AgentActivityItem } from '../AgentActivityIndicator';

export interface ProductivityMention {
  path: string;
  title: string;
}

export interface ProductivityMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: string;
  mentions?: ProductivityMention[];
}

export interface ProductivitySession {
  id: string;
  title: string;
  messages: ProductivityMessage[];
  group: string;
  pinned?: boolean;
  activities?: AgentActivityItem[];
}

export interface ProductivityCreds {
  access: string;
  refresh: string;
  expires: number;
  accountId: string;
}
