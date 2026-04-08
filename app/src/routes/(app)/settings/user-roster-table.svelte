<script lang="ts">
	import { createRawSnippet } from 'svelte';
	import {
		type ColumnDef,
		type ColumnFiltersState,
		type PaginationState,
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel
	} from '@tanstack/table-core';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import { FlexRender, createSvelteTable, renderSnippet } from '$lib/components/ui/data-table';

	type UserSummary = {
		id: string;
		username: string;
		displayName: string;
		role: 'ADMIN' | 'USER';
		approved: boolean;
		createdAt: string;
	};

	let { users }: { users: UserSummary[] } = $props();

	const joinedFormatter = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium'
	});

	const roleSnippet = createRawSnippet<[{ role: UserSummary['role'] }]>((getRole) => {
		const { role } = getRole();
		const tone =
			role === 'ADMIN'
				? 'border-destructive/20 bg-destructive/10 text-destructive'
				: 'border-border bg-muted text-muted-foreground';

		return {
			render: () =>
				`<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}">${role}</span>`
		};
	});

	const approvalSnippet = createRawSnippet<[{ approved: boolean }]>(
		(getApproved) => {
			const { approved } = getApproved();
			const tone = approved
				? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
				: 'border-amber-500/25 bg-amber-500/10 text-amber-600';
			const label = approved ? 'Approved' : 'Pending';

			return {
				render: () =>
					`<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}">${label}</span>`
			};
		}
	);

	const columns: ColumnDef<UserSummary>[] = [
		{
			accessorKey: 'displayName',
			header: 'Name',
			cell: ({ row }) => row.original.displayName,
			filterFn: (row, _columnId, filterValue) => {
				const search = String(filterValue ?? '').trim().toLowerCase();
				if (!search) return true;

				return [row.original.displayName, row.original.username].some((value) =>
					value.toLowerCase().includes(search)
				);
			}
		},
		{
			accessorKey: 'username',
			header: 'Username',
			cell: ({ row }) => `@${row.original.username}`
		},
		{
			accessorKey: 'role',
			header: 'Role',
			cell: ({ row }) => renderSnippet(roleSnippet, { role: row.original.role })
		},
		{
			accessorKey: 'approved',
			header: 'Status',
			cell: ({ row }) => renderSnippet(approvalSnippet, { approved: row.original.approved })
		},
		{
			accessorKey: 'createdAt',
			header: () => 'Joined',
			cell: ({ row }) => joinedFormatter.format(new Date(row.original.createdAt))
		}
	];

	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
	let columnFilters = $state<ColumnFiltersState>([]);

	const table = createSvelteTable({
		get data() {
			return users;
		},
		columns,
		state: {
			get pagination() {
				return pagination;
			},
			get columnFilters() {
				return columnFilters;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onPaginationChange: (updater) => {
			pagination = typeof updater === 'function' ? updater(pagination) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
		}
	});

	function updateSearch(value: string) {
		table.getColumn('displayName')?.setFilterValue(value);
	}
</script>

<div class="overflow-hidden rounded-xl border bg-card/70 shadow-sm">
	<div class="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<p class="text-sm font-medium">Search roster</p>
			<p class="text-xs text-muted-foreground">Search by display name or username.</p>
		</div>
		<Input
			placeholder="Filter users..."
			value={(table.getColumn('displayName')?.getFilterValue() as string) ?? ''}
			oninput={(event) => updateSearch(event.currentTarget.value)}
			class="sm:max-w-xs"
		/>
	</div>

	<Table.Root>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<Table.Row>
					{#each headerGroup.headers as header (header.id)}
						<Table.Head class="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							{#if !header.isPlaceholder}
								<FlexRender content={header.column.columnDef.header} context={header.getContext()} />
							{/if}
						</Table.Head>
					{/each}
				</Table.Row>
			{/each}
		</Table.Header>
		<Table.Body>
			{#each table.getRowModel().rows as row (row.id)}
				<Table.Row>
					{#each row.getVisibleCells() as cell (cell.id)}
						<Table.Cell
							class={
								cell.column.id === 'displayName'
									? 'font-medium'
									: cell.column.id === 'username'
										? 'font-mono text-xs text-muted-foreground'
										: cell.column.id === 'createdAt'
											? 'whitespace-nowrap text-muted-foreground'
											: ''
							}
						>
							<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
						</Table.Cell>
					{/each}
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
						No users match your search.
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<div class="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
		<p>
			{table.getFilteredRowModel().rows.length} visible of {users.length} users
		</p>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={() => table.previousPage()}
				disabled={!table.getCanPreviousPage()}
			>
				Previous
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={() => table.nextPage()}
				disabled={!table.getCanNextPage()}
			>
				Next
			</Button>
		</div>
	</div>
</div>