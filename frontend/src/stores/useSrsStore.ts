import { create } from 'zustand';

interface SrsState {
  dueCardsCount: number;
  learnedCardsCount: number;
  setDueCardsCount: (count: number) => void;
  setLearnedCardsCount: (count: number) => void;
  decrementDueCards: () => void;
}

export const useSrsStore = create<SrsState>((set) => ({
  dueCardsCount: 0,
  learnedCardsCount: 0,
  setDueCardsCount: (count) => set({ dueCardsCount: count }),
  setLearnedCardsCount: (count) => set({ learnedCardsCount: count }),
  decrementDueCards: () => set((state) => ({ 
    dueCardsCount: Math.max(0, state.dueCardsCount - 1),
    learnedCardsCount: state.learnedCardsCount + 1 
  })),
}));
