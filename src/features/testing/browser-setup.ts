import "../../styles.css";
import type {} from "@vitest/browser/matchers";
import { afterEach, vi } from "vitest";
import { useEngineStore } from "../../app/engine-store.ts";
import { useLaunchStore } from "../../app/launch-store.ts";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { usePowerStore } from "../powers/power-store.ts";
import { useWorldStore } from "../world/world-store.ts";

const initialEngine = useEngineStore.getState();
const initialLaunch = useLaunchStore.getState();
const initialInterface = useInterfaceStore.getState();
const initialPowers = usePowerStore.getState();
const initialWorld = useWorldStore.getState();
const initialAddress = window.location.href;

afterEach(() => {
  useEngineStore.setState(initialEngine, true);
  useLaunchStore.setState(initialLaunch, true);
  useInterfaceStore.setState(initialInterface, true);
  usePowerStore.setState(initialPowers, true);
  useWorldStore.setState(initialWorld, true);

  localStorage.clear();

  window.history.replaceState(null, "", initialAddress);

  vi.useRealTimers();
});
