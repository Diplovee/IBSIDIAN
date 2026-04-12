import { Node, mergeAttributes } from '@tiptap/core';

export const WikiEmbed = Node.create({
  name: 'wikiEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      target: { default: null },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-wiki-embed]',
      getAttrs: (element) => {
        if (!(element instanceof HTMLElement)) return false;
        return {
          target: element.getAttribute('data-wiki-embed'),
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const target = HTMLAttributes.target ?? '';
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-wiki-embed': target,
      class: 'wiki-embed',
    })];
  },
});