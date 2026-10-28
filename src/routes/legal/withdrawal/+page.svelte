<!--
	Withdrawal notice for the digital goods sold for Telegram Stars: the 14-day right, the point at
	which it ends after immediate delivery, and the model form the law expects.
-->
<script lang="ts">
	import LegalPage from '#lib/components/LegalPage.svelte';
	import LegalSection from '#lib/components/LegalSection.svelte';
	import { LEGAL_OPERATOR } from '#lib/legal/config.js';
	import { WITHDRAWAL_PAGE } from '#lib/legal/pages.js';
	import { m } from '#lib/paraglide/messages.js';
</script>

<LegalPage page={WITHDRAWAL_PAGE}>
	<p class="leading-relaxed">{m.legal_withdrawal_intro()}</p>

	<LegalSection heading={m.legal_withdrawal_right_heading()}>
		<p class="leading-relaxed">{m.legal_withdrawal_right_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_withdrawal_expiry_heading()}>
		<p class="leading-relaxed">{m.legal_withdrawal_expiry_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_withdrawal_model_heading()}>
		<p class="leading-relaxed">
			{m.legal_withdrawal_model_body({ email: LEGAL_OPERATOR.email })}
		</p>
	</LegalSection>

	<LegalSection heading={m.legal_withdrawal_form_heading()}>
		<p
			class="rounded-xl border-2 border-ink/20 bg-sand/60 p-4 text-sm leading-relaxed whitespace-pre-line"
		>
			{m.legal_withdrawal_form_body({
				name: LEGAL_OPERATOR.name,
				street: LEGAL_OPERATOR.street,
				postalCode: LEGAL_OPERATOR.postalCode,
				city: LEGAL_OPERATOR.city,
				email: LEGAL_OPERATOR.email
			})}
		</p>
	</LegalSection>

	<LegalSection heading={m.legal_withdrawal_effect_heading()}>
		<p class="leading-relaxed">{m.legal_withdrawal_effect_body()}</p>
	</LegalSection>
</LegalPage>
