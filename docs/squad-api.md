# Friends and raid squads: bot server contract

The Mini App lets a player see their friends, who of them is online, and team up with up to two of them for a raid. Everything here is served by the Telegram bot's server; the game only lists and asks. This document is the contract the client in `src/lib/services/squad.ts` and `src/lib/stores/squad.svelte.ts` is written against.

## Identity and transport

- Endpoints are named calls made through `call(name, input)` in `src/lib/services/telegram.ts`: either `Telegram.WebApp.Serverless.call(name, input)` or `POST ${VITE_TELEGRAM_API_URL}/api/<name>` with the JSON body as input and the raw initData in the `x-telegram-init-data` header. The server checks the initData signature and takes the player's Telegram user id from it; the client never sends its own id.
- Replies use the existing envelope: `200 { "ok": true, "result": <reply> }`; `401` for a refused identity; `400 { "ok": false, "description": "...", "parameters": { "code": "<CODE>" } }` for a refusal by the endpoint (the client reads `parameters.code`).
- All ids are strings on the wire (Telegram user ids are sent as decimal strings, so the client never has to care about 53-bit limits). Field names are `snake_case`. Times are Unix timestamps in **milliseconds** (`expires_at`).
- The client validates every reply and treats anything malformed as a failed call, so extra fields are fine but missing or mistyped ones are not.

## What a friend is

Telegram gives Mini Apps no access to contacts. A friend is a relation the bot keeps itself, for example:

- someone who started the bot through the player's invite link (and the other way round), or
- a relation the bot created on purpose (for example by a `/friend` command or after a shared group game).

The relation is symmetric. The server decides who is a friend; the client only lists what `friends` returns.

## Presence

- A player is **online** while the Mini App is open: a `presence` heartbeat or an open squad WebSocket within the last **60 s**.
- The client sends `presence` every **30 s** while the app is open and visible, and once right away when it starts.
- `in_raid` is reported by the client in the heartbeat and shown to friends as "in a raid". It does not block invites; it is only a hint.
- When presence or `in_raid` of a friend changes, the server should push a `presence` event to that player's friends who have a socket open (see below). Without the push, clients refresh the list every 30 s anyway.

### Privacy

Presence and friend relations are new personal data the bot stores (who is a friend of whom, when someone last had the app open, whether they are in a raid). Keep presence only in memory or with a short TTL, never expose it to non-friends, and the privacy notice (`legal_privacy_telegram_body`) needs a line about it before release.

## Squad rules

