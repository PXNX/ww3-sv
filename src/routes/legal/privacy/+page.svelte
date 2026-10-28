<!--
	Privacy policy: what the game stores on the device, what the Telegram bot receives, and the
	rights under the GDPR. It describes the app as it is built: local progress, Telegram launch
	data, Stars payments, no analytics.
-->
<script lang="ts">
	import LegalPage from '#lib/components/LegalPage.svelte';
	import LegalSection from '#lib/components/LegalSection.svelte';
	import { LEGAL_OPERATOR } from '#lib/legal/config.js';
	import { PRIVACY_PAGE } from '#lib/legal/pages.js';
	import { m } from '#lib/paraglide/messages.js';
</script>

<LegalPage page={PRIVACY_PAGE}>
	<LegalSection heading={m.legal_privacy_controller_heading()}>
		<p class="leading-relaxed">{m.legal_privacy_controller_body()}</p>
		<address class="leading-relaxed not-italic">
			{LEGAL_OPERATOR.name}<br />
			{LEGAL_OPERATOR.street}<br />
			{LEGAL_OPERATOR.postalCode}
			{LEGAL_OPERATOR.city}<br />
			{LEGAL_OPERATOR.country}<br />
			{LEGAL_OPERATOR.email}
		</address>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_local_heading()}>
		<p class="leading-relaxed">{m.legal_privacy_local_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_telegram_heading()}>
		<p class="leading-relaxed">{m.legal_privacy_telegram_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_payments_heading()}>
		<p class="leading-relaxed">{m.legal_privacy_payments_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_hosting_heading()}>
		<p class="leading-relaxed">
			{m.legal_privacy_hosting_body({ hosting: LEGAL_OPERATOR.hosting })}
		</p>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_cookies_heading()}>
		<p class="leading-relaxed">{m.legal_privacy_cookies_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_retention_heading()}>
		<p class="leading-relaxed">{m.legal_privacy_retention_body()}</p>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_rights_heading()}>
		<p class="leading-relaxed">
			{m.legal_privacy_rights_body({ email: LEGAL_OPERATOR.email })}
		</p>
	</LegalSection>

	<LegalSection heading={m.legal_privacy_changes_heading()}>
		<p class="leading-relaxed">{m.legal_privacy_changes_body()}</p>
	</LegalSection>
</LegalPage>
