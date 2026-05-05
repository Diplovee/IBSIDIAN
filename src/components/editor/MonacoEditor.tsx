import React, { useRef, useEffect, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { hybridMarkdown } from 'codemirror-markdown-hybrid';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  filePath?: string;
  onEditorMount?: (editor: any) => void;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({ value, onChange, language = 'markdown', filePath, onEditorMount }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isApplyingRef = useRef(false);

  const getModel = useCallback(() => {
    const view = viewRef.current;
    if (!view) return null;
    return {
      getValue: () => view.state.doc.toString(),
      setValue: (val: string) => {
        const transaction = view.state.update({
          changes: { from: 0, to: view.state.doc.length, insert: val }
        });
        view.dispatch(transaction);
      },
      getLineCount: () => view.state.doc.lines,
    };
  }, []);

  const setPosition = useCallback(({ lineNumber, column }: { lineNumber: number; column: number }) => {
    const view = viewRef.current;
    if (!view) return;
    const line = view.state.doc.line(lineNumber);
    const pos = Math.min(line.from + column - 1, line.to);
    view.dispatch({ selection: { anchor: pos, head: pos } });
  }, []);

  const revealLineInCenter = useCallback((lineNumber: number) => {
    const view = viewRef.current;
    if (!view) return;
    const line = view.state.doc.line(lineNumber);
    view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isApplyingRef.current) {
        onChange(update.state.doc.toString());
      }
    });

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      updateListener,
    ];

    if (language === 'markdown') {
      extensions.push(hybridMarkdown());
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    const editor = {
      getModel: () => getModel(),
      setPosition,
      revealLineInCenter,
    };

    onEditorMount?.(editor);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isApplyingRef.current) return;
    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      isApplyingRef.current = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value }
      });
      isApplyingRef.current = false;
    }
  }, [value]);

  return <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }} />;
};
