<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '$lib/components/ui/button';
	import type { ChatMessage } from './types';
	import { renderMarkdown } from './markdown';

	let {
		message,
		busy = false,
		onEdit,
		onRegenerate,
		onCopy,
		onRetry,
		onVariantPrev,
		onVariantNext
	}: {
		message: ChatMessage;
		busy?: boolean;
		onEdit?: () => void;
		onRegenerate?: () => void;
		onCopy?: () => void;
		onRetry?: () => void;
		onVariantPrev?: () => void;
		onVariantNext?: () => void;
	} = $props();

	const displayHtml = $derived.by(() => {
		const raw =
			message.role === 'assistant' && message.assistantVariants?.length
				? (() => {
						const v = message.assistantVariants!;
						const idx =
							message.variantIndex !== undefined ? message.variantIndex : v.length - 1;
						return v[Math.max(0, Math.min(idx, v.length - 1))] ?? message.content;
					})()
				: message.content;
		return renderMarkdown(raw);
	});

	const variantCount = $derived(
		message.role === 'assistant' ? (message.assistantVariants?.length ?? 0) : 0
	);
	const variantPos = $derived(
		message.role === 'assistant' && message.assistantVariants?.length
			? (message.variantIndex !== undefined
					? message.variantIndex + 1
					: message.assistantVariants!.length) ?? 1
			: 0
	);
	const showVariants = $derived(variantCount > 1);

	function onUserBubbleClick(e: MouseEvent) {
		if (message.role !== 'user' || busy) return;
		const sel = typeof window !== 'undefined' ? window.getSelection() : null;
		if (sel?.toString().trim()) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('a, button')) return;
		onEdit?.();
	}
</script>

<div
	class="flex w-full gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}"
	data-message-id={message.id}
>
	<div
		class="flex max-w-[min(100%,42rem)] flex-col {message.role === 'user'
			? 'items-end'
			: 'items-start'}"
	>
		<div
			class="w-full rounded-2xl shadow-sm {message.role === 'user'
				? 'bg-primary text-primary-foreground'
				: 'bg-muted/70 ring-1 ring-border/40'}"
		>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="px-4 py-3 text-[15px] leading-relaxed {message.role === 'user' && !busy
					? 'cursor-pointer'
					: ''}"
				title={message.role === 'user' && !busy ? 'Click to edit' : undefined}
				onclick={message.role === 'user' ? onUserBubbleClick : undefined}
			>
				{#if message.role === 'user' && message.editedFrom}
					<p
						class="mb-2 text-[10px] font-medium tracking-wide uppercase opacity-80 {message.role ===
						'user'
							? 'text-primary-foreground/80'
							: ''}"
					>
						Edited
					</p>
				{/if}
				{#if message.role === 'assistant' && message.model}
					<p class="mb-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
						{message.model}
					</p>
				{/if}

				<div
					class="prose prose-sm dark:prose-invert prose-p:my-2 prose-p:first:mt-0 prose-p:last:mb-0 max-w-none {message.role ===
					'user'
						? 'prose-invert'
						: ''}"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html displayHtml}
				</div>

				{#if message.sources && message.sources.length > 0}
					<div
						class="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-white/20 pt-3 dark:border-border/60 {message.role ===
						'user'
							? 'border-white/25'
							: ''}"
					>
						<span class="shrink-0 text-[10px] font-medium tracking-wide uppercase opacity-80">
							Sources
						</span>
						{#each message.sources as source (source.fileId)}
							<span
								class="max-w-full truncate rounded-md bg-background/15 px-1.5 py-0 text-[10px] leading-tight opacity-90 ring-1 ring-white/20 dark:bg-background/40 dark:ring-border/50"
								title={source.filePath}
							>
								{source.filePath}
							</span>
						{/each}
					</div>
				{/if}

				{#if message.status === 'failed' && message.errorMessage}
					<p class="mt-2 text-xs text-red-600 dark:text-red-400">{message.errorMessage}</p>
				{/if}

				{#if showVariants}
					<div
						class="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2 {message.role ===
						'user'
							? 'border-white/20'
							: ''}"
					>
						<span class="text-[10px] text-muted-foreground">Versions</span>
						<div class="flex items-center gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="size-7"
								disabled={busy || (message.variantIndex ?? variantCount - 1) <= 0}
								onclick={() => onVariantPrev?.()}
								aria-label="Older version"
							>
								<ChevronLeftIcon class="size-4" />
							</Button>
							<span class="min-w-12 text-center text-[11px] tabular-nums text-muted-foreground">
								{variantPos}/{variantCount}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="size-7"
								disabled={busy ||
									(message.variantIndex ?? variantCount - 1) >= variantCount - 1}
								onclick={() => onVariantNext?.()}
								aria-label="Newer version"
							>
								<ChevronRightIcon class="size-4" />
							</Button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#if message.role === 'user'}
			<div class="mt-1.5 flex items-center justify-end gap-0.5 pr-0.5">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="size-7 text-muted-foreground hover:text-foreground"
					onclick={() => onCopy?.()}
					aria-label="Copy message"
				>
					<CopyIcon class="size-3.5" />
				</Button>
			</div>
		{:else}
			<div class="mt-1.5 flex flex-wrap items-center gap-0.5 pl-0.5">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="size-7 text-muted-foreground hover:text-foreground"
					disabled={busy}
					onclick={() => onRegenerate?.()}
					aria-label="Regenerate response"
				>
					<RefreshCwIcon class="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="size-7 text-muted-foreground hover:text-foreground"
					onclick={() => onCopy?.()}
					aria-label="Copy response"
				>
					<CopyIcon class="size-3.5" />
				</Button>
				{#if message.status === 'failed'}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="size-7 text-muted-foreground hover:text-foreground"
						disabled={busy}
						onclick={() => onRetry?.()}
						aria-label="Retry after error"
					>
						<RotateCcwIcon class="size-3.5" />
					</Button>
				{/if}
			</div>
		{/if}
	</div>
</div>
