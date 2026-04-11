import React from 'react';
import { Sidebar, FolderOpen } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';

export const TopBar: React.FC = () => {
  const { isSidebarCollapsed, setSidebarCollapsed } = useActivity();
  const { vault } = useVault();

  return (
    <div style={{ height: 44, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', zIndex: 40, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, userSelect: 'none', backgroundColor: '#7c3aed' }}>
          I
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Ibsidian</span>
        {vault && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FolderOpen size={12} />
              {vault.name}
            </span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'default', transition: 'background 0.15s, color 0.15s' }}
        >
          <Sidebar size={16} />
        </button>
      </div>
    </div>
  );
};
