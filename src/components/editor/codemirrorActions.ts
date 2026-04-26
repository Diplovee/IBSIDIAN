import type { EditorView } from '@codemirror/view';

export const toggleInline = (view: EditorView, marker: string) => {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  const m = marker.length;
  const pre = view.state.sliceDoc(from - m, from);
  const post = view.state.sliceDoc(to, to + m);
  if (pre === marker && post === marker) {
    view.dispatch({ changes: [{ from: from - m, to: from, insert: '' }, { from: to, to: to + m, insert: '' }] });
  } else {
    view.dispatch({ changes: { from, to, insert: `${marker}${sel}${marker}` } });
  }
  view.focus();
};

export const setBlockPrefix = (view: EditorView, prefix: string) => {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  // task list must come before bullet list so `- [ ] ` isn't consumed by `[-*+] `
  const stripped = line.text.replace(/^(#{1,6} |- \[[ x]\] |[-*+] |\d+\. |> )/, '');
  view.dispatch({ changes: { from: line.from, to: line.to, insert: prefix + stripped } });
  view.focus();
};

export const clearFormatting = (view: EditorView) => {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  const cleaned = sel.replace(/\*\*|__|~~|==|%%|(?<!\*)\*(?!\*)|(?<!_)_(?!_)|`|\$/g, '');
  view.dispatch({ changes: { from, to, insert: cleaned } });
  view.focus();
};

export const insertAtCursor = (view: EditorView, text: string, cursorOffset?: number) => {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: cursorOffset !== undefined ? { anchor: from + cursorOffset } : undefined,
  });
  view.focus();
};
