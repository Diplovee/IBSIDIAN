import React from 'react';

export const IbsidianIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" opacity="0.15" />
    <text
      x="8"
      y="12"
      fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
      fontSize="10"
      fontWeight="700"
      fill="currentColor"
      textAnchor="middle"
    >
      I
    </text>
  </svg>
);
