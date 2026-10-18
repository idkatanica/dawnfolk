import { create } from "zustand";
import { type LaunchOptions, readLaunchOptions } from "./launch-options.ts";

export interface LaunchChanges {
  readonly quality?: LaunchOptions["quality"];
  readonly seed?: number;
}

interface LaunchStore {
  readonly launch: LaunchOptions;
  readonly relaunch: (changes: LaunchChanges) => void;
}

function rememberInAddress(launch: LaunchOptions): void {
  const parameters = new URLSearchParams({ quality: launch.quality, seed: String(launch.seed) });

  try {
    window.history.replaceState(null, "", `?${parameters.toString()}`);
  } catch (error) {
    console.warn("The address could not be updated", error);
  }
}

export const useLaunchStore = create<LaunchStore>()((set) => ({
  launch: readLaunchOptions(window.location.search),
  relaunch: (changes) =>
    set((state) => {
      const launch: LaunchOptions = { ...state.launch, ...changes, camera: {}, hours: null, isPaused: false };

      rememberInAddress(launch);

      return { launch };
    }),
}));
