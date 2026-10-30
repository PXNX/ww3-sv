/*
 * Recon registry: imagery targets and camera feeds.
 */
export const RECON_TARGET_TYPES = [
	{ id: 'vehicle', label: 'Vehicle', description: 'Tracked vehicle or armored column' },
	{ id: 'troops', label: 'Troops', description: 'Infantry or crew concentration' },
	{ id: 'facility', label: 'Facility', description: 'Storage, command post, or hangar' },
	{ id: 'supply', label: 'Supply', description: 'Fuel, ammo or logistics cache' }
] as const;
