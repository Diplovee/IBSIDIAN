import type { Tab } from '../types';
import { normalizeNewItemName } from './fileNaming';

export type NewDocumentKind = 'markdown';

export interface NewDocumentDeps {
  choose: (opts: {
    title: string;
    message?: string;
    options: Array<{ label: string; value: NewDocumentKind; description?: string }>;
    cancelLabel?: string;
  }) => Promise<NewDocumentKind | null>;
  prompt: (opts: {
    title: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
  }) => Promise<string | null>;
  nextUntitledName: () => string;
  createFileRemote: (folderPath: string, name: string, ext: 'md') => Promise<void>;
  refreshFileTree: (vaultOverride?: unknown, options?: { showLoading?: boolean }) => Promise<void>;
  openTab: (tab: Omit<Tab, 'id'>) => void;
}

export const createNewDocument = async (deps: NewDocumentDeps) => {
  const kind = await deps.choose({
    title: 'Create new document',
    message: 'Pick a Markdown note.',
    options: [
      { label: 'Markdown note', value: 'markdown', description: 'Create a vault file and edit it in CodeMirror.' },
    ],
  });

  if (!kind) return;

  const requestedName = await deps.prompt({
    title: 'New note',
    placeholder: 'Note name',
    defaultValue: deps.nextUntitledName(),
    confirmLabel: 'Create',
  });
  if (!requestedName) return;

  const name = normalizeNewItemName(requestedName, 'md');

  await deps.createFileRemote('', name, 'md');
  await deps.refreshFileTree(undefined, { showLoading: false });
  deps.openTab({ type: 'note', title: name, filePath: `${name}.md` });
};
