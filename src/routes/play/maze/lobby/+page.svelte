<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	// The size cards live on the game page itself, so the old lobby hands straight over
	goto(resolve('/play/maze'));
</script>
