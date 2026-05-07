import React from 'react';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import { useModal } from './Modal';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { Plus, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { normalizeNewItemName } from '../utils/fileNaming';

export const DrawList: React.FC = () => {
  const { nodes, createFileRemote, refreshFileTree, nextUntitledName, deleteItem } = useVault();
  const { openTab } = useTabs();
  const { prompt, confirm } = useModal();

  const findDrawFolder = (nodeList: any[]): any => {
    for (const n of nodeList) {
      if (n.type === 'folder' && n.name.toUpperCase() === 'DRAW') return n;
      if (n.type === 'folder' && n.children) {
        const found = findDrawFolder(n.children);
        if (found) return found;
      }
    }
    return null;
  };

  const drawFolder = findDrawFolder(nodes);
  const drawings = drawFolder?.children?.filter((n: any) => n.type === 'file' && n.ext === 'excalidraw') || [];

  const handleCreateNew = async () => {
    const requestedName = await prompt({
      title: 'New drawing',
      placeholder: 'Drawing name',
      defaultValue: nextUntitledName(),
      confirmLabel: 'Create',
    });
    if (!requestedName) return;
    const name = normalizeNewItemName(requestedName, 'excalidraw');
    const folder = drawFolder ? drawFolder.id : 'DRAW';
    await createFileRemote(folder, name, 'excalidraw');
    await refreshFileTree(undefined, { showLoading: false });
    openTab({ type: 'draw', title: name, filePath: `${folder}/${name}.excalidraw` });
  };

  const handleOpen = (drawing: any) => {
    openTab({ type: 'draw', title: drawing.name.replace(/\.excalidraw$/, ''), filePath: drawing.id });
  };

  const handleDelete = async (drawing: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete drawing',
      message: `Are you sure you want to delete "${drawing.name.replace(/\.excalidraw$/, '')}"?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      await deleteItem(drawing.id);
      await refreshFileTree(undefined, { showLoading: false });
    }
  };

  return (
    <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <ExcalidrawIcon size={32} color="#e67700" />
              Drawings
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>
              Manage your Excalidraw diagrams and sketches in the DRAW folder.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.2)',
            }}
          >
            <Plus size={18} />
            New Drawing
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
          {drawings.map(drawing => (
            <div
              key={drawing.id}
              onClick={() => handleOpen(drawing)}
              className="draw-card"
              style={{
                position: 'relative',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'var(--bg-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
              }}>
                <ExcalidrawIcon size={32} color="#e67700" />
              </div>
              <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {drawing.name.replace(/\.excalidraw$/, '')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Excalidraw file
                </div>
              </div>

              <div className="draw-card-actions" style={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                gap: 4,
                opacity: 0,
                transition: 'opacity 0.2s',
              }}>
                <button
                  onClick={(e) => handleDelete(drawing, e)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {drawings.length === 0 && (
            <div
              onClick={handleCreateNew}
              style={{
                gridColumn: '1 / -1',
                padding: '60px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed var(--border)',
                borderRadius: 16,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <FolderOpen size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>No drawings yet</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Click to create your first drawing</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .draw-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          background: var(--bg-primary);
        }
        .draw-card:hover .draw-card-actions {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};
