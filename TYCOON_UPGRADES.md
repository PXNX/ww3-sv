# Tycoon Tier / Upgrade Effects

- Tier upgrade (producer): doubles that producer's output (value = 2 per tier, applied in `producerMultiplier`).
- Every 100 owned units unlocks next tier (100 / 200 / 300 ... 1000).
- Last tier at 1000 owned: +5% overall production (`globalMultiplier` + 1.05 when any producer reaches 1000).
- -2% speed per upgrade owned (tier upgrades count toward this).
- `turbo` perk: +100% speed per level (max 3, so 2x / 3x faster cycles).
- Global upgrades: `global_regulator` 1.25x, `global_agency` 1.5x, `global_amendment` 2x, `global_mega` 3x, `global_titan` 4x.
- Click upgrades: `click_bucket` 2x, `click_valve` 2x, `click_hammer` 2x, `click_wrench` 2x, `click_fist` 3x, `click_crane` 4x, `click_titan` 5x, `click_nitro` 3x, `click_megatap` 6x, `click_god` 10x.
- Producer button colors: white = level up, yellow = next tier upgrade, greyed (opacity-40) = unaffordable.
