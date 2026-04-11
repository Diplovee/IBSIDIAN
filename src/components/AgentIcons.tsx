import React from 'react';

// Claude brand orange
export const ClaudeIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path fill="#D97757" d="m6.09 15.21l3.83-2.15l.06-.19l-.06-.1h-.19l-.64-.04l-2.19-.06l-1.9-.08l-1.84-.1l-.46-.1l-.43-.57l.04-.29l.39-.26l.56.05l1.23.08l1.85.13l1.34.08l1.99.21h.32l.04-.13l-.11-.08l-.08-.08l-1.91-1.3l-2.07-1.37l-1.08-.79l-.59-.4l-.3-.37l-.13-.82l.53-.59l.71.05l.18.05l.72.56l1.55 1.2l2.02 1.49l.3.25l.12-.08v-.06l-.12-.22l-1.1-1.99L7.5 5.12l-.52-.84l-.14-.5c-.05-.21-.08-.38-.08-.59l.61-.82l.33-.11l.81.11l.34.3l.5 1.15l.81 1.81l1.26 2.46l.37.73l.2.68l.07.21h.13v-.12l.1-1.38l.19-1.7l.19-2.19l.06-.62l.31-.74l.61-.4l.47.23l.39.56l-.05.36l-.23 1.5l-.45 2.36l-.3 1.58h.17l.2-.2l.8-1.06l1.34-1.68l.59-.67l.69-.73l.44-.35h.84l.62.92l-.28.95l-.86 1.09l-.71.93l-1.02 1.38l-.64 1.1l.06.09h.15l2.32-.51l1.25-.23l1.49-.26l.68.32l.07.32l-.27.66l-1.6.39l-1.87.37l-2.79.66l-.03.02l.04.05l1.26.12l.54.03h1.32l2.45.18l.64.42l.38.52l-.06.39l-.99.5l-1.33-.32l-3.1-.74l-1.06-.27h-.15v.09l.89.87l1.63 1.47l2.04 1.89l.1.47l-.26.37l-.28-.04l-1.79-1.35l-.69-.61l-1.56-1.32h-.1v.14l.36.53l1.9 2.86l.1.88l-.14.29l-.49.17l-.54-.1l-1.11-1.56l-1.15-1.76l-.93-1.58l-.11.06l-.55 5.89l-.26.3l-.59.23l-.49-.37l-.26-.61l.26-1.2l.32-1.56l.26-1.24l.23-1.54l.14-.51v-.03l-.12.01l-1.16 1.6l-1.77 2.39l-1.4 1.5l-.34.13l-.58-.3l.05-.54l.33-.48l1.94-2.46l1.17-1.53l.75-.88v-.13h-.05l-5.14 3.34l-.92.12l-.39-.37l.05-.61l.19-.2l1.55-1.06Z"/>
  </svg>
);

// Codex — GPT-5 style gradient: pink → orange → yellow → soft blue
export const CodexIcon: React.FC<{ size?: number }> = ({ size = 18 }) => {
  const id = 'codex-grad';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#F472B6" />
          <stop offset="35%"  stopColor="#FB923C" />
          <stop offset="65%"  stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#93C5FD" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M11.745 14.85L6.905 12V7c0-2.21 1.824-4 4.076-4c1.397 0 2.63.69 3.365 1.741"/>
        <path d="M9.6 19.18A4.1 4.1 0 0 0 13.02 21c2.25 0 4.076-1.79 4.076-4v-5L12.16 9.097"/>
        <path d="M9.452 13.5V7.67l4.412-2.5c1.95-1.105 4.443-.45 5.569 1.463a3.93 3.93 0 0 1 .076 3.866"/>
        <path d="M4.49 13.5a3.93 3.93 0 0 0 .075 3.866c1.126 1.913 3.62 2.568 5.57 1.464l4.412-2.5l.096-5.596"/>
        <path d="M17.096 17.63a4.09 4.09 0 0 0 3.357-1.996c1.126-1.913.458-4.36-1.492-5.464l-4.413-2.5l-5.059 2.755"/>
        <path d="M6.905 6.37a4.09 4.09 0 0 0-3.358 1.996c-1.126 1.914-.458 4.36 1.492 5.464l4.413 2.5l5.048-2.75"/>
      </g>
    </svg>
  );
};

// Pi — dark teal brand color
export const PiIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 800 800">
    <path fill="#3B82F6" fillRule="evenodd" d="
      M165.29 165.29
      H517.36
      V400
      H400
      V517.36
      H282.65
      V634.72
      H165.29
      Z
      M282.65 282.65
      V400
      H400
      V282.65
      Z
    "/>
    <path fill="#3B82F6" d="M517.36 400 H634.72 V634.72 H517.36 Z"/>
  </svg>
);
