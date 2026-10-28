<!--
	Imprint (Impressum) under § 5 DDG. The operator details are TODO placeholders from the legal
	config until the real name, postal address and email arrive; the shared frame shows the
	template warning above this text.
-->
<script lang="ts">
	import LegalPage from '#lib/components/LegalPage.svelte';
	import LegalSection from '#lib/components/LegalSection.svelte';
	import { LEGAL_OPERATOR } from '#lib/legal/config.js';
	import { IMPRINT_PAGE } from '#lib/legal/pages.js';
	import { m } from '#lib/paraglide/messages.js';

	// A placeholder must not turn into a broken mailto: link before the address is real
	const contactHref = LEGAL_OPERATOR.email.startsWith('TODO')
		? null
		: `mailto:${LEGAL_OPERATOR.email}`;
</script>

<LegalPage page={IMPRINT_PAGE}>
	<LegalSection heading={m.legal_imprint_provider_heading()}>
		<address class="leading-relaxed not-italic">
			{LEGAL_OPERATOR.name}<br />
			{LEGAL_OPERATOR.street}<br />
			{LEGAL_OPERATOR.postalCode}
			{LEGAL_OPERATOR.city}<br />
			{LEGAL_OPERATOR.country}
		</address>
	</LegalSection>

	<LegalSection heading={m.legal_imprint_contact_heading()}>
		<p>
			{#if contactHref}
				<a class="underline decoration-2 underline-offset-2" href={contactHref}>
					{LEGAL_OPERATOR.email}
				</a>
			{:else}
				{LEGAL_OPERATOR.email}
			{/if}
		</p>
	</LegalSection>

	<LegalSection heading={m.legal_imprint_responsible_heading()}>
		<p>{LEGAL_OPERATOR.responsible}</p>
	</LegalSection>

	<LegalSection heading={m.legal_label_vat()}>
		<p>{LEGAL_OPERATOR.vatId}</p>
	</LegalSection>

	<LegalSection heading={m.legal_imprint_dispute_heading()}>
		<p class="leading-relaxed">{m.legal_imprint_dispute_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_imprint_liability_heading()}>
		<p class="leading-relaxed">{m.legal_imprint_liability_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_imprint_copyright_heading()}>
		<p class="leading-relaxed">{m.legal_imprint_copyright_body()}</p>
	</LegalSection>
</LegalPage>
