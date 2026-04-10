import type { AppSettings } from '../types';

interface AttachmentVaultNode {
  id: string;
  type: 'file' | 'folder';
  children?: AttachmentVaultNode[];
}

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

export const DEFAULT_APP_SETTINGS: AppSettings = {
  attachments: {
    attachmentLocation: 'specific-folder',
    attachmentFolderPath: 'attachments/images',
  },
  fileTree: {
    style: 'original',
  },
};

export const normalizeVaultPath = (value: string) =>
  value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');

export const getPastedImageExtension = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/svg+xml') return 'svg';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/bmp') return 'bmp';
  if (normalized === 'image/x-icon') return 'ico';
  if (normalized === 'image/avif') return 'avif';
  return 'png';
};

export const buildTimestampedImageName = (mimeType: string, stamp = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  const label = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}-${pad(stamp.getMinutes())}-${pad(stamp.getSeconds())}`;
  return `Pasted image ${label}.${getPastedImageExtension(mimeType)}`;
};

export const joinVaultPath = (...parts: Array<string | undefined>) => {
  const joined = parts.filter(Boolean).map(part => normalizeVaultPath(String(part))).filter(Boolean).join('/');
  return normalizeVaultPath(joined);
};

const getNoteFolder = (notePath?: string) => {
  const normalized = normalizeVaultPath(notePath ?? '');
  if (!normalized.includes('/')) return '';
  return normalized.slice(0, normalized.lastIndexOf('/'));
};

export const listVaultFilePaths = (nodes: AttachmentVaultNode[]): Set<string> => {
  const paths = new Set<string>();
  const visit = (items: AttachmentVaultNode[]) => {
    for (const item of items) {
      if (item.type === 'file') paths.add(item.id);
      if (item.type === 'folder') visit(item.children);
    }
  };
  visit(nodes);
  return paths;
};

export const ensureUniqueVaultPath = (desiredPath: string, existingPaths: Set<string>) => {
  const normalized = normalizeVaultPath(desiredPath);
  if (!existingPaths.has(normalized)) return normalized;

  const slashIndex = normalized.lastIndexOf('/');
  const folder = slashIndex >= 0 ? normalized.slice(0, slashIndex) : '';
  const fileName = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex) : '';

  let counter = 1;
  while (true) {
    const candidateName = `${base} ${counter}${ext}`;
    const candidatePath = joinVaultPath(folder, candidateName);
    if (!existingPaths.has(candidatePath)) return candidatePath;
    counter += 1;
  }
};

export const resolveAttachmentDestination = (
  settings: AppSettings,
  notePath: string | undefined,
  fileName: string,
) => {
  const folder = settings.attachments.attachmentLocation === 'same-folder-as-note'
    ? getNoteFolder(notePath)
    : normalizeVaultPath(settings.attachments.attachmentFolderPath);
  const fullPath = joinVaultPath(folder, fileName);
  const embedTarget = settings.attachments.attachmentLocation === 'same-folder-as-note'
    ? fileName
    : fullPath;
  return { fullPath, embedTarget };
};

export const isImagePath = (value: string) => {
  if (!value || value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file://')) {
    return false;
  }
  const ext = value.split('.').pop()?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.has(ext);
};
