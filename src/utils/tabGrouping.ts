import type { Tab } from '../types';

type GroupPrompt = (options: {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}) => Promise<string | null | undefined>;

export const isGroupableTab = (tab: Tab) => (
  tab.type !== 'terminal'
  && tab.type !== 'new-tab'
  && tab.type !== 'claude'
  && tab.type !== 'codex'
  && tab.type !== 'pi'
);

export const defaultGroupNameForTab = (tab: Tab) => (
  (tab.customTitle ?? tab.title).trim() || 'Tab Group'
);

export const promptCreateGroupFromTab = async ({
  tab,
  prompt,
  createBrowserGroup,
  moveTabToGroup,
  color,
}: {
  tab: Tab;
  prompt: GroupPrompt;
  createBrowserGroup: (name: string, color?: string) => string;
  moveTabToGroup: (tabId: string, groupId?: string | null) => void;
  color?: string;
}) => {
  if (!isGroupableTab(tab)) return false;

  const name = await prompt({
    title: 'Create group',
    defaultValue: defaultGroupNameForTab(tab),
    placeholder: 'Group name',
    confirmLabel: 'Create',
  });

  if (!name?.trim()) return false;

  const groupId = createBrowserGroup(name.trim(), color);
  moveTabToGroup(tab.id, groupId);
  return true;
};
