import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, MoreHorizontal, RotateCcw, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { VISUAL_TOOL_NAMES } from './tools';
import type { ProductivityMessage } from './types';

export type ChatMessageLike = Pick<ProductivityMessage, 'id' | 'role' | 'content' | 'toolName'>;

const selectableTextStyle: React.CSSProperties = {
  userSelect: 'text',
  WebkitUserSelect: 'text',
  cursor: 'text',
};

export const RichText: React.FC<{ text: string; onLink: (url: string) => void }> = ({ text, onLink }) => {
  const URL_RE = /https?:\/\/[^\s)\]>]+/g;
  const BOLD_RE = /\*\*([^*]+)\*\*/g;

  const lines = text.split('\n');
  return (
    <span style={selectableTextStyle}>
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
    </span>
  );
};

export const StyledMarkdown: React.FC<{ text: string; onLink: (url: string) => void }> = ({ text, onLink }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p style={{ ...selectableTextStyle, margin: 0, marginBottom: 10 }}>{children}</p>,
      ul: ({ children }) => <ul style={{ ...selectableTextStyle, margin: '0 0 10px 18px', padding: 0 }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ ...selectableTextStyle, margin: '0 0 10px 18px', padding: 0 }}>{children}</ol>,
      li: ({ children }) => <li style={{ ...selectableTextStyle, marginBottom: 4 }}>{children}</li>,
      h1: ({ children }) => <h1 style={{ ...selectableTextStyle, fontSize: 22, margin: '0 0 10px', fontWeight: 700 }}>{children}</h1>,
      h2: ({ children }) => <h2 style={{ ...selectableTextStyle, fontSize: 19, margin: '0 0 10px', fontWeight: 700 }}>{children}</h2>,
      h3: ({ children }) => <h3 style={{ ...selectableTextStyle, fontSize: 16, margin: '0 0 8px', fontWeight: 700 }}>{children}</h3>,
      blockquote: ({ children }) => <blockquote style={{ ...selectableTextStyle, margin: '0 0 10px', padding: '4px 0 4px 10px', borderLeft: '3px solid var(--border)', color: 'var(--text-secondary)' }}>{children}</blockquote>,
      code: ({ children, className, ...props }) => {
        const isBlock = Boolean(className);
        if (isBlock) {
          return (
            <code className={className} {...props} style={{ ...selectableTextStyle, display: 'block', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', fontSize: 12 }}>
              {children}
            </code>
          );
        }
        return <code {...props} style={{ ...selectableTextStyle, background: 'var(--bg-hover)', borderRadius: 4, padding: '1px 5px', fontSize: 12 }}>{children}</code>;
      },
      a: ({ href, children }) => (
        <a
          href={href}
          onClick={e => { e.preventDefault(); if (href) onLink(href); }}
          style={{ color: '#8B5CF6', textDecoration: 'underline' }}
        >
          {children}
        </a>
      ),
    }}
  >
    {text}
  </ReactMarkdown>
);

