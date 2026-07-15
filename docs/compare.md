---
title: Compare
description: How Story Points stacks up against PlanningPoker.com, Parabol, Jira plugins, and story-points.app — and when to pick something else
---

# Story Points vs. the alternatives

> The honest version: every tool here can run a planning-poker session.
> Story Points is the one that's free, open source, needs no accounts, and
> treats your room URL as the entire product. Here's where the others
> differ, and when they're genuinely the better pick.

*Facts checked July 2026 from each product's public site; pricing and limits
may have changed since.*

## At a glance

| | 🃏 Story Points | PlanningPoker.com | Parabol | Jira plugins | story-points.app |
| --- | --- | --- | --- | --- | --- |
| Price | Free, no tiers | Free tier + paid plans | Free tier + paid plans | Per-user via Atlassian | £4.99/mo after trial |
| Accounts required | **None** | Facilitator signs up | Everyone signs up | Jira login | Sign-up + billing |
| Player limit | None | Capped on free tier | Tier-dependent | Jira seats | 12 |
| Persistent rooms | ✔ same URL every sprint | ✔ with account | ✔ with account | ✔ inside Jira | ✔ with account |
| Hidden votes + auto-reveal | ✔ | ✔ | ✔ | ✔ | ✔ |
| Custom decks & grouping | ✔ | Partial | Partial | Partial | Scales only |
| Ticket queue + CSV import | ✔ Linear/Jira CSV, previewed | Jira sync (paid) | ✔ | Native | ✘ |
| Export results | ✔ Markdown, CSV, JSON API | ✔ (paid tiers) | ✔ | Native | Paid tier |
| Plain-HTTP API + llms.txt | ✔ | ✘ | API (paid) | Jira API | ✘ |
| Open source / self-host | ✔ MIT, 3 commands | ✘ | ✔ AGPL | ✘ | ✘ |
| Ads / data monetization | None | Ads on free tier | None | None | None claimed |

## PlanningPoker.com

The incumbent — around since 2006, and fine at the core loop. The trade-offs
are a dated free tier (player caps, ads) and accounts-plus-paid-plans for
the features that matter to a recurring team: persistent games, Jira sync,
exports. **Choose it if** your organization already pays for it or you need
its deep Jira two-way sync. Story Points covers the import/export side with
tracker CSV import and a plain-HTTP API instead — no integration to
administer, nothing to grant OAuth to.

## Parabol

The strongest product on this list — but it's a full agile-meetings suite
(retrospectives, standups, sprint poker) with accounts, workspaces, and a
per-user price once you outgrow the free tier. Estimation is one mode of a
much bigger tool. **Choose it if** you want retros and standups in the same
place and don't mind everyone signing up. If you only need estimation,
you're carrying the weight of a suite to play cards.

## Planning poker plugins for Jira

Estimation that lives inside Jira: native ticket sync, votes written back to
the story field. The cost is the Jira-ness — an admin has to install it,
everyone estimating needs a Jira seat, and guests (a contractor, a designer,
your PM's PM) can't just click a link. **Choose one if** every estimator has
a Jira license and you want write-back with zero copy-paste. Story Points
deliberately stays outside your tracker: import the CSV, estimate with
anyone who has the URL, export the results.

## story-points.app ("Scrum Poker")

No relation, despite the name. It's a paid product (£4.99/mo after a 14-day
trial) with required accounts, a 12-player room cap, and history/analytics
behind the subscription. The core loop — hidden votes, reveal, scales — is
the same as everything here. **Choose it if** its specific paid analytics
appeal to you. Otherwise the comparison is short: Story Points has no price,
no accounts, no player cap, and is open source.

## Physical cards

Undefeated for an in-person team in one room. **Choose them if** you're all
at the same table. Story Points is for when you're not — or when you want
the round recorded without someone typing it up.

## Why free doesn't mean "until we charge"

Story Points runs on Cloudflare's free tier and costs approximately nothing
to operate, so there is no paywall and no plan for one. It's MIT-licensed —
if it ever went away or went bad, `git clone`, `wrangler login`,
`npm run deploy` puts your own copy on your own Cloudflare account in a few
minutes. That's the real answer to "what's the catch": the license removes
the ability for there to be one.

**[Create a room](/)** — no signup, you'll be estimating in ten seconds. Or
read [how the features work](/docs/features) and
[the API](/docs/api).
