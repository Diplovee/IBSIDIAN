import React, { useEffect, useMemo, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useActivity } from '../../contexts/ActivityContext';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  filePath?: string;
  onEditorMount?: (editor: any) => void;
  onContextMenu?: (event: MouseEvent) => void;
}

const toMonacoLanguage = (language?: string, filePath?: string) => {
  const raw = (language || filePath?.split('.').pop() || 'plaintext').toLowerCase();
  if (raw === 'md' || raw === 'markdown') return 'markdown';
  if (raw === 'ts') return 'typescript';
  if (raw === 'tsx') return 'typescript';
  if (raw === 'js') return 'javascript';
  if (raw === 'jsx') return 'javascript';
  if (raw === 'sh') return 'shell';
  if (raw === 'yml') return 'yaml';
  if (raw === 'rs') return 'rust';
  if (raw === 'py') return 'python';
  if (raw === 'rb') return 'ruby';
  if (raw === 'json') return 'json';
  if (raw === 'html') return 'html';
  if (raw === 'css') return 'css';
  return raw;
};

export const MonacoEditor: React.FC<MonacoEditorProps> = ({ value, onChange, language = 'markdown', filePath, onEditorMount, onContextMenu }) => {
  const { theme } = useActivity();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const monacoLanguage = useMemo(() => toMonacoLanguage(language, filePath), [language, filePath]);
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme('ibsidian-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#7c3aed14',
        'editor.selectionBackground': '#7c3aed7a',
        'editor.inactiveSelectionBackground': '#7c3aed5c',
        'editor.selectionHighlightBackground': '#7c3aed40',
        'editor.wordHighlightBackground': '#7c3aed22',
        'editor.wordHighlightStrongBackground': '#7c3aed30',
      },
    });

    monaco.editor.defineTheme('ibsidian-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#7c3aed10',
        'editor.selectionBackground': '#7c3aed66',
        'editor.inactiveSelectionBackground': '#7c3aed4d',
        'editor.selectionHighlightBackground': '#7c3aed30',
        'editor.wordHighlightBackground': '#7c3aed1f',
        'editor.wordHighlightStrongBackground': '#7c3aed2a',
      },
    });

    monaco.editor.setTheme(theme === 'dark' ? 'ibsidian-dark' : 'ibsidian-light');

    const wrapped = {
      getModel: () => editor.getModel(),
      getView: () => editor,
      setPosition: ({ lineNumber, column }: { lineNumber: number; column: number }) => editor.setPosition({ lineNumber, column }),
      revealLineInCenter: (lineNumber: number) => editor.revealLineInCenter(lineNumber),
      focus: () => editor.focus(),
    };

    onEditorMount?.(wrapped);
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !onContextMenu) return;
    const handler = (event: MouseEvent) => onContextMenu(event);
    node.addEventListener('contextmenu', handler, true);
    return () => node.removeEventListener('contextmenu', handler, true);
  }, [onContextMenu]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const monaco = (window as any).monaco as typeof Monaco | undefined;
    if (!monaco) return;
    monaco.editor.setTheme(theme === 'dark' ? 'ibsidian-dark' : 'ibsidian-light');
  }, [theme]);

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }}>
      <Editor
        height="100%"
        defaultLanguage={monacoLanguage}
        language={monacoLanguage}
        theme={monacoTheme}
        value={value}
        onMount={handleMount}
        onChange={(next) => onChange(next ?? '')}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 22,
          fontFamily: 'Consolas, Monaco, Courier New, monospace',
          wordWrap: 'on',
          renderWhitespace: 'selection',
          smoothScrolling: true,
          cursorBlinking: 'solid',
          cursorSmoothCaretAnimation: 'off',
          padding: { top: 8, bottom: 24 },
          glyphMargin: false,
          folding: true,
          lineNumbersMinChars: 4,
          roundedSelection: false,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          contextmenu: false,
        }}
      />
    </div>
  );
};
