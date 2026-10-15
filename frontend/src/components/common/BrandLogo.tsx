import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Signature 4-spoke radial spike glyph inspired by DESIGN.md Anthropic mark */}
      <div className="relative w-8 h-8 rounded-lg bg-[#cc785c] text-white flex items-center justify-center shadow-sm shrink-0">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white"
        >
          {/* 4-spoke asterisk mark */}
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
          <line x1="5.6" y1="18.4" x2="18.4" y2="5.6" />
        </svg>
      </div>

      {!compact && (
        <div className="flex flex-col">
          <span className="font-serif-display text-lg font-medium tracking-tight text-[#141413] dark:text-[#faf9f5] leading-none">
            Aethelgard
          </span>
          <span className="text-[10px] tracking-wider uppercase font-sans-body font-medium text-[#6c6a64] dark:text-[#9e998f] mt-1">
            Research Workspace
          </span>
        </div>
      )}
    </div>
  );
};
