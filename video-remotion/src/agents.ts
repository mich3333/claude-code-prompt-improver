// Script and on-screen content for AgentsGuide. Filled from the research notes
// in research_notes/AI agents money 2026/.

export type Screen =
  | { kind: 'title'; kicker: string; title: string; sub?: string }
  | { kind: 'list'; kicker: string; title: string; items: { text: string; note?: string }[] }
  | { kind: 'tools'; kicker: string; title: string; items: { name: string; what: string; price: string }[] }
  | { kind: 'compare'; kicker: string; title: string; a: string; b: string; rows: { label: string; a: string; b: string }[]; source?: string }
  | { kind: 'match'; kicker: string; title: string; items: { when: string; use: string }[] }
  | { kind: 'cta'; title: string; button: string };

export const AGENTS_SCRIPT: { text: string; screen: Screen }[] = [];
