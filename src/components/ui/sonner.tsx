import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { Toaster as SonnerToaster, toast, type ToasterProps } from 'sonner';
import 'sonner/dist/styles.css';

const resolveTheme = (): ToasterProps['theme'] => {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
};

const iconWrapStyle = (accent: string, background: string) => ({
  width: 28,
  height: 28,
  borderRadius: 9999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background,
  color: accent,
});

export const Toaster: React.FC<ToasterProps> = ({
  style,
  toastOptions,
  icons,
  className,
  theme: themeProp,
  closeButton = true,
  richColors: _richColors,
  ...rest
}) => {
  const [theme, setTheme] = useState<ToasterProps['theme']>(themeProp ?? resolveTheme());

  useEffect(() => {
    if (themeProp) return;
    const syncTheme = () => setTheme(resolveTheme());
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [themeProp]);

  const isDark = theme === 'dark';

  const baseToastOptions = useMemo<ToasterProps['toastOptions']>(() => ({
    ...toastOptions,
    style: {
      background: isDark ? 'var(--bg-secondary)' : 'var(--bg-primary)',
      color: 'var(--text-primary)',
      border: `1px solid ${isDark ? 'var(--border-strong)' : 'var(--border)'}`,
      borderLeft: '4px solid var(--accent)',
      borderRadius: 16,
      boxShadow: isDark ? '0 18px 36px rgba(0,0,0,0.38)' : '0 18px 36px rgba(0,0,0,0.16)',
      padding: '14px 14px 14px 14px',
      backdropFilter: 'blur(12px)',
      ...toastOptions?.style,
    },
    classNames: {
      toast: [
        'group',
        'overflow-hidden',
        'rounded-2xl',
        'px-0',
        'py-0',
        'shadow-none',
      ].join(' '),
      title: 'text-[15px] font-semibold leading-5 text-[var(--text-primary)]',
      description: 'text-[13px] leading-6 text-[var(--text-secondary)]',
      actionButton: 'rounded-xl bg-[var(--accent)] text-white border-none hover:bg-[var(--accent-hover)]',
      cancelButton: 'rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-hover)]',
      closeButton: 'rounded-full bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
      ...toastOptions?.classNames,
    },
    actionButtonStyle: {
      borderRadius: 12,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      boxShadow: 'none',
      ...toastOptions?.actionButtonStyle,
    },
    cancelButtonStyle: {
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
      boxShadow: 'none',
      ...toastOptions?.cancelButtonStyle,
    },
  }), [isDark, toastOptions]);

  const mergedIcons = useMemo<NonNullable<ToasterProps['icons']>>(() => ({
    success: <span style={iconWrapStyle('#22c55e', isDark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.12)')}><CheckCircle2 size={16} /></span>,
    info: <span style={iconWrapStyle('var(--accent)', isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.12)')}><Info size={16} /></span>,
    warning: <span style={iconWrapStyle('#f59e0b', isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)')}><AlertTriangle size={16} /></span>,
    error: <span style={iconWrapStyle('#ef4444', isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)')}><CircleAlert size={16} /></span>,
    close: <X size={14} />,
    ...icons,
  }), [icons, isDark]);

  return (
    <SonnerToaster
      theme={theme}
      className={['toaster', className].filter(Boolean).join(' ')}
      closeButton={closeButton}
      richColors={false}
      style={{
        ...style,
      }}
      icons={mergedIcons}
      toastOptions={baseToastOptions}
      {...rest}
    />
  );
};

export { toast };
export type { ToasterProps };
