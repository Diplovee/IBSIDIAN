import { generateText } from '@tiptap/core';
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

export const tipTapToMarkdown = (json: any): string => {
  if (!json || !json.content) return '';

  try {
    let markdown = generateText(json, extensions as any);

    markdown = markdown.replace(/<span data-wiki-link="([^"]+)" data-alias="([^"]+)">[^<]+<\/span>/g, '[[$1|$2]]');
    markdown = markdown.replace(/<span data-wiki-link="([^"]+)">[^<]+<\/span>/g, '[[$1]]');

    markdown = markdown.replace(/<div data-wiki-embed="([^"]+)"><\/div>/g, '![[$1]]');

    markdown = markdown.replace(/<div data-callout="([^"]+)" data-title="([^"]*)">([\s\S]*?)<\/div>/g, (_match, type, title, content) => {
      const titlePart = title ? ` ${title}` : '';
      return `> [!${type}]${titlePart}\n${content}`;
    });

    markdown = markdown.replace(/<mark>([^<]+)<\/mark>/g, '==$1==');

    markdown = markdown.replace(/<span data-math="([^"]+)"><\/span>/g, '$$$1$');
    markdown = markdown.replace(/<div data-math-block="([^"]+)"><\/div>/g, '$$$$$1$$');

    markdown = markdown.replace(/<[^>]+>/g, '');

    return markdown;
  } catch (error) {
    console.error('Failed to serialize:', error);
    return '';
  }
};