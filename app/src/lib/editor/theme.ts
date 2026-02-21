import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Chronicle theme for CodeMirror
// Uses CSS custom properties so it works in both light and dark modes.
// Fallback values match the dark theme for backwards compatibility.

// Editor theme (UI elements) — uses CSS variables defined in app.css
export const chronicleTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text-primary, #e0e0e0)',
      backgroundColor: 'var(--editor-bg, #1e1e1e)',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: '14px',
    },
    '.cm-content': {
      caretColor: 'var(--editor-cursor, #e0e0e0)',
      padding: '12px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--editor-cursor, #e0e0e0)',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'var(--editor-selection, #264f78)',
      },
    '.cm-panels': {
      backgroundColor: 'var(--editor-bg, #1e1e1e)',
      color: 'var(--text-primary, #e0e0e0)',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid var(--border-color, #333)',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid var(--border-color, #333)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'var(--editor-line-highlight, #515c6a)',
      outline: '1px solid var(--accent-color, #0078d4)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--editor-selection, #264f78)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--editor-line-highlight, #1e1e1e)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'var(--editor-line-highlight, #515c6a)',
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: 'var(--editor-line-highlight, #515c6a)',
      outline: '1px solid var(--text-muted, #888)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--editor-gutter-bg, #1e1e1e)',
      color: 'var(--text-muted, #888)',
      border: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--text-primary, #e0e0e0)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--bg-tertiary, #2d2d2d)',
      color: 'var(--text-muted, #888)',
      border: 'none',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--bg-tertiary, #2d2d2d)',
      border: '1px solid var(--border-color, #333)',
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: 'var(--bg-tertiary, #2d2d2d)',
      borderBottomColor: 'var(--bg-tertiary, #2d2d2d)',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--editor-selection, #264f78)',
        color: 'var(--text-primary, #e0e0e0)',
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
      background: 'var(--border-color, #333)',
      borderRadius: '5px',
    },
  },
  { dark: false }
);

// Syntax highlighting — Note: HighlightStyle.define does not support CSS variables
// directly in the `color` property. These hardcoded colors are the dark theme defaults.
// The editor UI theme above uses CSS variables for backgrounds, gutters, selections, etc.
// For full light/dark syntax color switching, we provide two highlight styles.

const darkHighlightStyle = HighlightStyle.define([
  // Markdown headings
  { tag: tags.heading1, color: '#4fc1ff', fontWeight: 'bold', fontSize: '1.5em' },
  { tag: tags.heading2, color: '#4fc1ff', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading3, color: '#4fc1ff', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading4, color: '#4fc1ff', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#4fc1ff', fontWeight: 'bold' },
  { tag: tags.heading6, color: '#4fc1ff', fontWeight: 'bold' },

  // Markdown emphasis
  { tag: tags.emphasis, color: '#c586c0', fontStyle: 'italic' },
  { tag: tags.strong, color: '#569cd6', fontWeight: 'bold' },
  { tag: tags.strikethrough, color: '#808080', textDecoration: 'line-through' },

  // Links and URLs
  { tag: tags.link, color: '#0078d4', textDecoration: 'underline' },
  { tag: tags.url, color: '#0078d4' },

  // Lists
  { tag: tags.list, color: '#d7ba7d' },

  // Quotes
  { tag: tags.quote, color: '#6a9955', fontStyle: 'italic' },

  // Code
  { tag: tags.monospace, color: '#ce9178', fontFamily: "'JetBrains Mono', monospace" },

  // General code highlighting (for fenced code blocks)
  { tag: tags.keyword, color: '#569cd6' },
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.number, color: '#b5cea8' },
  { tag: tags.string, color: '#ce9178' },
  { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#dcdcaa' },
  { tag: tags.variableName, color: '#9cdcfe' },
  { tag: tags.typeName, color: '#4ec9b0' },
  { tag: tags.className, color: '#4ec9b0' },
  { tag: tags.definition(tags.variableName), color: '#9cdcfe' },
  { tag: tags.propertyName, color: '#9cdcfe' },
  { tag: tags.punctuation, color: '#d4d4d4' },
  { tag: tags.bracket, color: '#d4d4d4' },

  // Meta (markdown syntax characters like #, *, -, etc.)
  { tag: tags.processingInstruction, color: '#888888' },
  { tag: tags.meta, color: '#888888' },
]);

const lightHighlightStyle = HighlightStyle.define([
  // Markdown headings
  { tag: tags.heading1, color: '#0550ae', fontWeight: 'bold', fontSize: '1.5em' },
  { tag: tags.heading2, color: '#0550ae', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading3, color: '#0550ae', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading4, color: '#0550ae', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#0550ae', fontWeight: 'bold' },
  { tag: tags.heading6, color: '#0550ae', fontWeight: 'bold' },

  // Markdown emphasis
  { tag: tags.emphasis, color: '#6639ba', fontStyle: 'italic' },
  { tag: tags.strong, color: '#1e1e1e', fontWeight: 'bold' },
  { tag: tags.strikethrough, color: '#999999', textDecoration: 'line-through' },

  // Links and URLs
  { tag: tags.link, color: '#0066cc', textDecoration: 'underline' },
  { tag: tags.url, color: '#0066cc' },

  // Lists
  { tag: tags.list, color: '#0550ae' },

  // Quotes
  { tag: tags.quote, color: '#57606a', fontStyle: 'italic' },

  // Code
  { tag: tags.monospace, color: '#0a3069', fontFamily: "'JetBrains Mono', monospace" },

  // General code highlighting (for fenced code blocks)
  { tag: tags.keyword, color: '#cf222e' },
  { tag: tags.operator, color: '#444444' },
  { tag: tags.number, color: '#0550ae' },
  { tag: tags.string, color: '#0a3069' },
  { tag: tags.comment, color: '#6e7781', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#8250df' },
  { tag: tags.variableName, color: '#24292f' },
  { tag: tags.typeName, color: '#0550ae' },
  { tag: tags.className, color: '#0550ae' },
  { tag: tags.definition(tags.variableName), color: '#24292f' },
  { tag: tags.propertyName, color: '#24292f' },
  { tag: tags.punctuation, color: '#444444' },
  { tag: tags.bracket, color: '#444444' },

  // Meta (markdown syntax characters like #, *, -, etc.)
  { tag: tags.processingInstruction, color: '#999999' },
  { tag: tags.meta, color: '#999999' },
]);

// Export both highlight styles for theme-aware usage
export const chronicleHighlightStyle = darkHighlightStyle;
export const lightChronicleHighlightStyle = lightHighlightStyle;

// Combined syntax highlighting extensions
export const chronicleSyntaxHighlighting = syntaxHighlighting(darkHighlightStyle);
export const lightChronicleSyntaxHighlighting = syntaxHighlighting(lightHighlightStyle);
