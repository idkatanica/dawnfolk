import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultPowerParameters,
  isPowerId,
  type ParameterValue,
  type ParameterValueMap,
  type PowerId,
  readPowerParameters,
} from "../../content/powers.ts";

type StoredParameters = Readonly<Partial<Record<PowerId, ParameterValueMap>>>;

export interface PowerStore {
  readonly parameters: StoredParameters;
  readonly resetParameters: (powerId: PowerId) => void;
  readonly selectedPowerId: PowerId | null;
  readonly selectPower: (powerId: PowerId | null) => void;
  readonly setParameter: (powerId: PowerId, key: string, value: ParameterValue) => void;
}

const STORAGE_KEY = "dawnfolk.powers";

const storedSchema = z.object({ parameters: z.record(z.string(), z.unknown()).default({}) });

export function readStoredParameters(value: unknown): StoredParameters {
  const result = storedSchema.safeParse(value);

  if (!result.success) {
    console.warn("Ignoring saved power settings", result.error.issues);

    return {};
  }

  const parameters: Partial<Record<PowerId, ParameterValueMap>> = {};

  for (const [powerId, values] of Object.entries(result.data.parameters)) {
    if (isPowerId(powerId)) {
      parameters[powerId] = readPowerParameters(powerId, values);
    }
  }

  return parameters;
}

export function withDefaults(powerId: PowerId, stored: ParameterValueMap | undefined): ParameterValueMap {
  if (stored === undefined) {
    return defaultPowerParameters(powerId);
  }

  return stored;
}

function mergeStored(persisted: unknown, current: PowerStore): PowerStore {
  if (persisted === undefined) {
    return current;
  }

  return { ...current, parameters: readStoredParameters(persisted) };
}

export function parametersOf(parameters: StoredParameters, powerId: PowerId): ParameterValueMap {
  return withDefaults(powerId, parameters[powerId]);
}

export const usePowerStore = create<PowerStore>()(
  persist(
    (set) => ({
      parameters: {},
      resetParameters: (powerId) =>
        set((state) => ({ parameters: { ...state.parameters, [powerId]: defaultPowerParameters(powerId) } })),
      selectedPowerId: null,
      selectPower: (powerId) => set({ selectedPowerId: powerId }),
      setParameter: (powerId, key, value) =>
        set((state) => {
          const current = parametersOf(state.parameters, powerId);

          return {
            parameters: { ...state.parameters, [powerId]: readPowerParameters(powerId, { ...current, [key]: value }) },
          };
        }),
    }),
    {
      merge: mergeStored,
      name: STORAGE_KEY,
      partialize: (state) => ({ parameters: state.parameters }),
    }
  )
);
