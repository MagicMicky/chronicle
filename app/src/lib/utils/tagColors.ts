// 16-color palette distinguishable on both dark and light themes
const TAG_COLORS = [
  '#4ec9b0', // teal
  '#ce9178', // peach
  '#569cd6', // blue
  '#d7ba7d', // gold
  '#c586c0', // purple
  '#4fc1ff', // cyan
  '#d16969', // red
  '#b5cea8', // green
  '#dcdcaa', // yellow
  '#9cdcfe', // light blue
  '#f44747', // bright red
  '#6a9955', // forest
  '#e8ab53', // orange
  '#c8c8c8', // silver
  '#d4a0e0', // lavender
  '#85c46c', // lime
];

export interface TagCategory {
  label: string;
  color: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Parse a tag into category and name parts, stripping any leading # */
export function parseTag(tag: string): { category: string | null; name: string } {
  const t = tag.startsWith('#') ? tag.slice(1) : tag;
  const idx = t.indexOf(':');
  if (idx > 0) {
    return { category: t.slice(0, idx), name: t.slice(idx + 1) };
  }
  return { category: null, name: t };
}

/** Get the display color for a tag, using category color when available */
export function getTagColor(tag: string, categories?: Record<string, TagCategory>): string {
  if (categories) {
    const { category } = parseTag(tag);
    if (category && categories[category]?.color) {
      return categories[category].color;
    }
  }
  return TAG_COLORS[hashString(tag) % TAG_COLORS.length];
}

/** Get the background color for a tag at ~13% opacity */
export function getTagBgColor(tag: string, categories?: Record<string, TagCategory>): string {
  const color = getTagColor(tag, categories);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.13)`;
}
