import { create } from "zustand";

interface InspectorStore {
  readonly isFollowing: boolean;
  readonly setFollowing: (isFollowing: boolean) => void;
}

export const useInspectorStore = create<InspectorStore>()((set) => ({
  isFollowing: false,
  setFollowing: (isFollowing) => set({ isFollowing }),
}));
