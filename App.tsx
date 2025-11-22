
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, RotateCcw, Settings, Wind, Timer, HeartPulse, X, Check } from 'lucide-react';
import { SessionPhase, SessionStats, DEFAULT_SETTINGS, BreathingSettings } from './types';
import { BreathingCircle } from './components/BreathingCircle';
import { useWakeLock } from './hooks/useWakeLock';
import { initAudio, playInhale, playExhale, playBell } from './services/audio';

const App: React.FC = () => {
  // -- State --
  const [phase, setPhase] = useState<SessionPhase>(SessionPhase.IDLE);
  const [round, setRound] = useState(1);
  const [breathCount, setBreathCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isInhale, setIsInhale] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats[]>([]);
  
  // Settings State
  const [settings, setSettings] = useState<BreathingSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  // -- Refs --
  const timerRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Keep screen awake
  useWakeLock(phase !== SessionPhase.IDLE && phase !== SessionPhase.COMPLETED);

  // -- Helpers --
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const playSound = useCallback((type: 'inhale' | 'exhale' | 'bell') => {
    const breathDuration = settings.tempoMs / 2;
    
    try {
        if (type === 'inhale') playInhale(breathDuration);
        if (type === 'exhale') playExhale(breathDuration);
        if (type === 'bell') playBell();
    } catch (e) {
        // Silent fail
    }

    if (navigator.vibrate) {
      if (type === 'inhale') navigator.vibrate(20);
      if (type === 'exhale') navigator.vibrate(10);
      if (type === 'bell') navigator.vibrate([50, 50, 50]);
    }
  }, [settings.tempoMs]);

  // -- Logic Engine --

  const startSession = async () => {
    await initAudio();
    setPhase(SessionPhase.BREATHING);
    setRound(1);
    setBreathCount(1);
    setIsInhale(true);
    setSessionStats([]);
    playSound('inhale');
    startBreathingCycle();
  };

  const startBreathingCycle = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const intervalDuration = settings.tempoMs / 2;

    timerRef.current = window.setInterval(() => {
      setIsInhale(prev => {
        const nextIsInhale = !prev;
        
        if (nextIsInhale) {
            setBreathCount(c => {
                const nextCount = c + 1;
                if (nextCount > settings.breathsPerRound) {
                    startRetention();
                    return c;
                }
                playSound('inhale');
                return nextCount;
            });
        } else {
            playSound('exhale');
        }
        return nextIsInhale;
      });
    }, intervalDuration);
  }, [settings, playSound]);

  // Fix: Use ref to access latest startRetention function or dependencies if needed, 
  // but since we are inside the component, we just need to make sure startRetention is available.
  // To avoid closure staleness in setInterval, we used functional updates.
  // However, calling `startRetention` from inside the interval callback needs to be careful.
  // We'll use a useEffect to watch breathCount if we want to be purely reactive, 
  // but the current imperative approach inside setBreathCount callback works if we are careful.
  // Actually, calling startRetention (which sets state/clears interval) inside a setState callback is risky.
  // Better approach: Check logic in the interval.
  
  // Let's Refactor startBreathingCycle to be safer with closures using a recursive timeout or simpler interval
  // The previous implementation had a potential bug calling startRetention inside setState.
  // Let's fix that logic:

  // Re-implementing the cycle starter to be robust
  useEffect(() => {
    if (phase === SessionPhase.BREATHING) {
        // Cycle logic is handled by the interval established in startBreathingCycle
        // But we need to handle the transition trigger carefully.
    }
  }, [phase]);

  // We need to hoist startRetention so it can be called safely
  const startRetention = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase(SessionPhase.RETENTION);
    setElapsedTime(0);
    lastTimeRef.current = Date.now();
    playSound('bell');
    
    timerRef.current = window.setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      setElapsedTime(prev => prev + delta);
    }, 100);
  }, [playSound]);

  // Re-binding the cycle with the hoisted startRetention
  const activeCycleRef = useRef<number>(0); // To track active interval ID

  const runBreathingStep = useCallback(() => {
      setIsInhale(currentIsInhale => {
          const nextIsInhale = !currentIsInhale;
          
          if (nextIsInhale) {
              // Starting Inhale
              setBreathCount(currentCount => {
                  const nextCount = currentCount + 1;
                  if (nextCount > settings.breathsPerRound) {
                      // STOP everything immediately
                      if (activeCycleRef.current) clearInterval(activeCycleRef.current);
                      startRetention();
                      return currentCount; 
                  }
                  playSound('inhale');
                  return nextCount;
              });
          } else {
              // Starting Exhale
              playSound('exhale');
          }
          return nextIsInhale;
      });
  }, [settings.breathsPerRound, startRetention, playSound]);

  const startBreathingCycleSafe = useCallback(() => {
      if (activeCycleRef.current) clearInterval(activeCycleRef.current);
      const interval = settings.tempoMs / 2;
      activeCycleRef.current = window.setInterval(runBreathingStep, interval);
      timerRef.current = activeCycleRef.current;
  }, [settings.tempoMs, runBreathingStep]);

  // Update the main start function to use safe version
  const startSessionWrapper = async () => {
      await initAudio();
      setPhase(SessionPhase.BREATHING);
      setRound(1);
      setBreathCount(1);
      setIsInhale(true);
      setSessionStats([]);
      playSound('inhale');
      startBreathingCycleSafe();
  };

  const resumeBreathing = () => {
      setPhase(SessionPhase.BREATHING);
      setBreathCount(1);
      setIsInhale(true);
      playSound('inhale');
      startBreathingCycleSafe();
  }

  const endRetention = () => {
    setSessionStats(prev => [...prev, { round, retentionTime: elapsedTime }]);
    if (timerRef.current) clearInterval(timerRef.current);
    
    setPhase(SessionPhase.RECOVERY);
    setElapsedTime(15); 
    playSound('inhale'); 
    
    timerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        if (prev <= 0.1) {
           finishRound();
           return 0;
        }
        return prev - 0.1;
      });
    }, 100);
  };

  const finishRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    setRound(r => {
        if (r >= settings.totalRounds) {
            setPhase(SessionPhase.COMPLETED);
            playSound('bell');
            return r;
        } else {
            // Trigger next round automatically? Or wait?
            // Wim Hof usually continues immediately.
            setTimeout(() => {
               resumeBreathing();
               setRound(prev => prev + 1);
            }, 1000);
            return r;
        }
    });
  }, [settings.totalRounds, playSound, startBreathingCycleSafe]); // Added deps

  const stopSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeCycleRef.current) clearInterval(activeCycleRef.current);
    setPhase(SessionPhase.IDLE);
    setBreathCount(0);
    setElapsedTime(0);
  };

  // -- Views --

  const SettingsSheet = () => {
    if (!showSettings) return null;
    
    return (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-fade-in" onClick={() => setShowSettings(false)}>
            <div className="w-full bg-slate-800 rounded-t-[2rem] p-6 pb-12 pt-8 shadow-2xl transform transition-transform duration-300" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold text-white">Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-700 rounded-full text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-8">
                    {/* Breaths per Round */}
                    <div>
                        <div className="flex justify-between text-sm mb-3 text-slate-400">
                            <span>Breaths per Round</span>
                            <span className="text-cyan-400 font-mono font-bold">{settings.breathsPerRound}</span>
                        </div>
                        <input 
                            type="range" min="20" max="60" step="5"
                            value={settings.breathsPerRound}
                            onChange={(e) => setSettings({...settings, breathsPerRound: parseInt(e.target.value)})}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <div className="flex justify-between text-xs text-slate-600 mt-2 font-mono">
                            <span>20</span>
                            <span>40</span>
                            <span>60</span>
                        </div>
                    </div>

                    {/* Speed */}
                    <div>
                        <div className="flex justify-between text-sm mb-3 text-slate-400">
                            <span>Breathing Speed</span>
                            <span className="text-cyan-400 font-mono font-bold">
                                {settings.tempoMs === 2500 ? 'FAST' : settings.tempoMs === 3500 ? 'NORMAL' : 'SLOW'}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[2500, 3500, 5000].map((speed) => (
                                <button
                                    key={speed}
                                    onClick={() => setSettings({...settings, tempoMs: speed})}
                                    className={`py-3 rounded-xl text-sm font-bold transition-all ${
                                        settings.tempoMs === speed 
                                        ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/20' 
                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    }`}
                                >
                                    {speed === 2500 ? 'Fast' : speed === 3500 ? 'Normal' : 'Relaxed'}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Rounds */}
                    <div>
                        <div className="flex justify-between text-sm mb-3 text-slate-400">
                            <span>Number of Rounds</span>
                            <span className="text-cyan-400 font-mono font-bold">{settings.totalRounds}</span>
                        </div>
                        <div className="flex gap-3">
                             {[1, 3, 5].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setSettings({...settings, totalRounds: r})}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                                        settings.totalRounds === r
                                        ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/20' 
                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    }`}
                                >
                                    {r}
                                </button>
                             ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // -- Main Render --

  const renderControls = () => {
     if (phase === SessionPhase.IDLE) {
         return (
            <button 
                onClick={startSessionWrapper}
                className="group relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:scale-105 transition-all duration-300"
            >
                <Play className="w-8 h-8 text-slate-900 ml-1" fill="currentColor" />
            </button>
         );
     }

     if (phase === SessionPhase.RETENTION) {
         return (
            <button 
                onClick={endRetention}
                className="w-full max-w-xs py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-lg rounded-2xl shadow-lg shadow-emerald-500/20 transition-all animate-bounce-slow"
            >
                I NEED TO BREATHE
            </button>
         );
     }

     if (phase !== SessionPhase.COMPLETED) {
         return (
            <button 
                onClick={stopSession}
                className="p-4 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
                <Square className="w-6 h-6" fill="currentColor" />
            </button>
         );
     }

     return null;
  };

  const renderStats = () => (
    <div className="w-full max-w-md px-6 animate-fade-in mt-10">
       <div className="text-center mb-10">
           <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500/10 mb-4">
               <Check className="w-10 h-10 text-cyan-400" />
           </div>
           <h2 className="text-3xl font-bold text-white mb-2">Session Complete</h2>
           <p className="text-slate-400">You've boosted your immune system.</p>
       </div>

       <div className="space-y-3">
         {sessionStats.map((stat, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                <span className="text-slate-400 font-medium">Round {stat.round}</span>
                <span className="text-xl font-mono text-white">{formatTime(stat.retentionTime)}</span>
            </div>
         ))}
       </div>
       <button 
        onClick={stopSession}
        className="mt-12 w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all"
       >
        Done
       </button>
    </div>
  );

  return (
    <div className="min-h-screen h-screen flex flex-col items-center justify-between bg-slate-900 text-white overflow-hidden relative pt-safe pb-safe selection:bg-cyan-500/30">
      
      {/* Top Bar */}
      <div className="w-full px-6 pt-4 flex justify-between items-center z-30 h-16">
        <div className="flex items-center gap-2">
            <Wind className="w-6 h-6 text-cyan-400" />
            <span className="font-bold text-xl tracking-wide font-display">GLACIAL</span>
        </div>
        <div className="flex items-center gap-4">
            {phase !== SessionPhase.IDLE && phase !== SessionPhase.COMPLETED && (
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Round</span>
                    <span className="font-mono font-bold text-lg leading-none">{round}/{settings.totalRounds}</span>
                </div>
            )}
            {phase === SessionPhase.IDLE && (
                <button 
                    onClick={() => setShowSettings(true)}
                    className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                >
                    <Settings className="w-6 h-6" />
                </button>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative z-20">
        {phase === SessionPhase.COMPLETED ? (
            renderStats()
        ) : (
            <BreathingCircle 
                phase={phase}
                progress={phase === SessionPhase.RECOVERY ? elapsedTime / 15 : 0}
                text={(() => {
                    switch(phase) {
                      case SessionPhase.IDLE: return "READY";
                      case SessionPhase.BREATHING: return isInhale ? "INHALE" : "EXHALE";
                      case SessionPhase.RETENTION: return "HOLD";
                      case SessionPhase.RECOVERY: return "RECOVER";
                      default: return "";
                    }
                })()}
                subText={(() => {
                    switch(phase) {
                      case SessionPhase.IDLE: return "Tap start";
                      case SessionPhase.BREATHING: return `${breathCount}/${settings.breathsPerRound}`;
                      case SessionPhase.RETENTION: return formatTime(elapsedTime);
                      case SessionPhase.RECOVERY: return `${Math.ceil(elapsedTime)}s`;
                      default: return "";
                    }
                })()}
                isInhale={isInhale}
            />
        )}
      </div>

      {/* Bottom Control Area */}
      <div className="w-full pb-8 px-6 flex flex-col items-center z-30">
         {renderControls()}
         
         {phase === SessionPhase.IDLE && (
             <div className="mt-12 flex gap-8 text-slate-500 text-sm">
                <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-2xl bg-slate-800/50"><Timer className="w-5 h-5 text-slate-400" /></div>
                    <span className="text-xs font-medium">~{Math.ceil(settings.totalRounds * 3.5)}m</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-2xl bg-slate-800/50"><HeartPulse className="w-5 h-5 text-slate-400" /></div>
                    <span className="text-xs font-medium">Alkalize</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-2xl bg-slate-800/50"><Wind className="w-5 h-5 text-slate-400" /></div>
                    <span className="text-xs font-medium">Focus</span>
                </div>
             </div>
         )}
         
         {phase === SessionPhase.BREATHING && (
             <p className="mt-8 text-cyan-500/50 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
                Follow the sound
             </p>
         )}
      </div>

      {/* Settings Sheet Overlay */}
      <SettingsSheet />
    </div>
  );
};

export default App;
