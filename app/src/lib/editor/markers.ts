import {
  Decoration,
  EditorView,
  ViewPlugin,
} from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Marker types for Chronicle semantic markers
export type MarkerType = 'highlight' | 'decision' | 'question' | 'action' | 'person';

// Marker configuration
export interface MarkerConfig {
  prefix: string | RegExp;
  type: MarkerType;
  className: string;
  description: string;
}

// Default marker configurations
// These match the PRD specifications
const defaultMarkers: MarkerConfig[] = [
  {
    prefix: /^>\s/,
    type: 'highlight',
    className: 'cm-marker-highlight',
    description: 'Important point or highlight',
  },
  {
    prefix: /^!\s/,
    type: 'decision',
    className: 'cm-marker-decision',
    description: 'Decision made',
  },
  {
    prefix: /^\?\s/,
    type: 'question',
    className: 'cm-marker-question',
    description: 'Open question',
  },
  {
    prefix: /^\[\s?\]\s/,
    type: 'action',
    className: 'cm-marker-action',
    description: 'Action item (unchecked)',
  },
  {
    prefix: /^\[x\]\s/i,
    type: 'action',
    className: 'cm-marker-action-done',
    description: 'Action item (completed)',
  },
  {
    prefix: /^@\w+/,
    type: 'person',
    className: 'cm-marker-person',
    description: 'Person mention',
  },
];

// Create line decorations based on markers
function getLineDecorations(
  view: EditorView,
  markers: MarkerConfig[] = defaultMarkers
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;

      // Skip empty lines
      if (lineText.trim()) {
        // Check for leading whitespace (for nested content)
        const leadingMatch = lineText.match(/^(\s*)/);
        const indent = leadingMatch ? leadingMatch[1].length : 0;
        const contentStart = lineText.substring(indent);

        // Check each marker pattern
        for (const marker of markers) {
          const pattern =
            typeof marker.prefix === 'string'
              ? new RegExp(`^${escapeRegex(marker.prefix)}`)
              : marker.prefix;

          if (pattern.test(contentStart)) {
            // Apply line decoration
            builder.add(
              line.from,
              line.from,
              Decoration.line({ class: marker.className })
            );

            // Also highlight just the marker prefix itself
            const match = contentStart.match(pattern);
            if (match) {
              builder.add(
                line.from + indent,
                line.from + indent + match[0].length,
                Decoration.mark({ class: `${marker.className}-prefix` })
              );
            }
            break; // Only one marker per line
          }
        }
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

// Helper to escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ViewPlugin to manage marker decorations
export const markerHighlighting = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getLineDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = getLineDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Marker styles as a CodeMirror theme extension
export const markerStyles = EditorView.baseTheme({
  // Highlight marker (>)
  '.cm-marker-highlight': {
    backgroundColor: 'rgba(78, 201, 176, 0.1)',
    borderLeft: '3px solid #4ec9b0',
    marginLeft: '-3px',
    paddingLeft: '0',
  },
  '.cm-marker-highlight-prefix': {
    color: '#4ec9b0',
    fontWeight: 'bold',
  },

  // Decision marker (!)
  '.cm-marker-decision': {
    backgroundColor: 'rgba(204, 167, 0, 0.1)',
    borderLeft: '3px solid #cca700',
    marginLeft: '-3px',
    paddingLeft: '0',
  },
  '.cm-marker-decision-prefix': {
    color: '#cca700',
    fontWeight: 'bold',
  },

  // Question marker (?)
  '.cm-marker-question': {
    backgroundColor: 'rgba(0, 120, 212, 0.1)',
    borderLeft: '3px solid #0078d4',
    marginLeft: '-3px',
    paddingLeft: '0',
  },
  '.cm-marker-question-prefix': {
    color: '#0078d4',
    fontWeight: 'bold',
  },

  // Action item marker ([ ])
  '.cm-marker-action': {
    backgroundColor: 'rgba(241, 76, 76, 0.1)',
    borderLeft: '3px solid #f14c4c',
    marginLeft: '-3px',
    paddingLeft: '0',
  },
  '.cm-marker-action-prefix': {
    color: '#f14c4c',
    fontWeight: 'bold',
  },

  // Completed action marker ([x])
  '.cm-marker-action-done': {
    backgroundColor: 'rgba(78, 201, 176, 0.05)',
    borderLeft: '3px solid #4ec9b0',
    marginLeft: '-3px',
    paddingLeft: '0',
    opacity: '0.7',
  },
  '.cm-marker-action-done-prefix': {
    color: '#4ec9b0',
    textDecoration: 'line-through',
  },

  // Person marker (@name)
  '.cm-marker-person': {
    backgroundColor: 'rgba(197, 134, 192, 0.1)',
    borderLeft: '3px solid #c586c0',
    marginLeft: '-3px',
    paddingLeft: '0',
  },
  '.cm-marker-person-prefix': {
    color: '#c586c0',
    fontWeight: 'bold',
  },
});

// Combined marker extension (includes plugin and styles)
export const markers = [markerHighlighting, markerStyles];
