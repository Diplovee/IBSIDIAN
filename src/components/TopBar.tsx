import React, { useState, useRef, useEffect } from 'react';
import { Sidebar, FolderOpen, ChevronDown, Plus, History, LogOut } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';

export const TopBar: React.FC = () => {
  const { isSidebarCollapsed, setSidebarCollapsed } = useActivity();
  const { vault, recentVaults, setActiveVault, clearActiveVault } = useVault();
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProjectMenu) return;
    const handleClickAway = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowProjectMenu(false);
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [showProjectMenu]);

  const handleOpenFolder = async () => {
    const path = await window.api.vault.selectFolder();
    if (path) {
      const name = path.split(/[/\\]/).pop() || 'Project';
      const newVault = { id: Math.random().toString(36).substr(2, 9), name, path };
      await window.api.vault.open(newVault);
      setActiveVault(newVault);
      setShowProjectMenu(false);
    }
  };

  const switchVault = async (v: { id: string; name: string; path: string }) => {
    await window.api.vault.open(v);
    setActiveVault(v);
    setShowProjectMenu(false);
  };

  return (
    <div style={{ height: 44, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', zIndex: 40, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, userSelect: 'none', backgroundColor: '#7c3aed' }}>
          I
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Ibsidian</span>
        {vault && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>/</span>
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', borderRadius: 6,
                border: 'none', background: showProjectMenu ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.1s'
              }}
              onMouseEnter={e => { if (!showProjectMenu) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!showProjectMenu) e.currentTarget.style.background = 'transparent'; }}
            >
              <FolderOpen size={13} style={{ color: 'var(--accent)' }} />
              <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vault.name}</span>
              <ChevronDown size={14} style={{ opacity: 0.6, transform: showProjectMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {showProjectMenu && (
              <div
                ref={menuRef}
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 8,
                  width: 280, background: 'var(--bg-primary)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  boxShadow: 'var(--shadow-md)', padding: 6, zIndex: 1000
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px 4px' }}>
                  Recent Projects
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 6 }}>
                  {recentVaults.map(rv => (
                    <button
                      key={rv.id}
                      onClick={() => switchVault(rv)}
                      style={{
                        width: '100%', display: 'flex', flexDirection: 'column', gap: 2,
                        padding: '8px 10px', borderRadius: 6, border: 'none',
                        background: rv.id === vault.id ? 'var(--accent-soft)' : 'transparent',
                        textAlign: 'left', cursor: 'pointer', transition: 'background 0.1s'
                      }}
                      onMouseEnter={e => { if (rv.id !== vault.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { if (rv.id !== vault.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <History size={13} style={{ color: rv.id === vault.id ? 'var(--accent)' : 'var(--text-muted)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: rv.id === vault.id ? 'var(--accent)' : 'var(--text-primary)' }}>{rv.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 21, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rv.path}</div>
                    </button>
                  ))}
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
                
                <button
                  onClick={handleOpenFolder}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 10px', borderRadius: 6, border: 'none',
                    background: 'transparent', color: 'var(--text-primary)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Plus size={14} style={{ color: 'var(--accent)' }} />
                  Open folder...
                </button>

                <button
                  onClick={() => { clearActiveVault(); setShowProjectMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 10px', borderRadius: 6, border: 'none',
                    background: 'transparent', color: 'var(--text-primary)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <FolderOpen size={14} style={{ color: 'var(--accent)' }} />
                  New vault...
                </button>

                <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />

                <button
                  onClick={() => { clearActiveVault(); setShowProjectMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 10px', borderRadius: 6, border: 'none',
                    background: 'transparent', color: '#f87171',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <LogOut size={14} />
                  Close Project
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
        >
          <Sidebar size={16} />
        </button>
      </div>
    </div>
  );
};