- A squad has at most **3 members including the leader**.
- The **leader is the inviter**: a player who is not in a squad and invites a friend becomes the leader of a new squad once the first invite is accepted (until then there is no squad, only an outgoing invite).
- Only the leader may invite (`NOT_LEADER` otherwise) or kick.
- Capacity counts members plus the leader's still-open outgoing invites: inviting when `members + open invites >= 3` fails with `SQUAD_FULL`. Accepting into a squad that is full by then also fails with `SQUAD_FULL`.
- The invitee must be a friend (`NOT_FRIENDS`) and online (`NOT_ONLINE`).
- Invites **expire after 60 s**. Inviting the same friend again while an invite is open renews it and returns the same invite id.
- Accepting an invite while already in another squad leaves that squad first.
- Leaving: a member who leaves is removed. If the leader leaves, the member who joined first becomes leader. A squad left with a single member is dissolved (that player's open outgoing invites stay valid and recreate a squad on acceptance).
- A player who goes offline (no presence and no socket for 60 s) is removed from their squad as if they had left.

## Shapes

```ts
// A friend as listed by `friends` and as the sender of an invite
Friend = {
  id: string;              // non-empty
  name: string;            // display name, usually the Telegram first name
  photo_url?: string;      // https only; anything else is ignored
  online: boolean;
  in_raid: boolean;
}

SquadMember = {
  id: string;
  name: string;
  photo_url?: string;
}

Squad = {
  id: string;
  leader_id: string;       // must be one of members[].id
  members: SquadMember[];  // 1..3 entries, in joining order, leader included
}

// An invite the player received
SquadInvite = {
  id: string;
  from: Friend;
  expires_at: number;      // ms since epoch
}

// An invite the player sent and nobody answered yet
OutgoingInvite = {
  id: string;
  to_id: string;
  expires_at: number;
}
```

## Endpoints

| Name            | Input                                    | Result                                                                                      | Error codes                                                                 |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `friends`       | `{}`                                     | `{ friends: Friend[] }`                                                                     | none                                                                        |
| `squad_state`   | `{}`                                     | `{ you: string, squad: Squad \| null, invites: SquadInvite[], outgoing: OutgoingInvite[] }` | none                                                                        |
| `presence`      | `{ in_raid: boolean }`                   | `{}`                                                                                        | none                                                                        |
| `squad_invite`  | `{ friend_id: string }`                  | `OutgoingInvite`                                                                            | `NOT_FRIENDS`, `NOT_ONLINE`, `SQUAD_FULL`, `NOT_LEADER`, `ALREADY_IN_SQUAD` |
| `squad_respond` | `{ invite_id: string, accept: boolean }` | `{ squad: Squad \| null }` (the joined squad on accept, `null` on decline)                  | `INVITE_EXPIRED`, `SQUAD_FULL`                                              |
| `squad_leave`   | `{}`                                     | `{}`                                                                                        | `NOT_IN_SQUAD`                                                              |
| `squad_kick`    | `{ member_id: string }`                  | `{ squad: Squad \| null }`                                                                  | `NOT_LEADER`, `NOT_IN_SQUAD`                                                |

- `you` in `squad_state` is the player's own id as the server knows it, so the client can tell itself apart from the other members.
- `invites` lists only unexpired invites addressed to the player; `outgoing` only unexpired invites the player sent.
- `INVITE_EXPIRED` covers every invite that can no longer be accepted: expired, cancelled, unknown, or the inviter is no longer a leader.
- `ALREADY_IN_SQUAD`: the friend is already a member of the player's squad.
- `NOT_IN_SQUAD`: leaving without a squad, or kicking someone who is not a member.
- Every successful change (invite, respond, leave, kick, presence timeout) pushes the matching realtime events to everyone affected.

## Realtime: `${VITE_TELEGRAM_API_URL}/ws/squad`

A WebSocket (the client turns `https://` into `wss://`). Messages are JSON text frames.

### Handshake

1. The client opens the socket and sends `{ "type": "hello", "initData": "<raw initData>" }` as its first message.
2. The server checks the signature exactly like the `x-telegram-init-data` header. On success it answers `{ "type": "welcome", "you": "<user id>" }`; on failure it closes with code `4001`. The client treats `4001` as final and does not reconnect until the app is reopened.
3. An open socket counts as presence.

The client reconnects with exponential backoff (1 s doubling up to 30 s, with jitter) and fetches `squad_state` and `friends` again after each reconnect, so the server need not replay missed events. The client sends `{ "type": "ping" }` every 25 s; the server answers `{ "type": "pong" }` (or ignores it, the ping only keeps proxies from closing the socket).

### Server to client

| Message                                                                                                    | When                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `{ type: "welcome", you: string }`                                                                         | after a valid `hello`                                                                    |
| `{ type: "squad", squad: Squad \| null }`                                                                  | the player's squad changed (someone joined, left, was kicked, leader changed, dissolved) |
| `{ type: "invite", invite: SquadInvite }`                                                                  | the player received an invite                                                            |
| `{ type: "invite_gone", invite_id: string, reason: "accepted" \| "declined" \| "expired" \| "cancelled" }` | an invite the player sent or received can no longer be answered                          |
| `{ type: "presence", friend_id: string, online: boolean, in_raid: boolean }`                               | a friend's presence changed                                                              |
| `{ type: "relay", from: string, payload: unknown }`                                                        | a squad mate sent game data                                                              |
| `{ type: "pong" }`                                                                                         | answer to `ping`                                                                         |

The client also refreshes `squad_state` whenever it gets `squad`, `invite` or `invite_gone`, so these events may be sent without exact ordering guarantees.

### Client to server

| Message                                            | Meaning                                                                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ type: "hello", initData: string }`              | first message, see handshake                                                                                                                                               |
| `{ type: "relay", payload: unknown, to?: string }` | game data for the squad: delivered to every **other** member of the sender's squad, or only to member `to` when given. Dropped silently when the sender is not in a squad. |
| `{ type: "ping" }`                                 | keep-alive                                                                                                                                                                 |

The server must not interpret `payload`. It should cap a frame at 16 KiB and a sender at about 40 relay frames per second (drop excess frames rather than close the socket), and stamp `from` itself from the authenticated socket, never trusting the client.

## In-raid relay (game data inside `payload`)

The raid integration defines and validates its own messages; the server only forwards them. The intended protocol, for orientation:

- The **leader runs the simulation**; members are thin clients.
- Leader to all: `{ kind: "raid-start", map, mode, seed, members }` when the leader starts a raid from the lobby. Members switch to the raid screen on receipt.
- Member to leader (with `to: leader_id`): `{ kind: "input", ... }` with the member's joystick, aim and button state, sent on change and at least a few times per second.
- Leader to all: `{ kind: "snapshot", ... }` about **15 times per second**, with the world state the members render.
- Leader to all: `{ kind: "raid-end", results: { [memberId]: ... } }` with each member's results (XP, loot, quests). Each client applies its own share to its local profile.

If the leader disconnects mid-raid, members end the raid locally without rewards; there is no host migration.

## Dev mode (no server)

`squad.ts` ships a fake backend (`src/lib/services/squadDev.ts`) that implements the same rules between browser tabs of one machine via `BroadcastChannel('ww3-squad-dev')` and `localStorage`. It is used when the app runs under `vite dev` outside Telegram, or with `?squad=dev` in the URL. Each tab gets a random identity; the friends list is the other open tabs plus two friends who are always offline.
