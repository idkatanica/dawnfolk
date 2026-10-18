import { expose } from "comlink";
import { createSimulationWorkerApi } from "./simulation-worker-api.ts";

expose(createSimulationWorkerApi());
