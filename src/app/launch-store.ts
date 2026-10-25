import { create } from "zustand";
import { choosesWorld, type LaunchOptions, readLaunchOptions } from "./launch-options.ts";

export type LaunchChanges = Partial<Pick<LaunchOptions, "name" | "quality" | "seed" | "shape">>;

interface LaunchStore {
  readonly isChoosingWorld: boolean;
  readonly launch: LaunchOptions;
  readonly relaunch: (changes: LaunchChanges) => void;
}

function rememberInAddress(launch: LaunchOptions): void {
  const parameters = new URLSearchParams({
    name: launch.name,
    quality: launch.quality,
    seed: String(launch.seed),
    shape: launch.shape,
  });

  try {
    window.history.replaceState(null, "", `?${parameters.toString()}`);
  } catch (error) {
    console.warn("The address could not be updated", error);
  }
}

export const useLaunchStore = create<LaunchStore>()((set) => ({
  isChoosingWorld: !choosesWorld(window.location.search),
  launch: readLaunchOptions(window.location.search),
  relaunch: (changes) =>
    set((state) => {
      const launch: LaunchOptions = { ...state.launch, ...changes, camera: {}, hours: null, isPaused: false };

      rememberInAddress(launch);

      return { isChoosingWorld: false, launch };
    }),
}));
