import { create } from "zustand";
import type { WorldRules } from "../../content/world-rules.ts";
import type { ChronicleCategory, ChronicleEntry } from "../../simulation/chronicle.ts";
import type { SimulationFrame, SimulationStatistics, TribeSummary, WeatherView } from "../../simulation/frame.ts";
import type { Inspection } from "../../simulation/inspection.ts";
import type { CalendarView } from "../../simulation/nature/calendar.ts";
import type { RivalryView } from "../../simulation/society/rivalry/rivalry-system.ts";

export interface WorldSnapshot {
  readonly calendar: CalendarView;
  readonly inspection: Inspection | null;
  readonly isPaused: boolean;
  readonly rivalry: RivalryView;
  readonly rules: WorldRules;
  readonly speed: number;
  readonly statistics: SimulationStatistics;
  readonly tribes: readonly TribeSummary[];
  readonly weather: WeatherView;
}

export interface WorldNotice {
  readonly category: ChronicleCategory | "notice";
  readonly id: number;
  readonly text: string;
}

export interface WorldFeed {
  readonly chronicle: readonly ChronicleEntry[];
  readonly frame: SimulationFrame;
  readonly subscribe: (listener: (frame: SimulationFrame) => void) => () => void;
}

interface WorldStore {
  readonly chronicle: readonly ChronicleEntry[];
  readonly notices: readonly WorldNotice[];
  readonly snapshot: WorldSnapshot | null;
}

const REFRESH_MILLISECONDS = 125;
const MAXIMUM_NOTICES = 4;
const ANNOUNCED_CATEGORIES: ReadonlySet<ChronicleCategory> = new Set([
  "arrival",
  "beast",
  "discovery",
  "era",
  "feud",
  "peace",
  "raid",
  "split",
  "warning",
]);

export const useWorldStore = create<WorldStore>()(() => ({
  chronicle: [],
  notices: [],
  snapshot: null,
}));

function snapshotOf(frame: SimulationFrame): WorldSnapshot {
  return {
    calendar: frame.calendar,
    inspection: frame.inspection,
    isPaused: frame.isPaused,
    rivalry: frame.rivalry,
    rules: frame.rules,
    speed: frame.speed,
    statistics: frame.statistics,
    tribes: frame.tribes,
    weather: frame.weather,
  };
}

let nextNoticeId = 1;

function createNotice(category: WorldNotice["category"], text: string): WorldNotice {
  const notice = { category, id: nextNoticeId, text };

  nextNoticeId += 1;

  return notice;
}

function noticesFrom(frame: SimulationFrame): WorldNotice[] {
  const announced = frame.chronicle
    .filter((entry) => ANNOUNCED_CATEGORIES.has(entry.category))
    .map((entry) => createNotice(entry.category, entry.text));

  return [...frame.notices.map((text) => createNotice("notice", text)), ...announced];
}

export function connectWorldStore(feed: WorldFeed): () => void {
  let lastRefresh = Number.NEGATIVE_INFINITY;

  useWorldStore.setState({
    chronicle: [...feed.chronicle],
    notices: [],
    snapshot: snapshotOf(feed.frame),
  });

  return feed.subscribe((frame) => {
    const now = performance.now();
    const hasNews = frame.chronicle.length > 0 || frame.notices.length > 0;

    if (hasNews) {
      useWorldStore.setState((state) => ({
        chronicle: [...feed.chronicle],
        notices: [...state.notices, ...noticesFrom(frame)].slice(-MAXIMUM_NOTICES),
      }));
    }

    if (now - lastRefresh < REFRESH_MILLISECONDS && !hasNews) {
      return;
    }

    lastRefresh = now;
    useWorldStore.setState({ snapshot: snapshotOf(frame) });
  });
}

export function dismissNotice(id: number): void {
  useWorldStore.setState((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) }));
}
