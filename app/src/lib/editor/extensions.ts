import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, rectangularSelection, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

import { chronicleTheme, chronicleSyntaxHighlighting, lightChronicleSyntaxHighlighting } from './theme';
import { markers } from './markers';

export interface EditorConfig {
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  tabSize?: number;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
}

const defaultConfig: EditorConfig = {
  lineNumbers: false, // Markdown editor typically doesn't show line numbers
  lineWrapping: true, // Soft wrap is important for prose
  tabSize: 2,
  readOnly: false,
};

// Create update listener that calls a callback on document changes
export function createUpdateListener(
  onChange: (content: string) => void
): Extension {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  });
}

// Build the complete extension array
export function createExtensions(
  onChange: (content: string) => void,
  config: EditorConfig = {}
): Extension[] {
  const mergedConfig = { ...defaultConfig, ...config };

  const extensions: Extension[] = [
    // History (undo/redo)
    history(),

    // Bracket matching and auto-closing
    bracketMatching(),
    closeBrackets(),

    // Selection
    drawSelection(),
    rectangularSelection(),

    // Active line highlighting
    highlightActiveLine(),
    highlightActiveLineGutter(),

    // Auto-indent on input
    indentOnInput(),

    // Markdown language support with syntax highlighting for code blocks
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),

    // Theme and syntax highlighting
    chronicleTheme,
    mergedConfig.theme === 'light' ? lightChronicleSyntaxHighlighting : chronicleSyntaxHighlighting,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    // Chronicle semantic markers
    ...markers,

    // Keymaps
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),

    // Update listener
    createUpdateListener(onChange),
  ];

  // Optional line numbers
  if (mergedConfig.lineNumbers) {
    extensions.push(lineNumbers());
  }

  // Line wrapping (soft wrap)
  if (mergedConfig.lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }

  // Tab size
  extensions.push(
    EditorState.tabSize.of(mergedConfig.tabSize ?? 2)
  );

  // Read-only mode
  if (mergedConfig.readOnly) {
    extensions.push(EditorState.readOnly.of(true));
  }

  return extensions;
}

// Keyboard shortcuts for markdown formatting
export const markdownKeymap = keymap.of([
  {
    key: 'Mod-b',
    run: (view) => {
      wrapSelection(view, '**', '**');
      return true;
    },
  },
  {
    key: 'Mod-i',
    run: (view) => {
      wrapSelection(view, '*', '*');
      return true;
    },
  },
  {
    key: 'Mod-`',
    run: (view) => {
      wrapSelection(view, '`', '`');
      return true;
    },
  },
  {
    key: 'Mod-k',
    run: (view) => {
      insertLink(view);
      return true;
    },
  },
]);

// Helper: wrap selection with prefix/suffix
function wrapSelection(view: EditorView, prefix: string, suffix: string): void {
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.sliceDoc(from, to);

  // Check if already wrapped
  const beforeText = view.state.sliceDoc(Math.max(0, from - prefix.length), from);
  const afterText = view.state.sliceDoc(to, to + suffix.length);

  if (beforeText === prefix && afterText === suffix) {
    // Remove wrapping
    view.dispatch({
      changes: [
        { from: from - prefix.length, to: from, insert: '' },
        { from: to, to: to + suffix.length, insert: '' },
      ],
      selection: { anchor: from - prefix.length, head: to - prefix.length },
    });
  } else {
    // Add wrapping
    view.dispatch({
      changes: [
        { from, insert: prefix },
        { from: to, insert: suffix },
      ],
      selection: {
        anchor: from + prefix.length,
        head: to + prefix.length,
      },
    });
  }
}

// Helper: insert a markdown link
function insertLink(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.sliceDoc(from, to);

  if (selectedText) {
    // Wrap selection as link text
    view.dispatch({
      changes: { from, to, insert: `[${selectedText}](url)` },
      selection: { anchor: from + selectedText.length + 3, head: from + selectedText.length + 6 },
    });
  } else {
    // Insert empty link template
    view.dispatch({
      changes: { from, insert: '[text](url)' },
      selection: { anchor: from + 1, head: from + 5 },
    });
  }
}

// Extended extensions including markdown keymap
export function createExtensionsWithKeymap(
  onChange: (content: string) => void,
  config: EditorConfig = {}
): Extension[] {
  return [...createExtensions(onChange, config), markdownKeymap];
}
