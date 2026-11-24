import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* KnowVia distinctive multimodal neural aperture mark */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#18181b] via-[#27272a] to-[#3f3f46] dark:from-[#f4f4f5] dark:via-[#e4e4e7] dark:to-[#d4d4d8] text-white dark:text-[#09090b] flex items-center justify-center shrink-0 shadow-xs border border-black/5 dark:border-white/10 transition-transform hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4.5 h-4.5"
        >
          {/* Vertical spine */}
          <path
            d="M6 4.5V19.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Upper converging intelligence beam */}
          <path
            d="M17.5 5.5L8.5 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Lower multimodal ray */}
          <path
            d="M10.5 10.5L18 18.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Neural focal node */}
          <circle
            cx="14"
            cy="12"
            r="1.2"
            fill="currentColor"
            className="animate-pulse"
          />
        </svg>
      </div>

      {!compact && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-sans-editorial text-sm font-semibold tracking-tight text-[#0c0a09] dark:text-[#f5f5f5] leading-none">
              KnowVia
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#f0efed] dark:bg-[#292524] text-[#777169] dark:text-[#a8a29e] font-medium border border-[#e7e5e4] dark:border-[#27272a]">
              AI
            </span>
          </div>
          <span className="text-[10px] tracking-wider uppercase font-sans-editorial text-[#777169] dark:text-[#a8a29e] mt-1">
            Multimodal Research Intelligence
          </span>
        </div>
      )}
    </div>
  );
};
