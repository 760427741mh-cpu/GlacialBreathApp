import React from 'react';
import { SessionPhase } from '../types';

interface BreathingCircleProps {
  phase: SessionPhase;
  progress: number; // 0 to 1
  text: string;
  subText: string;
  isInhale: boolean; // Used during BREATHING phase
}

export const BreathingCircle: React.FC<BreathingCircleProps> = ({ 
  phase, 
  progress, 
  text, 
  subText,
  isInhale
}) => {
  
  // Dynamic styles based on phase
  const getCircleStyle = () => {
    const base = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-[50ms] will-change-transform flex items-center justify-center backdrop-blur-md";
    
    switch (phase) {
      case SessionPhase.IDLE:
        return `${base} w-48 h-48 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.1)]`;
      
      case SessionPhase.BREATHING:
        // Smooth expansion/contraction
        const scale = isInhale ? 1.5 : 0.8;
        // We use a duration that matches half the breath cycle roughly for smoothness, handled by parent state mostly, but transition here helps
        const transitionDuration = isInhale ? 'duration-[1600ms]' : 'duration-[1600ms]';
        return `${base} w-48 h-48 bg-cyan-400/20 border-2 border-cyan-400/50 shadow-[0_0_60px_rgba(34,211,238,0.3)] scale-[${scale}] transition-transform ${transitionDuration} ease-in-out`;
      
      case SessionPhase.RETENTION:
        return `${base} w-48 h-48 bg-rose-500/10 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)] scale-90 animate-pulse`;
      
      case SessionPhase.RECOVERY:
        return `${base} w-48 h-48 bg-emerald-500/20 border-2 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.3)] scale-125`;
      
      default:
        return `${base} w-48 h-48 bg-slate-800`;
    }
  };

  return (
    <div className="relative w-full h-96 flex items-center justify-center overflow-hidden">
      {/* Outer Glow Ring */}
      <div className={`absolute w-64 h-64 rounded-full opacity-20 blur-3xl transition-colors duration-1000
        ${phase === SessionPhase.RETENTION ? 'bg-rose-600' : 
          phase === SessionPhase.RECOVERY ? 'bg-emerald-600' : 'bg-cyan-600'}`} 
      />

      {/* The Breathing Orb */}
      <div className={getCircleStyle()}>
        {/* Inner Content - Keeps text readable regardless of scale */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 transform scale-100"> 
           {/* Note: In a real CSS scale transform, child scales too. 
               To prevent text scaling, we usually apply counter-scale or put text outside. 
               For this effect, scaling the whole orb feels more organic like a lung.
               We will let the text scale slightly or handle it via separate layering if it gets unreadable.
           */}
        </div>
      </div>
      
      {/* Text Overlay (Positioned absolutely so it doesn't scale with the orb) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 pointer-events-none">
         <h1 className="text-4xl font-bold text-white drop-shadow-md tracking-wider font-mono">
            {text}
         </h1>
         <p className="text-sm font-medium text-slate-300 uppercase tracking-[0.2em] mt-2 opacity-80">
            {subText}
         </p>
      </div>
      
      {/* Progress Ring for Recovery/Retention optional viz */}
      {phase === SessionPhase.RECOVERY && (
        <svg className="absolute w-72 h-72 -rotate-90 z-0">
          <circle
            cx="144" cy="144" r="140"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="879"
            strokeDashoffset={879 * (1 - progress)}
            className="opacity-30 transition-all duration-1000 linear"
          />
        </svg>
      )}
    </div>
  );
};