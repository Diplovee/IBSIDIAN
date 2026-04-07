import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import ReactMarkdown from 'react-markdown';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Eye, Code, Globe, PenLine, SquareTerminal, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';

export const Canvas: React.FC = () => {
  const { activeTabId, tabs } = useTabs();
  const activeTab = tabs.find(t => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
        <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-xl flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-[var(--accent)] rounded-sm flex items-center justify-center text-white text-2xl font-bold">
            I
          </div>
        </div>
        <h2 className="text-[var(--text-xl)] font-bold text-[var(--text-primary)] mb-2">Welcome to Ibsidian</h2>
        <p className="text-[var(--text-sm)]">Open a file from the sidebar or create a new one.</p>
        <div className="mt-6 flex gap-4 text-[var(--text-xs)]">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-secondary)]">Ctrl</kbd>
            <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-secondary)]">K</kbd>
            <span>Command Palette</span>
          </div>
        </div>
      </div>
    );
  }

  switch (activeTab.type) {
    case 'note': return <EditorTab tab={activeTab} />;
    case 'browser': return <BrowserTab tab={activeTab} />;
    case 'draw': return <DrawTab tab={activeTab} />;
    case 'terminal': return <TerminalTab tab={activeTab} />;
    default: return <div className="flex-1 bg-[var(--bg-primary)]" />;
  }
};

const EditorTab: React.FC<{ tab: any }> = ({ tab }) => {
  const { getNodeById, updateFileContent } = useVault();
  const node = getNodeById(tab.filePath);
  const [content, setContent] = useState(node?.type === 'file' ? node.content : '');
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (node?.type === 'file') {
      setContent(node.content);
    }
  }, [node]);

  const handleChange = (value: string) => {
    setContent(value);
    if (node?.id) {
      updateFileContent(node.id, value);
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] relative overflow-hidden">
      <div className="absolute top-4 right-8 z-10 flex gap-1">
        <button 
          onClick={() => setIsPreview(!isPreview)}
          className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 px-3"
        >
          {isPreview ? <Code size={14} /> : <Eye size={14} />}
          <span className="text-[var(--text-xs)] font-medium">{isPreview ? 'Edit' : 'Preview'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[720px] mx-auto py-16 px-12 h-full">
          {isPreview ? (
            <div className="markdown-body">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <CodeMirror
              value={content}
              height="100%"
              theme="light"
              extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
              onChange={handleChange}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
              className="text-[var(--text-base)] font-mono leading-relaxed h-full"
              style={{ fontSize: 'var(--text-base)', fontFamily: 'var(--font-mono)' }}
            />
          )}
        </div>
      </div>

      <div className="absolute bottom-4 right-8 text-[var(--text-xs)] text-[var(--text-muted)] font-medium">
        {wordCount} words
      </div>
    </div>
  );
};

const BrowserTab: React.FC<{ tab: any }> = ({ tab }) => {
  const [url, setUrl] = useState(tab.url || 'https://www.google.com');
  const [inputUrl, setInputUrl] = useState(url);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl;
    if (!target.startsWith('http')) target = 'https://' + target;
    setUrl(target);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
      <div className="h-[36px] bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-3 gap-3">
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)]"><ArrowLeft size={14} /></button>
          <button className="p-1 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)]"><ArrowRight size={14} /></button>
          <button className="p-1 hover:bg-[var(--bg-hover)] rounded-sm text-[var(--text-muted)]"><RefreshCw size={14} /></button>
        </div>
        <form onSubmit={handleNavigate} className="flex-1">
          <input 
            type="text" 
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-full px-4 py-0.5 text-[var(--text-xs)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </form>
      </div>
      <iframe 
        src={url} 
        className="flex-1 border-none" 
        title="Browser"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const DrawTab: React.FC<{ tab: any }> = ({ tab }) => {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] relative">
      <div className="absolute top-4 right-4 z-10">
        <button className="px-3 py-1.5 bg-[var(--accent)] text-white rounded-md text-[var(--text-xs)] font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm">
          Save Drawing
        </button>
      </div>
      <iframe 
        src="https://excalidraw.com" 
        className="flex-1 border-none" 
        title="Excalidraw"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const TerminalTab: React.FC<{ tab: any }> = ({ tab }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new XTerm({
        theme: {
          background: '#1a1a1a',
          foreground: '#ffffff',
          cursor: '#705dcf',
        },
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        cursorBlink: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      
      term.writeln('\x1b[1;35mIbsidian Terminal\x1b[0m');
      term.writeln('Type something to begin...');
      term.write('\r\n$ ');

      term.onData(data => {
        if (data === '\r') {
          term.write('\r\n$ ');
        } else if (data === '\u007f') { // Backspace
          term.write('\b \b');
        } else {
          term.write(data);
        }
      });

      xtermRef.current = term;

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1a]">
      <div className="h-8 bg-[#2a2a2a] border-b border-[#3a3a3a] flex items-center px-3 justify-between">
        <div className="flex items-center gap-2 text-[var(--text-xs)] text-gray-400 font-medium">
          <SquareTerminal size={12} />
          <span>bash — 80x24</span>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  );
};
