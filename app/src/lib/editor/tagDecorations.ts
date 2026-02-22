import {
  Decoration,
  EditorView,
  ViewPlugin,
} from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { getTagColor, type TagCategory } from '$lib/utils/tagColors';

/** Effect to update the set of known tags in the editor */
export const setKnownTags = StateEffect.define<string[]>();

/** Effect to update tag categories in the editor */
export const setTagCategories = StateEffect.define<Record<string, TagCategory>>();

/** StateField holding the current known tags list */
export const knownTagsField = StateField.define<string[]>({
  create() {
    return [];
  },
  update(tags, tr) {
    for (const e of tr.effects) {
      if (e.is(setKnownTags)) return e.value;
    }
    return tags;
  },
});

/** StateField holding tag categories */
export const tagCategoriesField = StateField.define<Record<string, TagCategory>>({
  create() {
    return {};
  },
  update(cats, tr) {
    for (const e of tr.effects) {
      if (e.is(setTagCategories)) return e.value;
    }
    return cats;
  },
});

/** Build decorations for #tag matches in visible ranges */
function getTagDecorations(view: EditorView): DecorationSet {
  const tags = view.state.field(knownTagsField);
  if (tags.length === 0) return Decoration.none;

  const categories = view.state.field(tagCategoriesField);

  // Build a set for O(1) lookup
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  // Also build a set of just the name parts (for #name matching of category:name tags)
  const nameToFullTag = new Map<string, string>();
  for (const t of tags) {
    const lower = t.toLowerCase();
    const idx = lower.indexOf(':');
    if (idx > 0) {
      nameToFullTag.set(lower.slice(idx + 1), lower);
    }
  }

  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    // Match #tagname and #category:name patterns
    const regex = /(?:^|(?<=\s))#([a-zA-Z][\w-]*(?::[a-zA-Z][\w-]*)?)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const tagName = match[1].toLowerCase();
      // Check direct match first, then check if it's a name part of a category:name tag
      let resolvedTag: string | null = null;
      if (tagSet.has(tagName)) {
        resolvedTag = tagName;
      } else if (nameToFullTag.has(tagName)) {
        resolvedTag = nameToFullTag.get(tagName)!;
      }

      if (resolvedTag) {
        const start = from + match.index + (match[0].length - match[1].length - 1);
        const end = from + match.index + match[0].length;
        const color = getTagColor(resolvedTag, categories);
        builder.add(
          start,
          end,
          Decoration.mark({
            class: 'cm-tag-inline',
            attributes: {
              style: `color: ${color}; text-decoration: underline; text-decoration-color: ${color}; text-underline-offset: 2px;`,
            },
          })
        );
      }
    }
  }

  return builder.finish();
}

/** ViewPlugin that manages inline tag decorations */
export const tagHighlighting = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getTagDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(setKnownTags) || e.is(setTagCategories))
        )
      ) {
        this.decorations = getTagDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/** Base theme for inline tag decorations */
export const tagStyles = EditorView.baseTheme({
  '.cm-tag-inline': {
    cursor: 'default',
    borderRadius: '2px',
  },
});

/** Combined tag decoration extension */
export const tagDecorations = [knownTagsField, tagCategoriesField, tagHighlighting, tagStyles];
