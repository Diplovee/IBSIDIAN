import React, { useMemo, useState } from 'react';
import { Trash2, RotateCcw, X, Layers, Globe, Pin, Search } from 'lucide-react';
import { useLibrary } from '../contexts/LibraryContext';
import { useTabs } from '../contexts/TabsContext';

type ModalTab = 'active' | 'browser' | 'forever';
type HistoryRange = 'all' | 'today' | 'week' | 'month';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (entryDay.getTime() === today.getTime()) return 'Today';
  if (entryDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatSavedDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const deriveUrlLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
};

const isInRange = (ts: number, range: HistoryRange): boolean => {
  if (range === 'all') return true;
  const now = new Date();
  const date = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') return date >= todayStart;
  if (range === 'week') {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    return date >= weekStart;
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return date >= monthStart;
};

const FaviconImg: React.FC<{ src?: string; size?: number }> = ({ src, size = 16 }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Globe size={size} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
  return (
    <img
      src={src}
      width={size}
      height={size}
      style={{ flexShrink: 0, objectFit: 'contain' }}
      onError={() => setFailed(true)}
      alt=""
    />
  );
};

interface LibraryModalProps {
  onClose: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('active');
  const [historyQuery, setHistoryQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [historyRange, setHistoryRange] = useState<HistoryRange>('all');
  const { savedGroups, history, saveGroup, deleteSavedGroup, removeHistoryEntry, clearHistory } = useLibrary();
  const { browserGroups, tabs, openTab, createBrowserGroup } = useTabs();

  const pinnedUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const group of savedGroups) {
      for (const tab of group.tabs) {
        if (tab.url?.trim()) urls.add(tab.url.trim());
      }
    }
    return urls;
  }, [savedGroups]);

  const historyGroups = useMemo(() => {
    const groups = new Map<string, string>();
    for (const entry of history) {
      const id = entry.groupId?.trim();
      if (!id) continue;
      const name = entry.groupName?.trim() || 'Unnamed group';
      if (!groups.has(id)) groups.set(id, name);
    }
    return Array.from(groups.entries()).map(([id, name]) => ({ id, name }));
  }, [history]);

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return history.filter(entry => {
      if (selectedGroupId !== 'all' && (entry.groupId ?? '') !== selectedGroupId) return false;
      if (!isInRange(entry.visitedAt, historyRange)) return false;
      if (!query) return true;
      const title = entry.title?.toLowerCase() ?? '';
      const url = entry.url?.toLowerCase() ?? '';
      const groupName = entry.groupName?.toLowerCase() ?? '';
      return title.includes(query) || url.includes(query) || groupName.includes(query);
    });
  }, [history, historyQuery, selectedGroupId, historyRange]);

  const historyByDate: { label: string; entries: typeof history }[] = [];
  const seen = new Set<string>();
  for (const entry of filteredHistory) {
    const label = formatDate(entry.visitedAt);
    if (!seen.has(label)) {
      seen.add(label);
      historyByDate.push({ label, entries: [] });
    }
    historyByDate[historyByDate.length - 1].entries.push(entry);
  }

  const handleSaveGroup = (group: { id: string; name: string; color: string }) => {
    const groupTabs = tabs
      .filter(t => t.groupId === group.id && t.type === 'browser' && typeof t.url === 'string' && t.url.trim().length > 0)
      .map(t => ({ url: t.url!, title: t.title, faviconUrl: t.faviconUrl }));
    if (groupTabs.length === 0) return;
    saveGroup({ id: group.id, name: group.name, color: group.color, tabs: groupTabs, savedAt: Date.now() });
  };

  const handleRestoreGroup = (sg: typeof savedGroups[number]) => {
    const validTabs = sg.tabs.filter(tab => typeof tab.url === 'string' && tab.url.trim().length > 0);
    if (validTabs.length === 0) return;

    const groupId = createBrowserGroup(sg.name, sg.color);
    for (const tab of validTabs) {
      openTab({
        type: 'browser',
        title: tab.title || tab.url,
        url: tab.url,
        faviconUrl: tab.faviconUrl,
        groupId,
      });
    }
  };

  const handleSaveHistoryEntry = (entry: typeof history[number]) => {
    if (pinnedUrls.has(entry.url)) return;
    const safeId = entry.id || Math.random().toString(36).slice(2, 10);
    saveGroup({
      id: `history-${safeId}-${Date.now().toString(36)}`,
      name: entry.title?.trim() || deriveUrlLabel(entry.url),
      color: '#2563eb',
      tabs: [{ url: entry.url, title: entry.title || entry.url, faviconUrl: entry.faviconUrl }],
      savedAt: Date.now(),
    });
  };

  const handleSaveFilteredHistory = () => {
    for (const entry of filteredHistory) {
      if (!pinnedUrls.has(entry.url)) handleSaveHistoryEntry(entry);
    }
  };

  const handleDeleteFilteredHistory = () => {
    for (const entry of filteredHistory) removeHistoryEntry(entry.id);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9998 }}
      />

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(760px, calc(100vw - 32px))',
          height: 'min(640px, calc(100vh - 32px))',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Library</span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '12px 20px 0' }}>
          {(['active', 'browser', 'forever'] as ModalTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: activeTab === tab ? 'var(--accent)' : 'var(--bg-secondary)',
                color: activeTab === tab ? '#fff' : 'var(--text-primary)',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {tab === 'active' && <Layers size={14} />}
              {tab === 'browser' && <Globe size={14} />}
              {tab === 'forever' && <Pin size={14} />}
              {tab === 'active' ? 'Active' : tab === 'browser' ? 'Browser History' : 'Forever'}
            </button>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '12px 0 0' }} />

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {activeTab === 'active' && (
            <ActiveTab
              browserGroups={browserGroups}
              tabs={tabs}
              onSave={handleSaveGroup}
            />
          )}
          {activeTab === 'browser' && (
            <HistoryTab
              historyByDate={historyByDate}
              historyQuery={historyQuery}
              onHistoryQueryChange={setHistoryQuery}
              selectedGroupId={selectedGroupId}
              historyGroups={historyGroups}
              historyRange={historyRange}
              onSelectRange={setHistoryRange}
              onSelectGroup={setSelectedGroupId}
              pinnedUrls={pinnedUrls}
              onOpenEntry={(entry) => openTab({ type: 'browser', title: entry.title || entry.url, url: entry.url, faviconUrl: entry.faviconUrl, groupId: entry.groupId })}
              onSaveEntry={handleSaveHistoryEntry}
              onSaveFiltered={handleSaveFilteredHistory}
              onDeleteFiltered={handleDeleteFilteredHistory}
              onDeleteEntry={removeHistoryEntry}
              onClearHistory={clearHistory}
            />
          )}
          {activeTab === 'forever' && (
            <ForeverTab
              savedGroups={savedGroups}
              onRestore={handleRestoreGroup}
              onDelete={deleteSavedGroup}
            />
          )}
        </div>
      </div>
    </>
  );
};

