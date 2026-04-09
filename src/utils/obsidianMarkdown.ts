export interface VaultTreeNode {
  id: string;
  type: 'file' | 'folder';
  name: string;
  ext?: 'md' | 'excalidraw';
  children?: VaultTreeNode[];
  content?: string;
}

export interface MarkdownAnchor {
  kind: 'heading' | 'block';
  value: string;
  label: string;
  line: number;
}

export interface ResolvedVaultLink {
  path: string;
  title: string;
  type: 'note' | 'draw';
  anchor?: MarkdownAnchor | null;
}

export interface VaultTarget {
  path: string;
  name: string;
  title: string;
  type: 'note' | 'draw';
}

export const CALL_OUT_STYLES: Record<string, { border: string; background: string; iconBg: string; label: string }> = {
  note: { border: '#3b82f6', background: 'rgba(59,130,246,0.08)', iconBg: '#3b82f6', label: 'Note' },
  info: { border: '#06b6d4', background: 'rgba(6,182,212,0.08)', iconBg: '#06b6d4', label: 'Info' },
  tip: { border: '#10b981', background: 'rgba(16,185,129,0.08)', iconBg: '#10b981', label: 'Tip' },
  success: { border: '#22c55e', background: 'rgba(34,197,94,0.08)', iconBg: '#22c55e', label: 'Success' },
  warning: { border: '#f59e0b', background: 'rgba(245,158,11,0.08)', iconBg: '#f59e0b', label: 'Warning' },
  danger: { border: '#ef4444', background: 'rgba(239,68,68,0.08)', iconBg: '#ef4444', label: 'Danger' },
  bug: { border: '#ef4444', background: 'rgba(239,68,68,0.08)', iconBg: '#ef4444', label: 'Bug' },
};

export const INTERNAL_LINK_PREFIX = 'ibsidian://note/';
export const INTERNAL_EMBED_PREFIX = 'ibsidian://embed/';

export const preprocessObsidianMarkdown = (value: string) => {
  const withEmbeds = value.replace(/!\[\[([^[\]\n]+)\]\]/g, (_match, rawInner) => {
    const inner = String(rawInner).trim();
    const [targetPart, aliasPart] = inner.split('|');
    const target = targetPart.trim();
    const alias = aliasPart?.trim() || target.split('#')[0].split('/').pop()?.replace(/\.md$/i, '') || target;
    return `![${alias}](${INTERNAL_EMBED_PREFIX}${encodeURIComponent(target)})`;
  });

  return withEmbeds.replace(/\[\[([^[\]\n]+)\]\]/g, (_match, rawInner) => {
    const inner = String(rawInner).trim();
    const [targetPart, aliasPart] = inner.split('|');
    const target = targetPart.trim();
    const alias = aliasPart?.trim() || target.split('#')[0].split('/').pop()?.replace(/\.md$/i, '') || target;
    return `[${alias}](${INTERNAL_LINK_PREFIX}${encodeURIComponent(target)})`;
  });
};

export const getVaultTargets = (nodes: VaultTreeNode[]): VaultTarget[] => {
  const targets: VaultTarget[] = [];

  const visit = (items: VaultTreeNode[]) => {
    for (const item of items) {
      if (item.type === 'file' && (item.ext === 'md' || item.ext === 'excalidraw')) {
        const title = item.name.replace(/\.(md|excalidraw)$/i, '');
        targets.push({
          path: item.id,
          name: item.name,
          title,
          type: item.ext === 'excalidraw' ? 'draw' : 'note',
        });
      }
      if (item.children?.length) visit(item.children);
    }
  };

  visit(nodes);
  return targets.sort((a, b) => a.title.localeCompare(b.title));
};

export const extractMarkdownHeadings = (content: string): MarkdownAnchor[] => {
  const lines = content.split('\n');
  const headings: MarkdownAnchor[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    headings.push({
      kind: 'heading',
      value: match[2].trim(),
      label: `#${match[2].trim()}`,
      line: i,
    });
  }
  return headings;
};

export const extractMarkdownBlockIds = (content: string): MarkdownAnchor[] => {
  const lines = content.split('\n');
  const blocks: MarkdownAnchor[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/\^([A-Za-z0-9-]+)\s*$/);
    if (!match) continue;
    blocks.push({
      kind: 'block',
      value: match[1],
      label: `#^${match[1]}`,
      line: i,
    });
  }
  return blocks;
};

export const extractMarkdownAnchors = (content: string): MarkdownAnchor[] => [
  ...extractMarkdownHeadings(content),
  ...extractMarkdownBlockIds(content),
];

export const resolveVaultLink = (rawTarget: string, nodes: VaultTreeNode[], currentPath?: string | null): ResolvedVaultLink | null => {
  const trimmed = rawTarget.trim();
  const hashIndex = trimmed.indexOf('#');
  const targetBase = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const anchorRaw = hashIndex >= 0 ? trimmed.slice(hashIndex + 1) : '';
  const cleaned = targetBase.trim();
  const direct = cleaned.match(/\.(md|excalidraw)$/i) ? cleaned : cleaned ? `${cleaned}.md` : '';

  const findFile = (items: VaultTreeNode[]): ResolvedVaultLink | null => {
    for (const item of items) {
      if (item.type === 'file') {
        const bare = item.name.replace(/\.(md|excalidraw)$/i, '');
        const isCurrent = currentPath && item.id === currentPath;
        if (
          (cleaned && (item.id === cleaned || item.id === direct || item.name === cleaned || item.name === direct || bare === cleaned)) ||
          (!cleaned && isCurrent)
        ) {
          const type = item.ext === 'excalidraw' ? 'draw' : 'note';
          const anchor = anchorRaw
            ? {
                kind: anchorRaw.startsWith('^') ? 'block' : 'heading',
                value: anchorRaw.startsWith('^') ? anchorRaw.slice(1) : anchorRaw,
                label: `#${anchorRaw}`,
                line: -1,
              } as MarkdownAnchor
            : null;
          return { path: item.id, title: bare, type, anchor };
        }
      }
      if (item.children?.length) {
        const found = findFile(item.children);
        if (found) return found;
      }
    }
    return null;
  };

  return findFile(nodes);
};

