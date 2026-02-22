<script lang="ts">
  import { marked } from 'marked';

  interface Props {
    content: string;
    inline?: boolean;
  }

  let { content, inline = false }: Props = $props();

  // Configure marked for clean output
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  let html = $derived(
    inline
      ? marked.parseInline(content || '') as string
      : marked.parse(content || '') as string
  );
</script>

{#if content}
  <div class="markdown-content" class:inline>
    {@html html}
  </div>
{/if}

<style>
  .markdown-content {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary, #e0e0e0);
  }

  .markdown-content.inline {
    display: inline;
  }

  .markdown-content :global(p) {
    margin: 0 0 8px 0;
  }

  .markdown-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .markdown-content :global(strong) {
    color: var(--text-primary, #fff);
    font-weight: 600;
  }

  .markdown-content :global(em) {
    color: var(--text-secondary, #ccc);
    font-style: italic;
  }

  .markdown-content :global(code) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    background: var(--bg-tertiary, #2d2d2d);
    padding: 1px 4px;
    border-radius: 3px;
    color: var(--accent-color, #0078d4);
  }

  .markdown-content :global(pre) {
    background: var(--bg-tertiary, #2d2d2d);
    padding: 8px 12px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .markdown-content :global(pre code) {
    background: none;
    padding: 0;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 4px 0;
    padding-left: 20px;
  }

  .markdown-content :global(li) {
    margin-bottom: 4px;
  }

  .markdown-content :global(a) {
    color: var(--accent-color, #0078d4);
    text-decoration: none;
  }

  .markdown-content :global(a:hover) {
    text-decoration: underline;
  }

  .markdown-content :global(blockquote) {
    border-left: 3px solid var(--accent-color, #0078d4);
    margin: 8px 0;
    padding: 4px 12px;
    color: var(--text-muted, #888);
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4) {
    color: var(--text-primary, #fff);
    margin: 12px 0 6px 0;
    font-weight: 600;
  }

  .markdown-content :global(h1) { font-size: 16px; }
  .markdown-content :global(h2) { font-size: 14px; }
  .markdown-content :global(h3) { font-size: 13px; }

  .markdown-content :global(hr) {
    border: none;
    border-top: 1px solid var(--border-color, #333);
    margin: 12px 0;
  }

  .markdown-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    border: 1px solid var(--border-color, #333);
    padding: 4px 8px;
    font-size: 12px;
  }

  .markdown-content :global(th) {
    background: var(--header-bg, #252525);
    font-weight: 600;
  }
</style>
