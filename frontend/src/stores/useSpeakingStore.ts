import { create } from 'zustand';

interface SpeakingState {
  isRecording: boolean;
  isProcessing: boolean;
  volume: number;
  speakingPoints: number;
  setRecording: (isRecording: boolean) => void;
  setProcessing: (isProcessing: boolean) => void;
  setVolume: (volume: number) => void;
  addSpeakingPoints: (points: number) => void;
  resetSession: () => void;
}

export const useSpeakingStore = create<SpeakingState>((set) => ({
  isRecording: false,
  isProcessing: false,
  volume: 0,
  speakingPoints: 0,
  setRecording: (isRecording) => set({ isRecording }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setVolume: (volume) => set({ volume }),
  addSpeakingPoints: (points) => set((state) => ({ speakingPoints: state.speakingPoints + points })),
  resetSession: () => set({ isRecording: false, isProcessing: false, volume: 0, speakingPoints: 0 }),
}));
