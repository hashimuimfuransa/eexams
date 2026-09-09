// Visual themes for generated slide decks.
//
// A deck a teacher projects in front of a class has to look deliberate, not
// like dumped bullet points, so every theme here defines a full palette plus
// the decoration geometry the renderer draws — not just a colour or two.
//
// Design constraints these palettes are built around:
//  - Projected in bright Rwandan classrooms, often on cheap projectors, so
//    body text is near-black on near-white with a strong accent, never light
//    grey on white, and never a dark theme by default.
//  - Title slides invert to the deep brand colour for contrast on entry.
//  - Every theme keeps the same *structure* (title bar, accent rule, footer)
//    so switching theme never reflows content, only recolours it.
//
// Colours are hex without '#', which is what PptxGenJS expects.

const THEMES = {
  classic: {
    key: 'classic',
    name: 'Classic Blue',
    description: 'Formal navy and gold — safe for inspection and head-teacher review.',
    deep: '0D406C',      // title slide ground, section dividers
    primary: '134E7E',   // headings
    accent: 'E8B54B',    // rules, numbers, emphasis
    accentSoft: 'FBF0D6',// bullet chips, callout fills
    body: '1A2330',      // body text
    muted: '5A6B7C',     // footer, notes
    surface: 'FFFFFF',
    surfaceAlt: 'F4F7FA',
    onDeep: 'FFFFFF',
    headingFont: 'Georgia',
    bodyFont: 'Calibri',
    decoration: 'bar'
  },
  vibrant: {
    key: 'vibrant',
    name: 'Vibrant Green',
    description: 'The Testfy green — bright, modern, good for primary classes.',
    deep: '075C3A',
    primary: '0A7A4B',
    accent: '0CBD73',
    accentSoft: 'E3F7ED',
    body: '15241D',
    muted: '5C7268',
    surface: 'FFFFFF',
    surfaceAlt: 'F2FBF7',
    onDeep: 'FFFFFF',
    headingFont: 'Verdana',
    bodyFont: 'Calibri',
    decoration: 'corner'
  },
  warm: {
    key: 'warm',
    name: 'Warm Clay',
    description: 'Terracotta and cream — friendly, strong on older projectors.',
    deep: '7A3B22',
    primary: '9C4A2B',
    accent: 'D97742',
    accentSoft: 'FBEDE4',
    body: '2A1D16',
    muted: '7A6459',
    surface: 'FFFFFF',
    surfaceAlt: 'FDF6F1',
    onDeep: 'FFFFFF',
    headingFont: 'Georgia',
    bodyFont: 'Calibri',
    decoration: 'ribbon'
  },
  slate: {
    key: 'slate',
    name: 'Modern Slate',
    description: 'Charcoal and teal — clean and understated for secondary/TVET.',
    deep: '1E293B',
    primary: '25455E',
    accent: '14919B',
    accentSoft: 'E0F2F3',
    body: '111827',
    muted: '64748B',
    surface: 'FFFFFF',
    surfaceAlt: 'F5F7F9',
    onDeep: 'FFFFFF',
    headingFont: 'Trebuchet MS',
    bodyFont: 'Calibri',
    decoration: 'sidebar'
  },
  royal: {
    key: 'royal',
    name: 'Royal Purple',
    description: 'Deep violet and amber — high contrast, good for exam revision.',
    deep: '3B2364',
    primary: '4C2E80',
    accent: 'F0A722',
    accentSoft: 'F4EEFC',
    body: '1C1430',
    muted: '6B6180',
    surface: 'FFFFFF',
    surfaceAlt: 'F8F5FD',
    onDeep: 'FFFFFF',
    headingFont: 'Georgia',
    bodyFont: 'Calibri',
    decoration: 'bar'
  }
};

const THEME_KEYS = Object.keys(THEMES);
const DEFAULT_THEME = 'classic';

const getTheme = (key) => THEMES[key] || THEMES[DEFAULT_THEME];

// Slide layouts the AI may request per slide. Keeping this a closed set means
// the renderer always knows how to draw what the model asked for — an unknown
// value falls back to 'bullets' rather than producing an empty slide.
const LAYOUTS = {
  title: 'Full-bleed opening slide',
  bullets: 'Heading with a bullet list',
  twoColumn: 'Heading with two side-by-side lists',
  compare: 'Two labelled panels set against each other',
  steps: 'Numbered sequence of stages',
  callout: 'One big statement — a definition, rule or key fact',
  image: 'Heading, short text, and a described visual placeholder',
  question: 'A question posed to the class, answer in the notes',
  summary: 'Closing recap plus homework'
};

const LAYOUT_KEYS = Object.keys(LAYOUTS);
const normalizeLayout = (value) => (LAYOUT_KEYS.includes(value) ? value : 'bullets');

module.exports = { THEMES, THEME_KEYS, DEFAULT_THEME, getTheme, LAYOUTS, LAYOUT_KEYS, normalizeLayout };
