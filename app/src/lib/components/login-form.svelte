<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
	} from "$lib/components/ui/field/index.js";
	import { resolve } from '$app/paths';

	const id = $props.id();

	let username = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	onMount(() => {
		// If user already has a valid access token, redirect to app
		const token = localStorage.getItem('accessToken');
		if (token) {
			const next = new URLSearchParams(location.search).get('next') ?? '/';
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(next);
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMsg = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const data = await res.json();
			if (!res.ok) {
				errorMsg = data.message ?? 'Login failed';
				return;
			}
			localStorage.setItem('accessToken', data.accessToken);
			localStorage.setItem('username', data.username);
			localStorage.setItem('role', data.role);
			const next = new URLSearchParams(location.search).get('next') ?? '/';
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(next);
		} finally {
			loading = false;
		}
	}
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description>Enter your username below to login to your media server</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit}>
			<FieldGroup>
				{#if errorMsg}
					<p class="text-sm text-destructive">{errorMsg}</p>
				{/if}
				<Field>
					<FieldLabel for="username-{id}">Username</FieldLabel>
					<Input id="username-{id}" type="text" placeholder="Enter your username" bind:value={username} required />
				</Field>
				<Field>
					<FieldLabel for="password-{id}">Password</FieldLabel>
					<Input id="password-{id}" type="password" bind:value={password} required />
				</Field>
				<Field>
					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? 'Logging in…' : 'Login'}
					</Button>
					<FieldDescription class="text-center">
						Don't have an account? <a href={resolve('/signup')}>Sign up</a>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	</Card.Content>
</Card.Root>
