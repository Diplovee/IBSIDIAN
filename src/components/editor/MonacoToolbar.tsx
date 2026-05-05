import React from 'react';
import type { EditorView } from '@codemirror/view';
import { CodeMirrorToolbar } from './CodeMirrorToolbar';

interface MonacoToolbarProps {
  editor: any; // Monaco editor wrapper
}

export const MonacoToolbar: React.FC<MonacoToolbarProps> = ({ editor }) => {
  // Extract the EditorView from our Monaco wrapper
  // Since we're using CodeMirror under the hood, we need to pass the view
  // For now, we'll render the CodeMirrorToolbar which works with EditorView directly
  // This is a compatibility layer
  return null; // Toolbar is rendered separately in the editor component
};