export const ToolVisualization: React.FC<{ message: ChatMessageLike }> = ({ message }) => {
  if (!message.toolName || !VISUAL_TOOL_NAMES.has(message.toolName)) return null;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(message.content) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const colors = ['#8B5CF6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#A855F7'];
  const title = typeof parsed.title === 'string' ? parsed.title : 'Visualization';
  const [hidden, setHidden] = useState<string[]>([]);

  if (parsed.kind === 'table') {
    const columns = Array.isArray(parsed.columns) ? parsed.columns.map(v => String(v)) : [];
    const rows = Array.isArray(parsed.rows)
      ? parsed.rows.map(row => Array.isArray(row) ? row.map(cell => String(cell)) : [])
      : [];
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '80%', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Table tool</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{title}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                {columns.map((col, idx) => (
                  <th key={`${col}_${idx}`} style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 8px' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ridx) => (
                <tr key={`r_${ridx}`}>
                  {row.map((cell, cidx) => (
                    <td key={`c_${ridx}_${cidx}`} style={{ borderBottom: '1px solid var(--border)', padding: '6px 8px', color: 'var(--text-secondary)' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (parsed.kind === 'pie') {
    const data = Array.isArray(parsed.data) ? parsed.data : [];
    const points = data
      .map((item, index) => ({
        label: typeof item === 'object' && item && 'label' in item ? String((item as { label?: unknown }).label ?? '') : '',
        value: typeof item === 'object' && item && 'value' in item ? Number((item as { value?: unknown }).value ?? 0) : 0,
        color: colors[index % colors.length],
      }))
      .filter(item => item.label && Number.isFinite(item.value) && item.value > 0);

    const visible = points.filter(point => !hidden.includes(point.label));
    const total = visible.reduce((sum, point) => sum + point.value, 0);
    let current = 0;
    const gradient = visible.map(point => {
      const start = current;
      const end = total > 0 ? current + (point.value / total) * 360 : current;
      current = end;
      return `${point.color} ${start}deg ${end}deg`;
    }).join(', ');

    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '80%', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Pie chart tool</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{title}</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 150, height: 150, borderRadius: '50%', background: gradient ? `conic-gradient(${gradient})` : 'var(--bg-hover)', border: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {points.map(point => {
              const active = !hidden.includes(point.label);
              return (
                <button
                  key={point.label}
                  onClick={() => setHidden(prev => active ? [...prev, point.label] : prev.filter(label => label !== point.label))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: active ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: point.color, opacity: active ? 1 : 0.3 }} />
                  <span style={{ fontSize: 12 }}>{point.label}: {point.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (parsed.kind === 'graph') {
    const graphType = parsed.graphType === 'line' ? 'line' : 'bar';
    const data = Array.isArray(parsed.data) ? parsed.data : [];
    const points = data
      .map(item => ({
        label: typeof item === 'object' && item && 'label' in item ? String((item as { label?: unknown }).label ?? '') : '',
        value: typeof item === 'object' && item && 'value' in item ? Number((item as { value?: unknown }).value ?? 0) : 0,
      }))
      .filter(item => item.label && Number.isFinite(item.value));

    const visible = points.filter(point => !hidden.includes(point.label));
    const maxValue = Math.max(1, ...visible.map(point => point.value));

    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '80%', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Graph tool ({graphType})</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '8px 0' }}>
          {visible.map((point, idx) => {
            const height = Math.max(6, (point.value / maxValue) * 130);
            return (
              <button
                key={point.label}
                title={`${point.label}: ${point.value}`}
                style={{ width: 32, border: 'none', background: 'none', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', padding: 0 }}
                onClick={() => setHidden(prev => prev.includes(point.label) ? prev.filter(label => label !== point.label) : [...prev, point.label])}
              >
                <div
                  style={{
                    width: graphType === 'line' ? 8 : 22,
                    height,
                    borderRadius: graphType === 'line' ? 999 : 4,
                    background: colors[idx % colors.length],
                    opacity: 0.9,
                  }}
                />
                <span style={{ fontSize: 10, maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{point.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {points.map(point => {
            const active = !hidden.includes(point.label);
            return (
              <button
                key={`toggle_${point.label}`}
                onClick={() => setHidden(prev => active ? [...prev, point.label] : prev.filter(label => label !== point.label))}
                style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 999, background: active ? 'var(--bg-hover)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', padding: '3px 8px', cursor: 'pointer' }}
              >
                {point.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

export const MessageActions: React.FC<{ content: string; onRegenerate?: () => void }> = ({ content, onRegenerate }) => {
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
      {btn(<RotateCcw size={14} />, onRegenerate)}
      {btn(<MoreHorizontal size={14} />)}
    </div>
  );
};

export const TypingDots: React.FC = () => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
    <style>{`@keyframes _pcDot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}`}</style>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', animation: `_pcDot 1.2s ease-in-out ${i * 0.16}s infinite` }} />
    ))}
  </div>
);
