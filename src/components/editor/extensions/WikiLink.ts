import { Node, mergeAttributes } from '@tiptap/core';

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: { default: null },
      alias: { default: null },
      anchor: { default: null },
    };
  },

  parseHTML() {
    return [{
      tag: 'span[data-wiki-link]',
      getAttrs: (element) => {
        if (!(element instanceof HTMLElement)) return false;
        return {
          target: element.getAttribute('data-wiki-link'),
          alias: element.getAttribute('data-alias'),
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const target = HTMLAttributes.target ?? '';
    const alias = HTMLAttributes.alias ?? '';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': target,
        ...(alias ? { 'data-alias': alias } : {}),
        class: 'wiki-link',
      }),
      alias || target || ' ',
    ];
  },
});