import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'var(--bg-primary)',
      flexDirection: 'column',
      gap: 24
    }}>
      <div style={{ 
        width: 64, 
        height: 64, 
        borderRadius: 16, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)',
        animation: 'pulse 2s ease-in-out infinite'
      }}>
        <span style={{ color: 'white', fontSize: 32, fontWeight: 700 }}>I</span>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 700, 
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '-0.5px'
        }}>
          Ibsidian
        </h1>
        <p style={{ 
          fontSize: 13, 
          color: 'var(--text-muted)', 
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}>
          <span style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: 'var(--accent)',
            animation: 'dot 1.4s ease-in-out infinite'
          }} />
          <span style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: 'var(--accent)',
            animation: 'dot 1.4s ease-in-out infinite 0.2s'
          }} />
          <span style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: 'var(--accent)',
            animation: 'dot 1.4s ease-in-out infinite 0.4s'
          }} />
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};