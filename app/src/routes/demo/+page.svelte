<script lang="ts">
  import FileBrowser from "$lib/components/file-browser/file-broswer.svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { FileEntry } from "$lib/components/file-browser/file-grid.svelte";

  const selectedPath = $derived(() => $page.url.searchParams.get("path") ?? null);
  const currentPath = $derived(($page.url.searchParams.get("path") ?? "") as string);

  function handleBrowserSelect(event: CustomEvent<FileEntry>) {
    const path = event.detail.path;
    goto(resolve("/demo") + `?path=${encodeURIComponent(path)}`, { replaceState: false, noScroll: true });
  }
</script>

<div class="min-h-screen bg-slate-50 p-4 text-slate-900">
  <main class="mx-auto max-w-7xl rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">File Browser Window</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          The file browser now combines the sidebar tree and file grid in one reusable component.
        </p>
      </div>
      <FileBrowser
        fileTree={$page.data.fileTree}
        selectedPath={selectedPath()}
        {currentPath}
        on:select={handleBrowserSelect}
      />
  </main>
</div>
