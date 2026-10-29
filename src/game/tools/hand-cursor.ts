import type { HandCursor } from "./hand-tool.ts";

const CURSOR_SIZE = 32;
const WHITESPACE = /\s+/gu;
const INK = "#2b2118";
const SKIN = "#fff1d6";
const CREASE = "#c9a77c";
const BLOCKED = "#e0442f";

const OPEN_HAND = `
<g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round">
  <rect x="8.6" y="6" width="3.8" height="14" rx="1.9"/>
  <rect x="12.4" y="3.4" width="3.8" height="16" rx="1.9"/>
  <rect x="16.2" y="4.2" width="3.8" height="15" rx="1.9"/>
  <rect x="20" y="7.4" width="3.6" height="12" rx="1.8"/>
  <rect x="3.4" y="13.6" width="3.8" height="10" rx="1.9" transform="rotate(-38 5.3 18.6)"/>
  <rect x="8.6" y="13" width="15" height="14.6" rx="5.4"/>
</g>
<g fill="${SKIN}">
  <rect x="8.6" y="6" width="3.8" height="14" rx="1.9"/>
  <rect x="12.4" y="3.4" width="3.8" height="16" rx="1.9"/>
  <rect x="16.2" y="4.2" width="3.8" height="15" rx="1.9"/>
  <rect x="20" y="7.4" width="3.6" height="12" rx="1.8"/>
  <rect x="3.4" y="13.6" width="3.8" height="10" rx="1.9" transform="rotate(-38 5.3 18.6)"/>
  <rect x="8.6" y="13" width="15" height="14.6" rx="5.4"/>
</g>
<path d="M12.4 10v6M16.2 9v7M20 10v6" stroke="${CREASE}" stroke-width="1" stroke-linecap="round"/>`;

const CLOSED_HAND = `
<g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round">
  <rect x="7.6" y="9" width="17" height="17" rx="5.6"/>
  <circle cx="10.6" cy="10.6" r="2.6"/>
  <circle cx="14.6" cy="9.6" r="2.7"/>
  <circle cx="18.6" cy="9.8" r="2.7"/>
  <circle cx="22.2" cy="11.4" r="2.4"/>
</g>
<g fill="${SKIN}">
  <rect x="7.6" y="9" width="17" height="17" rx="5.6"/>
  <circle cx="10.6" cy="10.6" r="2.6"/>
  <circle cx="14.6" cy="9.6" r="2.7"/>
  <circle cx="18.6" cy="9.8" r="2.7"/>
  <circle cx="22.2" cy="11.4" r="2.4"/>
</g>
<path d="M12.6 9.6v3.4M16.6 9.2v3.8M20.5 10v3.4" stroke="${CREASE}" stroke-width="1" stroke-linecap="round"/>
<rect x="7.2" y="16.4" width="11.6" height="4.2" rx="2.1" fill="${SKIN}" stroke="${INK}" stroke-width="1.3"/>`;

const NO_ENTRY = `
<circle cx="24" cy="24" r="6.4" fill="${BLOCKED}" stroke="#ffffff" stroke-width="1.6"/>
<path d="M19.8 28.2l8.4-8.4" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`;

interface CursorLook {
  readonly drawing: string;
  readonly fallback: string;
  readonly hotspotX: number;
  readonly hotspotY: number;
}

const CURSOR_LOOKS: Readonly<Record<Exclude<HandCursor, "none">, CursorLook>> = {
  blocked: { drawing: CLOSED_HAND + NO_ENTRY, fallback: "not-allowed", hotspotX: 16, hotspotY: 16 },
  closed: { drawing: CLOSED_HAND, fallback: "grabbing", hotspotX: 16, hotspotY: 16 },
  open: { drawing: OPEN_HAND, fallback: "grab", hotspotX: 16, hotspotY: 14 },
};

function cursorImage(drawing: string, scale: number): string {
  const size = CURSOR_SIZE * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${CURSOR_SIZE} ${CURSOR_SIZE}">${drawing}</svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg.replaceAll(WHITESPACE, " "))}")`;
}

export function handCursorStyles(cursor: HandCursor): readonly string[] {
  if (cursor === "none") {
    return [""];
  }

  const { drawing, fallback, hotspotX, hotspotY } = CURSOR_LOOKS[cursor];

  const single = cursorImage(drawing, 1);
  const sharp = `${single} 1x, ${cursorImage(drawing, 2)} 2x`;
  const hotspot = `${hotspotX} ${hotspotY}`;

  return [
    fallback,
    `${single} ${hotspot}, ${fallback}`,
    `-webkit-image-set(${sharp}) ${hotspot}, ${fallback}`,
    `image-set(${sharp}) ${hotspot}, ${fallback}`,
  ];
}

export function showHandCursor(element: HTMLElement, cursor: HandCursor): void {
  for (const style of handCursorStyles(cursor)) {
    element.style.cursor = style;
  }
}
