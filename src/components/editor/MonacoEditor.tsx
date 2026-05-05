import React, { useRef, useEffect, useCallback } from 'react';
import { 
  EditorView, keymap, lineNumbers, highlightActiveLine, 
  highlightActiveLineGutter, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { 
  indentOnInput, syntaxHighlighting, defaultHighlightStyle, 
  bracketMatching, foldGutter, foldKeymap, indentUnit
} from '@codemirror/language';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { hybridMarkdown } from 'codemirror-markdown-hybrid';
import { useActivity } from '../../contexts/ActivityContext';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  filePath?: string;
  onEditorMount?: (editor: any) => void;
}

const languageConf = new Compartment();
const themeConf = new Compartment();

const zedTheme = EditorView.theme({
  "&": {
    fontSize: "14.5px",
    height: "100%",
    backgroundColor: "var(--bg-primary)",
  },
  ".cm-content": {
    fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", "Monaco", "Courier New", monospace',
    padding: "0 4px",
    lineHeight: "1.6",
    WebkitFontSmoothing: "antialiased",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-primary)",
    border: "none",
    color: "var(--text-muted)",
    minWidth: "40px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 16px 0 8px",
    opacity: "0.3",
    transition: "opacity 0.2s",
  },
  "&.cm-focused .cm-lineNumbers .cm-gutterElement.cm-activeLineGutter": {
    opacity: "1",
    color: "var(--accent)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(124, 58, 237, 0.025)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-foldGutter": {
    width: "12px",
  },
  ".cm-foldGutter span": {
    opacity: "0.4",
    transition: "opacity 0.15s",
  },
  "&.cm-focused .cm-foldGutter span:hover": {
    opacity: "1",
  },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(124, 58, 237, 0.1)",
  },
  ".cm-cursor": {
    borderLeft: "2px solid var(--accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(124, 58, 237, 0.2) !important",
  }
}, { dark: true });

export const MonacoEditor: React.FC<MonacoEditorProps> = ({ value, onChange, language = 'markdown', filePath, onEditorMount }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isApplyingRef = useRef(false);
  const { theme } = useActivity();

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
      focus: () => view.focus(),
    };
  }, []);

  const setPosition = useCallback(({ lineNumber, column }: { lineNumber: number; column: number }) => {
    const view = viewRef.current;
    if (!view) return;
    const line = view.state.doc.line(lineNumber);
    const pos = Math.min(line.from + column - 1, line.to);
    view.dispatch({ selection: { anchor: pos, head: pos }, scrollIntoView: true });
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
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      foldGutter(),
      indentUnit.of("  "),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
      ]),
      zedTheme,
      themeConf.of(theme === 'dark' ? oneDark : []),
      updateListener,
      languageConf.of([]),
    ];

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
      focus: () => view.focus(),
    };

    onEditorMount?.(editor);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const loadLanguage = async () => {
      if (language === 'markdown') {
        view.dispatch({
          effects: languageConf.reconfigure(hybridMarkdown())
        });
        return;
      }

      // Try to find language by name, alias or extension
      const langDesc = languages.find(l => 
        l.name.toLowerCase() === language.toLowerCase() || 
        l.alias.some(a => a.toLowerCase() === language.toLowerCase()) || 
        l.extensions.some(e => e.toLowerCase() === language.toLowerCase())
      );

      if (langDesc) {
        try {
          const lang = await langDesc.load();
          view.dispatch({
            effects: languageConf.reconfigure(lang)
          });
        } catch (e) {
          console.warn('Failed to load language', language, e);
          view.dispatch({ effects: languageConf.reconfigure([]) });
        }
      } else {
        view.dispatch({ effects: languageConf.reconfigure([]) });
      }
    };

    loadLanguage();
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeConf.reconfigure(theme === 'dark' ? oneDark : [])
    });
  }, [theme]);

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

  return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />;
};
