# TripSplit Bot — refined brief

## Summary
TripSplit is a Telegram bot that lives in group chats to help friends split trip expenses. An organizer creates a trip, sets currency, and adds members. Any member can log expenses (payer, amount, purpose, participants), split evenly or by custom shares, and the bot keeps running simplified balances (who owes whom). Users can view balances with /balance, see the expense list, and mark debts as paid after settling off-platform. The bot enforces visibility so only trip members can see trip amounts and provides the organizer a detailed trip overview.

## Audience
- Small groups of friends or families organizing shared expenses for a trip, typically 3–20 people.
- Non-technical users who want a simple, chat-native experience inside Telegram group chats and private confirmations via DM.

## Core entities
- Trip: name, currency, organizer, members, created-at, status (active/archived).
- Member: Telegram user id, display name, active flag (joined/left timestamps).
- Expense: id, trip id, creator id, payer id, amount, currency, description, participants list with shares or equal split, timestamp, immutable record.
- Share: per-expense participation and share fraction or explicit amount per participant.
- Balance: computed net amount per member (positive = they should receive, negative = they owe) and simplified settlement edges (who pays whom and how much).
- PaymentRecord: id, trip id, from, to, amount, timestamp, notes, confirmed boolean (marked paid by payer or receiver and requires quick confirm before clearing).

## Integrations & notification targets
- Primary integration: Telegram group chat where the trip is created. The bot will also use private Telegram messages (DMs) to members for sensitive confirmations and personal balance requests.
- Notifications:
  - Expense added: a concise summary posted to the trip's group chat if all trip members are present in that group; otherwise each trip member receives a DM summary.
  - New simplified-settlement suggestion or a requested /balance: returned as a DM to the requester and optionally posted to group if privacy allows (see Assumptions & defaults).
  - Payment-marking flow: confirmation prompt is sent to the actor via DM before changing records; organizer receives updates about cleared payments.

## Interaction flows (user-facing)
- /newtrip <TripName> <Currency>
  - Bot: asks organizer to add members (select from group participants or enter usernames). Trip created when organizer confirms.
- Add/remove members
  - Organizer can add members at any time (they become trip members).
  - Members can /leavetrip; leaving preserves historic records but removes future visibility/access.
- Log expense (in group or DM)
  - Command: /expense or press "Log expense" button.
  - Bot collects: payer (default = message author), amount, description, participants (default = all members), split type (Even / Custom shares). For custom, enter per-person amounts or percentages.
  - Bot rounds per currency rules, ensures sum of shares equals expense total by adjusting the payer's share if needed (see rounding rule).
  - Bot posts an expense summary to trip members (group or DMs per notification rule).
- View balances
  - /balance: bot returns simplified debts (minimal transfer set) and per-member net balances. Response sent as DM to requester; small summary may be posted to group if allowed.
  - /expenselist or /tripview: paginated list of all expenses in the trip for members (organizer gets full view; members see the same list).
- Settlement
  - /settle: bot computes minimal set of payments to clear net balances and presents it as a suggested list (who pays whom and how much).
  - Users pay each other off-platform. When a person pays, they run /paid <to_username> <amount> (or use inline "Mark paid" buttons). The bot asks for a one-tap confirmation (DM) before marking PaymentRecord confirmed and removing/adjusting outstanding debts.
  - Partial payments allowed. Each /paid creates a PaymentRecord; confirmed payments reduce outstanding balances.
- Organizer overview
  - /overview (organizer only): full ledger, per-expense details, current balances, and an export option (CSV) for the trip.

## Persistence
- Persist trips, members, immutable expense records, computed balances (recomputed from expenses + payments), payment records, and archived trips.
- Never delete expenses; allow editing only by expense creator or organizer (edits become new immutable audit entries: original preserved, edit logged).

## Payments & money handling
- The bot does NOT move money. It only computes suggested settlements and records user-declared payments / confirmations.
- Supports full and partial off-platform payments; payments must be manually marked in the bot and require a one-tap confirmation before clearing.
- No automatic reconciliation with third-party payment services in v1.

## Non-goals (v1)
- No automatic money transfers or payment-provider integration.
- No automatic multi-currency conversion between currencies (trip currency is chosen at creation and all amounts are in that currency).
- Not intended for enterprise accounting or tax reporting.

## UX details & validation rules
- Visibility: only trip members can run commands affecting or viewing a trip. If a command is issued from a chat where not all members are present, bot will DM members rather than expose details publicly.
- Rounding: amounts are rounded to the trip currency’s minor unit (default 2 decimals). To guarantee the sum of shares equals the expense total, the bot distributes rounding remainders by adjusting the payer’s share (payer absorbs rounding difference) so totals always net to zero.
- Immutable expenses: once an expense is submitted it cannot be deleted; edits create an audit entry linking to the original. This prevents lost expenses.
- Joining/leaving mid-trip: leaving members keep their historical debt/credit; they remain in the ledger (marked inactive) so past expenses and balances still net correctly. New members are not retroactively assigned shares to past expenses.
- Simplification: bot computes net balances and uses a minimal-transfer heuristic (greedy settlement: largest creditor matched with largest debtor) presented to users as a suggested list of payments.
- Confirmations: any action that clears or materially changes balances (mark paid, delete expense, accept edit) prompts a one-tap confirmation (via DM) from the initiating user.

## Security & privacy (user-visible choices)
- Trip visibility limited to trip members; bot enforces permission checks for commands and data exports.
- Organizer access: organizer can view and export the full trip ledger and manage membership.

## Assumptions & defaults
- Trip currency is single and chosen at trip creation (rationale: owner requested setting currency per trip). 
- Rounding uses two decimal places by default (common for fiat currencies); rounding remainder is applied to the payer’s share so totals always net to zero (rationale: prevents floating-cent drift and ensures ledger sums to zero).
- Partial payments are supported and recorded as PaymentRecords that require confirmation (rationale: users explicitly said payments happen off-platform and they want to mark debts paid). 
- Expense records are immutable; edits are stored as audit entries rather than deleting (rationale: owner demanded "never lose an expense someone logged").
- Visibility & delivery: expense summaries are posted to the trip group if all trip members are present there; otherwise notifications are sent privately to members (rationale: keeps trip amounts visible only to members and avoids exposing amounts in unrelated chats).
- Simplification algorithm: use a greedy largest-creditor/ largest-debtor matching to produce a small set of payments (rationale: deterministic, easy for users to understand; matches the requirement "simplified down to the fewest payments").
- Organizers get a dedicated /overview command exposing full ledger and an export (CSV) option (rationale: owner requested a clean overview for organizer).


