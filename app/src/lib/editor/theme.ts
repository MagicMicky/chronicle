import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Chronicle dark theme for CodeMirror
// Matches the app's CSS custom properties

const chronicleColors = {
  bg: '#1e1e1e',
  bgHighlight: '#2d2d2d',
  bgSelection: '#264f78',
  fg: '#e0e0e0',
  fgMuted: '#888888',
  fgSecondary: '#b0b0b0',
  border: '#333333',
  cursor: '#e0e0e0',
  accent: '#0078d4',

  // Syntax colors
  keyword: '#569cd6',
  string: '#ce9178',
  number: '#b5cea8',
  comment: '#6a9955',
  function: '#dcdcaa',
  variable: '#9cdcfe',
  type: '#4ec9b0',
  operator: '#d4d4d4',
  punctuation: '#d4d4d4',
  heading: '#4fc1ff',
  link: '#0078d4',
  emphasis: '#c586c0',
  strong: '#569cd6',
  strikethrough: '#808080',
  quote: '#6a9955',
  list: '#d7ba7d',
  code: '#ce9178',
};

// Editor theme (UI elements)
export const chronicleTheme = EditorView.theme(
  {
    '&': {
      color: chronicleColors.fg,
      backgroundColor: chronicleColors.bg,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: '14px',
    },
    '.cm-content': {
      caretColor: chronicleColors.cursor,
      padding: '12px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: chronicleColors.cursor,
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: chronicleColors.bgSelection,
      },
    '.cm-panels': {
      backgroundColor: chronicleColors.bg,
      color: chronicleColors.fg,
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: `1px solid ${chronicleColors.border}`,
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: `1px solid ${chronicleColors.border}`,
    },
    '.cm-searchMatch': {
      backgroundColor: '#515c6a',
      outline: `1px solid ${chronicleColors.accent}`,
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: chronicleColors.bgSelection,
    },
    '.cm-activeLine': {
      backgroundColor: '#1e1e1e',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#515c6a',
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#515c6a',
      outline: `1px solid ${chronicleColors.fgMuted}`,
    },
    '.cm-gutters': {
      backgroundColor: chronicleColors.bg,
      color: chronicleColors.fgMuted,
      border: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: chronicleColors.fg,
    },
    '.cm-foldPlaceholder': {
      backgroundColor: chronicleColors.bgHighlight,
      color: chronicleColors.fgMuted,
      border: 'none',
    },
    '.cm-tooltip': {
      backgroundColor: chronicleColors.bgHighlight,
      border: `1px solid ${chronicleColors.border}`,
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: chronicleColors.bgHighlight,
      borderBottomColor: chronicleColors.bgHighlight,
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: chronicleColors.bgSelection,
        color: chronicleColors.fg,
      },
    },
    // Soft wrap
    '.cm-line': {
      padding: '0 16px',
    },
    // Scrollbar
    '&::-webkit-scrollbar': {
      width: '10px',
      height: '10px',
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: chronicleColors.border,
      borderRadius: '5px',
    },
  },
  { dark: true }
);

// Syntax highlighting
export const chronicleHighlightStyle = HighlightStyle.define([
  // Markdown headings
  { tag: tags.heading1, color: chronicleColors.heading, fontWeight: 'bold', fontSize: '1.5em' },
  { tag: tags.heading2, color: chronicleColors.heading, fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading3, color: chronicleColors.heading, fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading4, color: chronicleColors.heading, fontWeight: 'bold' },
  { tag: tags.heading5, color: chronicleColors.heading, fontWeight: 'bold' },
  { tag: tags.heading6, color: chronicleColors.heading, fontWeight: 'bold' },

  // Markdown emphasis
  { tag: tags.emphasis, color: chronicleColors.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, color: chronicleColors.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, color: chronicleColors.strikethrough, textDecoration: 'line-through' },

  // Links and URLs
  { tag: tags.link, color: chronicleColors.link, textDecoration: 'underline' },
  { tag: tags.url, color: chronicleColors.link },

  // Lists
  { tag: tags.list, color: chronicleColors.list },

  // Quotes
  { tag: tags.quote, color: chronicleColors.quote, fontStyle: 'italic' },

  // Code
  { tag: tags.monospace, color: chronicleColors.code, fontFamily: "'JetBrains Mono', monospace" },

  // General code highlighting (for fenced code blocks)
  { tag: tags.keyword, color: chronicleColors.keyword },
  { tag: tags.operator, color: chronicleColors.operator },
  { tag: tags.number, color: chronicleColors.number },
  { tag: tags.string, color: chronicleColors.string },
  { tag: tags.comment, color: chronicleColors.comment, fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: chronicleColors.function },
  { tag: tags.variableName, color: chronicleColors.variable },
  { tag: tags.typeName, color: chronicleColors.type },
  { tag: tags.className, color: chronicleColors.type },
  { tag: tags.definition(tags.variableName), color: chronicleColors.variable },
  { tag: tags.propertyName, color: chronicleColors.variable },
  { tag: tags.punctuation, color: chronicleColors.punctuation },
  { tag: tags.bracket, color: chronicleColors.punctuation },

  // Meta (markdown syntax characters like #, *, -, etc.)
  { tag: tags.processingInstruction, color: chronicleColors.fgMuted },
  { tag: tags.meta, color: chronicleColors.fgMuted },
]);

// Combined syntax highlighting extension
export const chronicleSyntaxHighlighting = syntaxHighlighting(chronicleHighlightStyle);
