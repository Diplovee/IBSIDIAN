import React, { useState } from 'react';
import { Trash2, RotateCcw, X, Clock, Layers, Globe, Pin, History } from 'lucide-react';
import { useLibrary } from '../contexts/LibraryContext';
import { useTabs } from '../contexts/TabsContext';

type ModalTab = 'active' | 'browser' | 'forever';

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
  const { savedGroups, history, saveGroup, deleteSavedGroup, clearHistory } = useLibrary();
  const { browserGroups, tabs, openTab } = useTabs();

  const historyByDate: { label: string; entries: typeof history }[] = [];
  const seen = new Set<string>();
  for (const entry of history) {
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
    for (const tab of sg.tabs) {
      if (!tab.url?.trim()) continue;
      openTab({ type: 'browser', title: tab.title || tab.url, url: tab.url, faviconUrl: tab.faviconUrl });
    }
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
              onOpenEntry={(entry) => openTab({ type: 'browser', title: entry.title || entry.url, url: entry.url, faviconUrl: entry.faviconUrl })}
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
  historyByDate: { label: string; entries: { id: string; url: string; title: string; faviconUrl?: string; visitedAt: number }[] }[];
  onOpenEntry: (entry: { id: string; url: string; title: string; faviconUrl?: string; visitedAt: number }) => void;
  onClearHistory: () => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({ historyByDate, onOpenEntry, onClearHistory }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (historyByDate.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No history yet</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      {historyByDate.map(({ label, entries }) => (
        <div key={label}>
          <SectionHeader label={label} />
          {entries.map(entry => {
            const isHovered = hoveredId === entry.id;
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
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.url}
                  </div>
                </div>
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
