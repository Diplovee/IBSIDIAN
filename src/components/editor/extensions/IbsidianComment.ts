import { Mark, mergeAttributes } from '@tiptap/core';

export const IbsidianComment = Mark.create({
  name: 'ibsidianComment',
  keepOnSplit: false,

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      class: 'ibsidian-comment',
      style: 'display: none;',
    }), 0];
  },
});