interface ActiveTabProps {
  browserGroups: { id: string; name: string; color: string; collapsed?: boolean }[];
  tabs: { id: string; type: string; groupId?: string; url?: string; title: string; faviconUrl?: string }[];
  onSave: (group: { id: string; name: string; color: string }) => void;
}

const ActiveTab: React.FC<ActiveTabProps> = ({ browserGroups, tabs, onSave }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (browserGroups.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No active groups</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0 16px' }}>
      {browserGroups.map(group => {
        const browserTabsInGroup = tabs.filter(t => t.groupId === group.id && t.type === 'browser' && typeof t.url === 'string' && t.url.trim().length > 0);
        const count = browserTabsInGroup.length;
        const isHovered = hoveredId === group.id;
        return (
          <div
            key={group.id}
            onMouseEnter={() => setHoveredId(group.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 20px', cursor: 'default',
              background: isHovered ? 'var(--bg-hover)' : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
              {count} tab{count !== 1 ? 's' : ''}
            </span>
            {isHovered && (
              <button
                onClick={() => onSave(group)}
                title={count > 0 ? 'Keep forever' : 'No browser tabs to save'}
                disabled={count === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, cursor: count === 0 ? 'default' : 'pointer', opacity: count === 0 ? 0.45 : 1, flexShrink: 0 }}
              >
                <Pin size={13} />
                Keep forever
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface HistoryTabProps {
  historyByDate: { label: string; entries: { id: string; url: string; title: string; faviconUrl?: string; visitedAt: number; groupId?: string; groupName?: string }[] }[];
  historyQuery: string;
  onHistoryQueryChange: (value: string) => void;
  selectedGroupId: string;
  historyGroups: { id: string; name: string }[];
  historyRange: HistoryRange;
  onSelectRange: (range: HistoryRange) => void;
  onSelectGroup: (groupId: string) => void;
  pinnedUrls: Set<string>;
  onOpenEntry: (entry: { id: string; url: string; title: string; faviconUrl?: string; visitedAt: number; groupId?: string; groupName?: string }) => void;
  onSaveEntry: (entry: { id: string; url: string; title: string; faviconUrl?: string; visitedAt: number; groupId?: string; groupName?: string }) => void;
  onSaveFiltered: () => void;
  onDeleteFiltered: () => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({ historyByDate, historyQuery, onHistoryQueryChange, selectedGroupId, historyGroups, historyRange, onSelectRange, onSelectGroup, pinnedUrls, onOpenEntry, onSaveEntry, onSaveFiltered, onDeleteFiltered, onDeleteEntry, onClearHistory }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const hasHistory = historyByDate.length > 0;

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ padding: '12px 20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <HistoryFilterChip active={historyRange === 'all'} label="All time" onClick={() => onSelectRange('all')} />
          <HistoryFilterChip active={historyRange === 'today'} label="Today" onClick={() => onSelectRange('today')} />
          <HistoryFilterChip active={historyRange === 'week'} label="7 days" onClick={() => onSelectRange('week')} />
          <HistoryFilterChip active={historyRange === 'month'} label="This month" onClick={() => onSelectRange('month')} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={historyQuery}
            onChange={(e) => onHistoryQueryChange(e.target.value)}
            placeholder="Search history"
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, padding: '8px 0' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <HistoryFilterChip active={selectedGroupId === 'all'} label="All groups" onClick={() => onSelectGroup('all')} />
          {historyGroups.map(group => (
            <HistoryFilterChip key={group.id} active={selectedGroupId === group.id} label={group.name} onClick={() => onSelectGroup(group.id)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onSaveFiltered}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
          >
            Keep filtered
          </button>
          <button
            onClick={onDeleteFiltered}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}
          >
            Delete filtered
          </button>
        </div>
      </div>

      {!hasHistory && (
        <div style={{ padding: '4px 20px 12px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No matching history</div>
        </div>
      )}

      {historyByDate.map(({ label, entries }) => (
        <div key={label}>
          <SectionHeader label={label} />
          {entries.map(entry => {
            const isHovered = hoveredId === entry.id;
            const isPinned = pinnedUrls.has(entry.url);
            return (
              <div
                key={entry.id}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onOpenEntry(entry)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 20px', cursor: 'pointer',
                  background: isHovered ? 'var(--bg-hover)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <FaviconImg src={entry.faviconUrl} size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title || entry.url}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.url}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 9999, padding: '1px 6px', flexShrink: 0 }}>
                      {deriveUrlLabel(entry.url)}
                    </span>
                    {entry.groupName && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 9999, padding: '1px 6px', flexShrink: 0 }}>
                        {entry.groupName}
                      </span>
                    )}
                    {isPinned && (
                      <span style={{ fontSize: 10, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 9999, padding: '1px 6px', flexShrink: 0 }}>
                        Pinned
                      </span>
                    )}
                  </div>
                </div>
                {isHovered && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!isPinned) onSaveEntry(entry); }}
                      title={isPinned ? 'Already pinned' : 'Keep forever'}
                      style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: isPinned ? 'var(--accent)' : 'var(--text-primary)', cursor: isPinned ? 'default' : 'pointer', opacity: isPinned ? 0.9 : 1 }}
                    >
                      <Pin size={12} fill={isPinned ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }}
                      title="Remove from history"
                      style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ padding: '12px 20px 0' }}>
        <button
          onClick={onClearHistory}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: '#ef4444',
            fontSize: 13, cursor: 'pointer', fontWeight: 500,
          }}
        >
          <Trash2 size={14} />
          Clear history
        </button>
      </div>
    </div>
  );
};

interface ForeverTabProps {
  savedGroups: { id: string; name: string; color: string; tabs: { url: string; title: string; faviconUrl?: string }[]; savedAt: number }[];
  onRestore: (group: { id: string; name: string; color: string; tabs: { url: string; title: string; faviconUrl?: string }[]; savedAt: number }) => void;
  onDelete: (id: string) => void;
}

const ForeverTab: React.FC<ForeverTabProps> = ({ savedGroups, onRestore, onDelete }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (savedGroups.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No saved groups</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0 16px' }}>
      {savedGroups.map(sg => {
        const isHovered = hoveredId === sg.id;
        return (
          <div
            key={sg.id}
            onMouseEnter={() => setHoveredId(sg.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 20px', cursor: 'default',
              background: isHovered ? 'var(--bg-hover)' : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: sg.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sg.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
              {sg.tabs.length} tab{sg.tabs.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              {formatSavedDate(sg.savedAt)}
            </span>
            {isHovered && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => onRestore(sg)}
                  title="Restore group"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
                <button
                  onClick={() => onDelete(sg.id)}
                  title="Delete saved group"
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const HistoryFilterChip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      border: '1px solid var(--border)',
      background: active ? 'var(--accent-soft)' : 'var(--bg-secondary)',
      color: active ? 'var(--accent)' : 'var(--text-secondary)',
      borderRadius: 9999,
      padding: '3px 10px',
      fontSize: 11,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      fontWeight: 600,
    }}
  >
    {label}
  </button>
);

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    padding: '4px 20px 4px',
    fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    background: 'var(--bg-secondary)',
    marginBottom: 2,
  }}>
    {label}
  </div>
);
