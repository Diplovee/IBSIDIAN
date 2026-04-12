import { Node, mergeAttributes } from '@tiptap/core';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: { default: 'note' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-callout]',
      getAttrs: (element) => {
        if (!(element instanceof HTMLElement)) return false;
        return {
          type: element.getAttribute('data-callout') || 'note',
          title: element.getAttribute('data-title') || '',
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const styles: Record<string, { border: string; background: string }> = {
      note: { border: '#9ca3af', background: '#f3f4f6' },
      info: { border: '#3b82f6', background: '#eff6ff' },
      tip: { border: '#22c55e', background: '#f0fdf4' },
      warning: { border: '#f59e0b', background: '#fefce8' },
      danger: { border: '#ef4444', background: '#fef2f2' },
      bug: { border: '#a855f7', background: '#faf5ff' },
    };
    const style = styles[node.attrs.type] || styles.note;
    const children: any[] = [];
    if (node.attrs.title) {
      children.push(['div', { class: 'callout-title', style: 'font-weight: 600; margin-bottom: 4px;' }, node.attrs.title]);
    }
    children.push(['div', { class: 'callout-content' }, 0]);

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': node.attrs.type,
        ...(node.attrs.title ? { 'data-title': node.attrs.title } : {}),
        class: `callout callout-${node.attrs.type}`,
        style: `border-left: 3px solid ${style.border}; background: ${style.background}; padding: 8px 12px; border-radius: 4px; margin: 8px 0;`,
      }),
      ...children,
    ];
  },
});