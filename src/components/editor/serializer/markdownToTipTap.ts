import { generateJSON } from '@tiptap/html';
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
import { marked } from 'marked';

import { WikiLink } from '../extensions/WikiLink';
import { WikiEmbed } from '../extensions/WikiEmbed';
import { Callout } from '../extensions/Callout';
import { IbsidianComment } from '../extensions/IbsidianComment';

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

const preprocessMarkdown = (markdown: string): string => {
  let html = markdown;

  html = html.replace(/^%%[\s\S]*?%%$/gm, '');

  html = html.replace(/\[\[([^\]|]+?)\|([^\]]+)\]\]/g, '<span data-wiki-link="$1" data-alias="$2">$2</span>');
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span data-wiki-link="$1">$1</span>');

  html = html.replace(/!\[\[([^\]]+)\]\]/g, '<div data-wiki-embed="$1"></div>');

  html = html.replace(/==([^=]+)==/g, '<mark>$1</mark>');

  html = html.replace(/\$([^$\n]+)\$/g, '<span data-math="$1">$1</span>');
  html = html.replace(/\$\$([^$\n]+)\$\$/g, '<div data-math-block="$1"></div>');

  return html;
};

export const markdownToTipTap = (markdown: string): any => {
  if (!markdown.trim()) return '';

  const preprocessed = preprocessMarkdown(markdown);

  try {
    const rendered = marked.parse(preprocessed, { gfm: true, breaks: true });
    const html = typeof rendered === 'string' ? rendered : preprocessed;
    const json = generateJSON(html, extensions as any);
    return json;
  } catch (error) {
    console.error('Failed to parse markdown:', error);
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
};