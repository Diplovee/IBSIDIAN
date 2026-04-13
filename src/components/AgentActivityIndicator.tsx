import React, { useEffect, useRef } from 'react';

export type ActivityType = 'analyzing' | 'planning' | 'reading' | 'writing' | 'listing' | 'complete' | 'error' | 'thinking';

interface AgentActivityIndicatorProps {
  type: ActivityType;
  message: string;
  details?: string;
  isExpanded?: boolean;
}

const typeConfig: Record<ActivityType, { icon: string; color: string; bgColor: string; label: string }> = {
  analyzing: { icon: '🔍', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)', label: 'Analyzing' },
  planning: { icon: '🧠', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)', label: 'Planning' },
  reading: { icon: '📖', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)', label: 'Reading' },
  writing: { icon: '✏️', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Writing' },
  listing: { icon: '📂', color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.1)', label: 'Listing' },
  complete: { icon: '✓', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Complete' },
  error: { icon: '✕', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Error' },
  thinking: { icon: '💭', color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)', label: 'Thinking' },
};

export interface AgentActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  details?: string;
  timestamp: number;
}

interface AgentActivityTimelineProps {
  activities: AgentActivityItem[];
  isActive?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const AgentActivityTimeline: React.FC<AgentActivityTimelineProps> = ({ activities, isActive, collapsed = true, onToggleCollapse }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities, collapsed]);

  if (activities.length === 0) return null;

  const latestActivity = activities[activities.length - 1];

  return (
    <div style={{
      marginTop: 8,
      marginBottom: 12,
      borderRadius: 12,
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* Header / Mini indicator */}
      <div
        onClick={onToggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          cursor: 'pointer',
          background: collapsed ? 'var(--bg-secondary)' : 'var(--bg-hover)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = collapsed ? 'var(--bg-secondary)' : 'var(--bg-hover)'}
      >
        {/* Status indicator */}
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: latestActivity.type === 'error' ? '#EF4444' : isActive ? '#8B5CF6' : '#10B981',
          animation: isActive ? 'pulse 1s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }} />
        
        <span style={{ 
          fontSize: 12, 
          fontWeight: 500, 
          color: latestActivity.type === 'error' ? '#EF4444' : isActive ? '#8B5CF6' : 'var(--text-secondary)',
        }}>
          {typeConfig[latestActivity.type].label}
        </span>
        
        <span style={{ 
          fontSize: 12, 
          color: 'var(--text-muted)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {latestActivity.message}
        </span>
        
        {/* Activity count badge */}
        {activities.length > 1 && (
          <div style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--bg-primary)',
            color: 'var(--text-muted)',
          }}>
            {activities.length}
          </div>
        )}
        
        {/* Chevron */}
        <ChevronIcon collapsed={collapsed} />
      </div>

      {/* Expanded timeline */}
      {!collapsed && (
        <div 
          ref={scrollRef}
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            padding: '8px 14px',
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
          {activities.map((activity, idx) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '6px 0',
                animation: `fadeIn 0.2s ease-out ${idx * 0.03}s both`,
              }}
            >
              <TimelineDot type={activity.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 500, 
                    color: typeConfig[activity.type].color 
                  }}>
                    {typeConfig[activity.type].label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {activity.message}
                  </span>
                </div>
                {activity.details && (
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 400,
                  }}>
                    {activity.details}
                  </div>
                )}
              </div>
              {isActive && idx === activities.length - 1 && (
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#8B5CF6',
                  animation: 'pulse 1s ease-in-out infinite',
                }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ChevronIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    fill="none"
    style={{
      transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
      color: 'var(--text-muted)',
      flexShrink: 0,
    }}
  >
    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TimelineDot: React.FC<{ type: ActivityType }> = ({ type }) => {
  const config = typeConfig[type];
  const isThinking = type === 'thinking' || type === 'analyzing' || type === 'planning';
  
  return (
    <div style={{
      width: 12,
      height: 12,
      borderRadius: isThinking ? '50%' : '3px',
      background: config.color,
      marginTop: 3,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 8,
    }}>
      {type === 'complete' ? '✓' : type === 'error' ? '✕' : ''}
    </div>
  );
};

export const AgentActivityIndicator: React.FC<AgentActivityIndicatorProps> = ({ type, message, details, isExpanded }) => {
  const config = typeConfig[type];
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '10px 14px',
      borderRadius: 10,
      background: config.bgColor,
      border: `1px solid ${config.color}30`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ActivityIcon type={type} color={config.color} />
        <span style={{ fontSize: 13, fontWeight: 500, color: config.color }}>{config.label}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{message}</span>
      </div>
      {details && (
        <div style={{ 
          fontSize: 12, 
          color: 'var(--text-muted)', 
          fontFamily: 'monospace',
          padding: '6px 10px',
          background: 'var(--bg-primary)',
          borderRadius: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {details}
        </div>
      )}
      <style>{keyframes}</style>
    </div>
  );
};

const ActivityIcon: React.FC<{ type: ActivityType; color: string }> = ({ type, color }) => {
  const isThinking = type === 'thinking' || type === 'analyzing' || type === 'planning';
  
  if (type === 'complete') {
    return (
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'popIn 0.3s ease-out',
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  
  if (type === 'error') {
    return (
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  
  if (isThinking) {
    return (
      <div style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{
          width: 16,
          height: 16,
          border: `2px solid ${color}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: type === 'analyzing' ? 'spin 0.8s linear infinite' : 'pulse 1.2s ease-in-out infinite',
        }} />
      </div>
    );
  }
  
  return (
    <div style={{
      width: 20,
      height: 20,
      borderRadius: 6,
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
    }}>
      {typeConfig[type].icon}
    </div>
  );
};

const keyframes = `
  @keyframes popIn {
    0% { transform: scale(0); }
    70% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const MiniActivityIndicator: React.FC<{ type: ActivityType; message: string }> = ({ type, message }) => {
  const config = typeConfig[type];
  const isThinking = type === 'thinking' || type === 'analyzing' || type === 'planning';
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 8,
      background: config.bgColor,
      fontSize: 12,
      color: 'var(--text-secondary)',
    }}>
      <div style={{
        width: 14,
        height: 14,
        border: `2px solid ${config.color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: isThinking ? 'spin 0.8s linear infinite' : 'none',
      }} />
      <span style={{ color: config.color, fontWeight: 500 }}>{config.label}:</span>
      <span>{message}</span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};