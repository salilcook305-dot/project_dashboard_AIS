import React from 'react';
import logoImg from '../assets/ai_samrat_logo.png';

interface AiSamratLogoProps {
  className?: string;
  showText?: boolean;
  textColor?: string;
  subtitle?: string;
}

export const AiSamratLogo: React.FC<AiSamratLogoProps> = ({
  className = 'w-9 h-9',
  showText = false,
  textColor = 'text-white',
  subtitle = 'Software Solutions',
}) => {
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/20 p-0.5 shrink-0 flex items-center justify-center ${className}`}
      >
        <img
          src={logoImg}
          alt="AI Samrat"
          className="w-full h-full object-contain rounded-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/static/img/ai_samrat_logo.png';
          }}
        />
      </div>

      {showText && (
        <div className="flex flex-col text-left min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`font-black text-sm tracking-wider uppercase truncate ${textColor}`}>
              AI SAMRAT
            </span>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
              PVT LTD
            </span>
          </div>
          <span className="text-[10px] text-sky-200/80 font-medium tracking-tight mt-0.5 truncate">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
};

