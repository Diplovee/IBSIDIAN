import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { markdownToTipTap } from './serializer/markdownToTipTap';
import { tipTapToMarkdown } from './serializer/tipTapToMarkdown';
import { WikiLink } from './extensions/WikiLink';
import { WikiEmbed } from './extensions/WikiEmbed';
import { Callout } from './extensions/Callout';
import { IbsidianComment } from './extensions/IbsidianComment';

const lowlight = createLowlight(common);

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  Placeholder.configure({ placeholder: 'Start writing…' }),
  Typography,
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Highlight,
  Subscript,
  Superscript,
  CodeBlockLowlight.configure({ lowlight }),
  WikiLink,
  WikiEmbed,
  Callout,
  IbsidianComment,
];

interface TipTapEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  onEditorReady?: (editor: any | null) => void;
  filePath?: string;
  onImagePaste?: (files: File[], view: any, coords?: { x: number; y: number }) => Promise<boolean>;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({ content, onChange, onEditorReady }) => {
  const isApplyingExternalContentRef = useRef(false);
  const lastEmittedMarkdownRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions,
    content: markdownToTipTap(content),
    onUpdate: ({ editor: nextEditor }) => {
      if (isApplyingExternalContentRef.current) return;
      const markdown = tipTapToMarkdown(nextEditor.getJSON());
      lastEmittedMarkdownRef.current = markdown;
      onChange(markdown);
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (lastEmittedMarkdownRef.current === content) return;

    const currentMarkdown = tipTapToMarkdown(editor.getJSON());
    if (currentMarkdown === content) return;

    isApplyingExternalContentRef.current = true;
    editor.commands.setContent(markdownToTipTap(content), false);
    isApplyingExternalContentRef.current = false;
  }, [editor, content]);

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  if (!editor) {
    return <div style={{ color: 'var(--text-muted)' }}>Loading editor…</div>;
  }

  return <EditorContent editor={editor} className="tiptap-editor" />;
};

export default TipTapEditor;
