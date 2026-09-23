<script lang="ts">
	interface Props {
		message?: string;
	}

	let { message }: Props = $props();
</script>

<div class="ccl-loading-container" role="status" aria-live="polite" aria-busy="true">
	<div class="ccl-loading-loader" aria-hidden="true">
		<span class="ccl-loading-dot"></span>
		<span class="ccl-loading-dot"></span>
		<span class="ccl-loading-dot"></span>
	</div>
	{#if message}
		<p class="ccl-loading-message">{message}</p>
	{/if}
</div>
