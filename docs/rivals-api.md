# Rivals: bot server contract for player-versus-player

Two modes let players attack each other when the game runs as a Telegram Mini App:

- **Beachhead**: raid another player's base and take part of their stock; they can raid yours.
- **Hermit Hackers**: hack another player's rig and steal DogeLite. Every attempt leaves the attacker's IP in the victim's firewall log, so the victim can hack back.

The client is `src/lib/services/rivals.ts`. Transport, identity, envelope and error format are the same as in `docs/squad-api.md` (named calls via `call(name, input)`, initData header, `{ ok, result }`, `parameters.code` on refusals, snake_case, string ids, times in **milliseconds**). Outside Telegram every call fails with `UNAVAILABLE` and both modes play alone.

The game's saves stay on the device. The server keeps a **published snapshot** of each player's side, decides the outcome of an attack against that snapshot, and keeps the logs. The victim's client applies the losses from the log the next time it opens (each log id once), so the server never needs to write into a save.

## Error codes

| Code        | Meaning                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| `NOT_FOUND` | no published base/rig for that id or IP                                    |
| `SELF`      | the player targeted themselves                                             |
| `COOLDOWN`  | the target was attacked by this player too recently (suggested: 1 h)       |
| `SHIELDED`  | the target was raided recently by anyone and is protected (suggested: 4 h) |
| `EXPIRED`   | the attack/hack id is unknown, already settled or older than 10 minutes    |
| `IP_TAKEN`  | `hackers_publish` with an IP another player already owns                   |

## Shared shapes

```ts
Player    = { id: string; name: string; photo_url?: string }   // https photos only
Resources = { wood: number; stone: number; iron: number; gold: number } // whole, >= 0
```

## Beachhead

```ts
Building = {
  kind: string;            // a BuildingKind of src/lib/game/beachhead/config.ts
  x: number; y: number;    // integers on the 12 x 8 battle grid
  hp_scale?: number;       // 0 < s <= 20
  damage_scale?: number;   // 0 < s <= 20
  crystal?: { type: string; level: number }  // an overcharge crystal, level >= 1
}
Base  = { buildings: Building[]; defense_scale?: number }  // must contain one "hq", <= 120 buildings
Rival = Player & { level: number; base: Base; loot: Resources; revenge?: boolean }
Raid  = { id: string; kind: "raided" | "defended" | "plundered"; player: Player; loot: Resources; at: number }
```

| Name                | Input                                               | Result                        | Errors                                      |
| ------------------- | --------------------------------------------------- | ----------------------------- | ------------------------------------------- |
| `beachhead_publish` | `{ base: Base, exposed: Resources, level: number }` | `{}`                          | none                                        |
| `beachhead_rivals`  | `{}`                                                | `{ rivals: Rival[] }` (0..6)  | none                                        |
| `beachhead_attack`  | `{ rival_id: string }`                              | `{ attack_id, rival: Rival }` | `NOT_FOUND`, `SELF`, `COOLDOWN`, `SHIELDED` |
| `beachhead_result`  | `{ attack_id: string, won: boolean }`               | `{ loot: Resources }`         | `EXPIRED`                                   |
| `beachhead_log`     | `{}`                                                | `{ events: Raid[] }` (0..50)  | none                                        |

- `publish` is sent when the map opens and after the base changed, at most once a minute. `exposed` is what the bunker does not protect; the server stores the latest one.
- `rivals` should prefer players of a similar `level`, put players who raided the caller in the last 24 h first with `revenge: true`, and leave out shielded players.
- `rival.loot` is what a win would take: suggested **20 %** of the target's `exposed` per resource (more with `revenge`, e.g. 30 %).
- `attack` locks the snapshot for this attack. `result` with `won: true` grants `loot` (capped by the target's current `exposed`), subtracts it from the stored `exposed`, shields the target, and writes two log lines: `plundered` for the attacker, `raided` for the target. With `won: false` it writes `defended` for the target only and grants nothing.
- The **victim's client** subtracts `loot` of each `raided` line it has not applied yet from its local stock (never below the protected share). It remembers applied ids.

## Hermit Hackers

```ts
Hacker = Player & {
  ip: string;          // a.b.c.d, each 0..255; the player's own fixed made-up address
  bank: number;        // DogeLite
  firewall?: number;   // 1..10, from the rig's hardware
  hacks?: number;      // successful hacks so far, shown in the dossier
  look?: AvatarLook;   // the avatar, as src/lib/game/avatar/look.ts parses it; optional
  revenge?: boolean;   // this player hacked the caller lately
}
FirewallEntry = { id: string; ip: string; player: Player; stolen: number; blocked?: boolean; at: number }
```

| Name               | Input                                  | Result                         | Errors                                      |
| ------------------ | -------------------------------------- | ------------------------------ | ------------------------------------------- |
| `hackers_publish`  | `{ ip, bank, firewall, hacks, look? }` | `{}`                           | `IP_TAKEN`                                  |
| `hackers_targets`  | `{}`                                   | `{ targets: Hacker[] }` (0..8) | none                                        |
| `hackers_lookup`   | `{ ip: string }`                       | `{ target: Hacker }`           | `NOT_FOUND`, `SELF`                         |
| `hackers_hack`     | `{ target_id: string }`                | `{ hack_id, target: Hacker }`  | `NOT_FOUND`, `SELF`, `COOLDOWN`, `SHIELDED` |
| `hackers_result`   | `{ hack_id: string, won: boolean }`    | `{ stolen: number }`           | `EXPIRED`                                   |
| `hackers_firewall` | `{}`                                   | `{ entries: FirewallEntry[] }` | none                                        |

- The client generates its own `ip` once and keeps it. An IP belongs to the first player who published it: `publish` with an IP owned by someone else is refused with `IP_TAKEN`, and the client then rolls a new IP and publishes again.
- `lookup` is how a hack-back works: the firewall log shows the attacker's IP, the player types `hack <ip>` or taps it, and the client looks the IP up.
- `targets` lists players who hacked the caller in the last 24 h first, with `revenge: true`.
- `result` with `won: true` steals a share of the target's bank (suggested **10 %**, 15 % with `revenge`, at most 5000), lowers the stored bank, and adds a `FirewallEntry` with the attacker's IP and `stolen` to the target's log. With `won: false` the entry has `stolen: 0` (the firewall held, but the trace is still there).
- The **victim's client** subtracts `stolen` of every entry it has not applied yet from its bank and remembers applied ids.

## Privacy

Published bases and rigs, names, photos and avatars are shown to other players picked as opponents. The privacy notice needs a line about it before release, and the server should drop a player's snapshot on request.
