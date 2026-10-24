import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* ElevenLabs iconic dual audio vertical bar mark */}
      <div className="w-8 h-8 rounded-full bg-[#292524] dark:bg-[#f5f5f5] text-white dark:text-[#0c0a09] flex items-center justify-center shrink-0 shadow-xs">
        <div className="flex items-center gap-1">
          <div className="w-1 h-3.5 rounded-full bg-white dark:bg-[#0c0a09]" />
          <div className="w-1 h-4.5 rounded-full bg-white dark:bg-[#0c0a09]" />
        </div>
      </div>

      {!compact && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-sans-editorial text-sm font-semibold tracking-tight text-[#0c0a09] dark:text-[#f5f5f5] leading-none">
              ElevenLabs
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#f0efed] dark:bg-[#292524] text-[#777169] dark:text-[#a8a29e]">
              RAG
            </span>
          </div>
          <span className="text-[10px] tracking-wider uppercase font-sans-editorial text-[#777169] dark:text-[#a8a29e] mt-1">
            Voice & Research Intelligence
          </span>
        </div>
      )}
    </div>
  );
};
