<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { getInvoke } from '$lib/utils/tauri';
  import { FileText, Users, MessageSquare, ListChecks } from 'lucide-svelte';

  export let visible = false;
  export let anchorX = 0;
  export let anchorY = 0;

  const dispatch = createEventDispatcher<{
    select: { filename: string; path: string; content: string };
    close: void;
  }>();

  interface TemplateInfo {
    name: string;
    filename: string;
    content: string;
    description: string;
  }

  let templates: TemplateInfo[] = [];
  let selectedIndex = 0;
  let popoverEl: HTMLDivElement;

  const iconMap: Record<string, typeof FileText> = {
    'blank.md': FileText,
    'meeting.md': Users,
    'one-on-one.md': MessageSquare,
    'standup.md': ListChecks,
  };

  function getIcon(filename: string) {
    return iconMap[filename] ?? FileText;
  }

  async function loadTemplates() {
    try {
      const invoke = await getInvoke();
      templates = await invoke<TemplateInfo[]>('list_templates');
      selectedIndex = 0;
    } catch (e) {
      console.error('Failed to load templates:', e);
      templates = [];
    }
  }

  async function selectTemplate(template: TemplateInfo) {
    try {
      const invoke = await getInvoke();
      const [path, content] = await invoke<[string, string]>('create_from_template', {
        templateFilename: template.filename,
      });
      dispatch('select', { filename: template.filename, path, content });
    } catch (e) {
      console.error('Failed to create from template:', e);
    }
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!visible) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dispatch('close');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % templates.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + templates.length) % templates.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (templates[selectedIndex]) {
        selectTemplate(templates[selectedIndex]);
      }
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (visible && popoverEl && !popoverEl.contains(e.target as Node)) {
      dispatch('close');
    }
  }

  $: if (visible) {
    loadTemplates();
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('mousedown', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown, true);
    document.removeEventListener('mousedown', handleClickOutside);
  });
</script>

{#if visible && templates.length > 0}
  <div
    class="template-popover"
    bind:this={popoverEl}
    style="left: {anchorX}px; top: {anchorY}px;"
    role="listbox"
    aria-label="Note templates"
  >
    <div class="popover-header">New from template</div>
    {#each templates as template, i (template.filename)}
      <button
        class="template-item"
        class:selected={i === selectedIndex}
        on:click={() => selectTemplate(template)}
        on:mouseenter={() => (selectedIndex = i)}
        role="option"
        aria-selected={i === selectedIndex}
      >
        <span class="template-icon">
          <svelte:component this={getIcon(template.filename)} size={14} />
        </span>
        <span class="template-info">
          <span class="template-name">{template.name}</span>
          <span class="template-desc">{template.description}</span>
        </span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .template-popover {
    position: fixed;
    z-index: 1000;
    min-width: 220px;
    max-width: 280px;
    background: var(--dropdown-bg, #2d2d2d);
    border: 1px solid var(--border-color, #444);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    padding: 4px;
    overflow: hidden;
  }

  .popover-header {
    padding: 6px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .template-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #ccc);
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
  }

  .template-item:hover,
  .template-item.selected {
    background: var(--hover-bg, #383838);
    color: var(--text-primary, #fff);
  }

  .template-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--text-muted, #888);
  }

  .template-item.selected .template-icon,
  .template-item:hover .template-icon {
    color: var(--accent-color, #0078d4);
  }

  .template-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .template-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .template-desc {
    font-size: 11px;
    color: var(--text-muted, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .template-item.selected .template-desc,
  .template-item:hover .template-desc {
    color: var(--text-secondary, #aaa);
  }
</style>
