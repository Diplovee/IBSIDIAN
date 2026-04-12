export interface VaultTreeNode {
  id: string;
  type: 'file' | 'folder';
  name: string;
  ext?: string;
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

export interface ResolvedVaultEmbed {
  path: string;
  title: string;
  type: 'note' | 'draw' | 'image';
  anchor?: MarkdownAnchor | null;
}

export interface VaultTarget {
  path: string;
  name: string;
  title: string;
  type: 'note' | 'draw' | 'image';
}

export type MarkdownSupportStatus = 'supported' | 'partial' | 'missing';

export type MarkdownFeatureKey =
  | 'headings'
  | 'paragraphs'
  | 'line-breaks'
  | 'emphasis'
  | 'blockquotes'
  | 'lists'
  | 'code'
  | 'horizontal-rules'
  | 'links'
  | 'images'
  | 'escaping-characters'
  | 'html';

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
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

export const preprocessObsidianMarkdown = (value: string) => {
  // Strip Obsidian comments %%...%% (single-line and multi-line)
  const withoutComments = value.replace(/%%[\s\S]*?%%/g, '');

  // Convert ==highlight== to <mark>highlight</mark> (rehype-raw passes it through)
  const withHighlights = withoutComments.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

  // Convert wikilink embeds ![[...]] before regular wikilinks
  const withEmbeds = withHighlights.replace(/!\[\[([^[\]\n]+)\]\]/g, (_match, rawInner) => {
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
      if (item.type === 'file' && (item.ext === 'md' || item.ext === 'excalidraw' || (item.ext && IMAGE_EXTENSIONS.has(item.ext)))) {
        const title = item.name.replace(/\.[^.]+$/i, '');
        targets.push({
          path: item.id,
          name: item.name,
          title,
          type: item.ext === 'excalidraw' ? 'draw' : item.ext === 'md' ? 'note' : 'image',
        });
      }
      if (item.children?.length) visit(item.children);
    }
  };

  visit(nodes);
  return targets.sort((a, b) => a.title.localeCompare(b.title));
};

const normalizeTargetPath = (value: string) => value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

const getCurrentFolderPath = (currentPath?: string | null) => {
  const normalized = normalizeTargetPath(currentPath ?? '');
  if (!normalized.includes('/')) return '';
  return normalized.slice(0, normalized.lastIndexOf('/'));
};

const buildLookupCandidates = (cleaned: string, currentPath?: string | null) => {
  const candidates = new Set<string>();
  const normalized = normalizeTargetPath(cleaned);
  if (normalized) candidates.add(normalized);
  const currentFolder = getCurrentFolderPath(currentPath);
  if (normalized && currentFolder) candidates.add(`${currentFolder}/${normalized}`);
  return candidates;
};

const resolveVaultFile = (
  rawTarget: string,
  nodes: VaultTreeNode[],
  currentPath: string | null | undefined,
  matchFile: (item: VaultTreeNode, bare: string) => boolean,
) => {
  const trimmed = rawTarget.trim();
  const hashIndex = trimmed.indexOf('#');
  const targetBase = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const anchorRaw = hashIndex >= 0 ? trimmed.slice(hashIndex + 1) : '';
  const cleaned = normalizeTargetPath(targetBase);
  const directCandidates = buildLookupCandidates(cleaned, currentPath);
  const bareCandidates = new Set(Array.from(directCandidates).map(candidate => candidate.split('/').pop()?.replace(/\.[^.]+$/i, '') || candidate));

  const visit = (items: VaultTreeNode[]): ResolvedVaultEmbed | null => {
    for (const item of items) {
      if (item.type === 'file') {
        const bare = item.name.replace(/\.[^.]+$/i, '');
        if (matchFile(item, bare) && (
          directCandidates.has(item.id) ||
          directCandidates.has(item.name) ||
          bareCandidates.has(bare)
        )) {
          const anchor = anchorRaw
            ? {
                kind: anchorRaw.startsWith('^') ? 'block' : 'heading',
                value: anchorRaw.startsWith('^') ? anchorRaw.slice(1) : anchorRaw,
                label: `#${anchorRaw}`,
                line: -1,
              } as MarkdownAnchor
            : null;
          const type = item.ext === 'excalidraw' ? 'draw' : item.ext === 'md' ? 'note' : 'image';
          return { path: item.id, title: bare, type, anchor };
        }
      }
      if (item.children?.length) {
        const found = visit(item.children);
        if (found) return found;
      }
    }
    return null;
  };

  return visit(nodes);
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
  const resolved = resolveVaultFile(rawTarget, nodes, currentPath, (item, bare) => {
    if (!item.ext || (item.ext !== 'md' && item.ext !== 'excalidraw')) return false;
    const cleaned = normalizeTargetPath(rawTarget.split('#')[0] ?? '');
    if (!cleaned && currentPath) return item.id === currentPath;
    if (cleaned.endsWith('.md') || cleaned.endsWith('.excalidraw')) return item.id === cleaned || item.name === cleaned;
    return bare === cleaned || item.name === cleaned || item.id === cleaned || item.id.endsWith(`/${cleaned}.md`) || item.id.endsWith(`/${cleaned}.excalidraw`);
  });
  if (!resolved || resolved.type === 'image') return null;
  return resolved as ResolvedVaultLink;
};

export const resolveVaultEmbed = (rawTarget: string, nodes: VaultTreeNode[], currentPath?: string | null): ResolvedVaultEmbed | null =>
  resolveVaultFile(rawTarget, nodes, currentPath, (item, bare) => {
    if (!item.ext) return false;
    const cleaned = normalizeTargetPath(rawTarget.split('#')[0] ?? '');
    if (item.ext === 'md' || item.ext === 'excalidraw') {
      if (!cleaned && currentPath) return item.id === currentPath;
      if (cleaned.endsWith('.md') || cleaned.endsWith('.excalidraw')) return item.id === cleaned || item.name === cleaned;
      return bare === cleaned || item.name === cleaned || item.id === cleaned || item.id.endsWith(`/${cleaned}.md`) || item.id.endsWith(`/${cleaned}.excalidraw`);
    }
    if (!IMAGE_EXTENSIONS.has(item.ext)) return false;
    return bare === cleaned || item.name === cleaned || item.id === cleaned || item.id.endsWith(`/${cleaned}`) || item.id.endsWith(`/${item.name}`);
  });
