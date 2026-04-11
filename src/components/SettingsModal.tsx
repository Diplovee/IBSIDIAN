import React, { useEffect, useState } from 'react';
import { X, Sun, Moon } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useAppSettings } from '../contexts/AppSettingsContext';

const CATEGORIES = [
  { id: 'general',    label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor',     label: 'Editor' },
  { id: 'files',      label: 'Files & Links' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

const SectionLabel: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: first ? 0 : 24 }}>
    {children}
  </div>
);

const OptionBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 0.1s' }}
  >
    {children}
  </button>
);

const GeneralPanel: React.FC<{ appVersion: string; aboutText: string; onOpenChangelog: () => void }> = ({ appVersion, aboutText, onOpenChangelog }) => (
  <div>
    <SectionLabel first>Version</SectionLabel>
    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>Ibsidian {appVersion}</div>
    <button
      onClick={onOpenChangelog}
      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
    >
      View changelog
    </button>
    <SectionLabel>About</SectionLabel>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{aboutText}</p>
  </div>
);

const AppearancePanel: React.FC = () => {
  const { theme, setTheme } = useActivity();
  const { settings, updateAppearanceSettings, updateFileTreeSettings } = useAppSettings();
  const fontSize = settings.appearance?.fontSize ?? 'medium';
  const compactMode = settings.appearance?.compactMode ?? false;

  return (
    <div>
      <SectionLabel first>Base color scheme</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        <OptionBtn active={theme === 'light'} onClick={() => setTheme('light')}>
          <Sun size={13} /> Light
        </OptionBtn>
        <OptionBtn active={theme === 'dark'} onClick={() => setTheme('dark')}>
          <Moon size={13} /> Dark
        </OptionBtn>
      </div>

      <SectionLabel>Font size</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['small', 'medium', 'large'] as const).map(s => (
          <OptionBtn key={s} active={fontSize === s} onClick={() => updateAppearanceSettings({ fontSize: s })}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </OptionBtn>
        ))}
      </div>

      <SectionLabel>Interface density</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        <OptionBtn active={!compactMode} onClick={() => updateAppearanceSettings({ compactMode: false })}>Default</OptionBtn>
        <OptionBtn active={compactMode} onClick={() => updateAppearanceSettings({ compactMode: true })}>Compact</OptionBtn>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
        Compact reduces file tree row height for a denser layout.
      </p>

      <SectionLabel>File tree style</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['original', 'hierarchy'] as const).map(s => (
          <OptionBtn key={s} active={settings.fileTree.style === s} onClick={() => updateFileTreeSettings({ style: s })}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </OptionBtn>
        ))}
      </div>
    </div>
  );
};

const EditorPanel: React.FC = () => (
  <div>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Editor settings coming soon.</p>
  </div>
);

const FilesPanel: React.FC = () => {
  const { settings, updateAttachmentSettings } = useAppSettings();
  return (
    <div>
      <SectionLabel first>Default location for new attachments</SectionLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <OptionBtn
          active={settings.attachments.attachmentLocation === 'specific-folder'}
          onClick={() => updateAttachmentSettings({ attachmentLocation: 'specific-folder' })}
        >
          Specific folder
        </OptionBtn>
        <OptionBtn
          active={settings.attachments.attachmentLocation === 'same-folder-as-note'}
          onClick={() => updateAttachmentSettings({ attachmentLocation: 'same-folder-as-note' })}
        >
          Same folder as note
        </OptionBtn>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Default attachment folder</div>
      <input
        type="text"
        value={settings.attachments.attachmentFolderPath}
        disabled={settings.attachments.attachmentLocation !== 'specific-folder'}
        onChange={(e) => updateAttachmentSettings({ attachmentFolderPath: e.target.value })}
        placeholder="attachments/images"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: settings.attachments.attachmentLocation === 'specific-folder' ? 'var(--bg-primary)' : 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
      />
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
        New pasted or dropped images are saved inside the vault and embedded with `![[...]]`.
      </p>
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings } = useActivity();
  const [activeCategory, setActiveCategory] = useState<CategoryId>('appearance');
  const [hoveredNav, setHoveredNav] = useState<CategoryId | null>(null);
  const [isChangelogOpen, setChangelogOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('Unknown');
  const [changelogText, setChangelogText] = useState('Loading changelog...');
  const aboutText = 'Ibsidian is a local-first desktop knowledge vault for notes, drawings, attachments, and research, built with Electron, React, and CodeMirror.';

  useEffect(() => {
    fetch('/version.txt').then(r => r.text()).then(text => setAppVersion(text.trim())).catch(() => {});
    fetch('/changelog.txt').then(r => r.text()).then(text => setChangelogText(text)).catch(() => setChangelogText('Failed to load changelog.'));
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isChangelogOpen) setChangelogOpen(false);
        else closeSettings();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSettingsOpen, isChangelogOpen, closeSettings]);

  if (!isSettingsOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh', paddingLeft: 16, paddingRight: 16, background: 'rgba(0,0,0,0.25)' }}
      onClick={() => {
        if (isChangelogOpen) setChangelogOpen(false);
        else closeSettings();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 780, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '14px 16px', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</span>
          <button
            onClick={closeSettings}
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}
          >
            <X size={14} color="var(--bg-primary)" />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', minHeight: 0 }}>
          {/* Left nav */}
          <div style={{ width: 180, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '8px 0' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                onMouseEnter={() => setHoveredNav(cat.id)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', fontSize: 13, fontWeight: activeCategory === cat.id ? 600 : 400, border: 'none', cursor: 'pointer', borderRadius: 0, background: activeCategory === cat.id ? 'var(--accent-soft)' : hoveredNav === cat.id ? 'var(--bg-hover)' : 'transparent', color: activeCategory === cat.id ? 'var(--accent)' : hoveredNav === cat.id ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'background 0.1s, color 0.1s' }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '68vh', padding: '20px 24px' }}>
            {activeCategory === 'general' && <GeneralPanel appVersion={appVersion} aboutText={aboutText} onOpenChangelog={() => setChangelogOpen(true)} />}
            {activeCategory === 'appearance' && <AppearancePanel />}
            {activeCategory === 'editor' && <EditorPanel />}
            {activeCategory === 'files' && <FilesPanel />}
          </div>
        </div>
      </div>

      {/* Changelog overlay */}
      {isChangelogOpen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, zIndex: 111, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            style={{ width: '100%', maxWidth: 760, maxHeight: '78vh', display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Changelog</span>
              <button
                onClick={() => setChangelogOpen(false)}
                style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}
              >
                <X size={14} color="var(--bg-primary)" />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: 16 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {changelogText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
