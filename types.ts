export enum SessionPhase {
  IDLE = 'IDLE',
  PREPARE = 'PREPARE',
  BREATHING = 'BREATHING', // The 30-40 deep breaths
  RETENTION = 'RETENTION', // The long hold on exhale
  RECOVERY = 'RECOVERY',   // The 15s hold on inhale
  COMPLETED = 'COMPLETED'
}

export interface SessionStats {
  round: number;
  retentionTime: number; // in seconds
}

export interface BreathingSettings {
  breathsPerRound: number;
  tempoMs: number; // milliseconds per breath cycle
  totalRounds: number;
}

export const DEFAULT_SETTINGS: BreathingSettings = {
  breathsPerRound: 30,
  tempoMs: 3500, // 3.5s per full breath
  totalRounds: 3,
};