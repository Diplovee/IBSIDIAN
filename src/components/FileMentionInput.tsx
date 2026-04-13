import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export interface FileMention {
  path: string;
  title: string;
}

interface FileMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  mentions: FileMention[];
  onAddMention: (mention: FileMention) => void;
  onRemoveMention: (path: string) => void;
  fileOptions: { path: string; name: string }[];
}

export const FileMentionInput: React.FC<FileMentionInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  isStreaming,
  mentions,
  onAddMention,
  onRemoveMention,
  fileOptions,
}) => {
  const [mentionQuery, setMentionQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getCursorPosition = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return 0;
    return el.selectionStart;
  }, []);

  const getTextBeforeCursor = useCallback(() => {
    if (!value) return '';
    const pos = getCursorPosition();
    return value.slice(0, pos);
  }, [value, getCursorPosition]);

  useEffect(() => {
    const text = getTextBeforeCursor();
    if (!text) {
      setShowDropdown(false);
      setMentionQuery('');
      return;
    }
    const lastAtPos = text.lastIndexOf('@');
    
    if (lastAtPos !== -1) {
      const afterAt = text.slice(lastAtPos + 1);
      const hasSpace = afterAt.includes(' ');
      if (!hasSpace && afterAt.length > 0) {
        setMentionQuery(afterAt);
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowDropdown(false);
    setMentionQuery('');
  }, [value, getTextBeforeCursor]);

  const filteredFiles = (fileOptions || [])
    .filter(f => {
      const searchLower = (mentionQuery || '').toLowerCase();
      const path = f.path || '';
      const name = f.name || '';
      return path.toLowerCase().includes(searchLower) || name.toLowerCase().includes(searchLower);
    })
    .slice(0, 8);

  const handleSelect = useCallback((file: { path: string; name: string }) => {
    const text = getTextBeforeCursor();
    const lastAtPos = text.lastIndexOf('@');
    const beforeAt = text.slice(0, lastAtPos);
    const afterCursor = value.slice(getCursorPosition());
    
    const newValue = beforeAt + afterCursor;
    onChange(newValue);
    onAddMention({ path: file.path, title: file.name });
    setShowDropdown(false);
    setMentionQuery('');
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  }, [value, getTextBeforeCursor, getCursorPosition, onChange, onAddMention]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filteredFiles.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filteredFiles.length) % filteredFiles.length);
    } else if (e.key === 'Enter' && filteredFiles.length > 0) {
      e.preventDefault();
      handleSelect(filteredFiles[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }, [showDropdown, filteredFiles, selectedIndex, handleSelect]);

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && 
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const send = useCallback(() => {
    if (disabled) return;
    onSend();
  }, [disabled, onSend]);

  return (
    <div style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '0 16px', position: 'relative' }}>
      {mentions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
          {mentions.map(m => (
            <div
              key={m.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px 4px 10px',
                borderRadius: 6,
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                fontSize: 12,
                color: '#8B5CF6',
              }}
            >
              <span style={{ fontWeight: 500 }}>@{m.title}</span>
              <button
                onClick={() => onRemoveMention(m.path)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#8B5CF6', display: 'flex', opacity: 0.6 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', borderRadius: 999, border: '1px solid var(--border)', padding: '12px 12px 12px 20px', transition: 'border-color 0.15s' }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb,#8B5CF6 55%,var(--border))')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0, flexShrink: 0, lineHeight: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder="Ask anything, @file to mention"
          onChange={e => { onChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
          onKeyDown={e => { 
            if (e.key === 'Enter' && !e.shiftKey && !showDropdown) { 
              e.preventDefault(); 
              send(); 
            }
            handleKeyDown(e);
          }}
          style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.5, fontFamily: 'inherit', maxHeight: 140, overflow: 'auto', padding: 0, margin: 0, display: 'block' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {isStreaming ? (
            <button
              onClick={onStop}
              title="Stop"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#f87171', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={send}
              disabled={disabled}
              title="Send"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: disabled ? 'default' : 'pointer', background: disabled ? 'var(--bg-primary)' : 'var(--text-primary)', color: disabled ? 'var(--text-muted)' : 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showDropdown && filteredFiles.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 16,
            right: 16,
            marginBottom: 8,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {filteredFiles.map((file, idx) => (
            <button
              key={file.path}
              onClick={() => handleSelect(file)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                border: 'none',
                background: idx === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{(file.path || '').split('/').slice(0, -1).join('/')}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8, paddingBottom: 4 }}>
        Productivity can make mistakes. Check important info.
      </div>
    </div>
  );
};