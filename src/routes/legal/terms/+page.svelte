<!--
	Terms for the game and for the Telegram Stars purchases. The immediate-delivery paragraph is
	the consent the shop already asks for before every purchase (§ 356(5) BGB), so both texts say
	the same thing.
-->
<script lang="ts">
	import LegalPage from '#lib/components/LegalPage.svelte';
	import LegalSection from '#lib/components/LegalSection.svelte';
	import { APP_NAME } from '#lib/config.js';
	import { TERMS_PAGE } from '#lib/legal/pages.js';
	import { m } from '#lib/paraglide/messages.js';
</script>

<LegalPage page={TERMS_PAGE}>
	<LegalSection heading={m.legal_terms_scope_heading()}>
		<p class="leading-relaxed">{m.legal_terms_scope_body({ app: APP_NAME })}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_contract_heading()}>
		<p class="leading-relaxed">{m.legal_terms_contract_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_delivery_heading()}>
		<p class="leading-relaxed">{m.legal_terms_delivery_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_account_heading()}>
		<p class="leading-relaxed">{m.legal_terms_account_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_fair_use_heading()}>
		<p class="leading-relaxed">{m.legal_terms_fair_use_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_availability_heading()}>
		<p class="leading-relaxed">{m.legal_terms_availability_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_liability_heading()}>
		<p class="leading-relaxed">{m.legal_terms_liability_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_changes_heading()}>
		<p class="leading-relaxed">{m.legal_terms_changes_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_terms_law_heading()}>
		<p class="leading-relaxed">{m.legal_terms_law_body()}</p>
	</LegalSection>
</LegalPage>
