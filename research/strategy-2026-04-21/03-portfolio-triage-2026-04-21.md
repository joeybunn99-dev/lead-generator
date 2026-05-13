# Portfolio Triage — 2026-04-21

## The honest problem

Joey has ~12 named projects. No individual human can give meaningful energy to more than 2 at once. Today's brother demo fizzled partly because three different projects (Joshua, BunnTranslator, BunnUSBtest) all had simultaneous issues — symptom of spread-too-thin focus. This triage cuts that by committing: pick two, mothball the rest.

## Scoring framework

Each project rated 1–10 on five dimensions. Weighted composite indicates priority. **This is my honest read — challenge anything you disagree with.**

| Project | Rev Potential | Distance to MRR | Moat | Effort-to-MRR | Strategic Fit | Composite | Verdict |
|---|---|---|---|---|---|---|---|
| **Joshua** | 8 | **8** | 5 | 7 | **10** | **38/50** | **PRIMARY FOCUS** |
| bunncom.com + SEO | 4 | 9 | 5 | 8 | 7 | 33/50 | **KEEP (as Joshua distribution)** |
| BunnUSBtest | 1 | 10 | 10 | 10 | 2 | 33/50 | Keep-as-tool, not a product |
| AdForge | 6 | 5 | 3 | 6 | 5 | 25/50 | Mothball — crowded, orthogonal to voice AI race |
| Bunn Transcribe | 3 | 8 | 2 | 9 | 3 | 25/50 | Internal tool, already live, leave running |
| BunnTranslator | 7 | **3** | 4 | **3** | 6 | 23/50 | **DEFER to Q3 2026** — far from MRR, regulated market |
| Princeville | 3 | 4 | 7 | 4 | 4 | 22/50 | Mothball — Apple Dev hold, long procurement |
| Lead Generator | 4 | 2 | 6 | 3 | 3 | 18/50 | **Reclassify as Joshua GTM infrastructure** — not a sellable product |
| Clarity Bridge v2 | 2 | 2 | 8 | 2 | 3 | 17/50 | Relationship investment, not a MRR product |

Internal infra (BunnBrain, @bunncom/ui, bunn-cli, H&B Labs) — not scored. These are dev-velocity multipliers, no direct revenue path expected.

## Why Joshua is unambiguously #1

- **The tech is built.** LiveKit Agents + Deepgram + Claude Haiku + ElevenLabs is already running, has taken real calls, has a real SIP trunk provisioned. You are architecturally at parity with Retell/Synthflow/Goodcall (see `01-voice-ai-competitive-2026-04-21.md`).
- **The market is paying.** $249–$500/month per location is established price point. SMBs adopt voice AI at "1 extra captured call pays for the service" math.
- **Distance to MRR is weeks, not months.** You need productization (pricing, landing page, onboarding flow, billing) and outbound motion. You do NOT need more tech.
- **Strategic fit is perfect.** "Generic voice AI SaaS for any SMB" is exactly Bunn's stated positioning per CLAUDE.md. Joshua IS the Bunn thesis.
- **The race is real.** Your brother is testing Retell. If Retell wins this comparison, Joshua becomes tech debt instead of a product. The 90-day window matters.

## Why the #2 slot goes to Joshua's distribution layer, not a second product

I debated putting BunnTranslator or AdForge as the #2 product. Neither survives the scrutiny:

- **BunnTranslator:** massive market (medical interpretation is $1B+), but Phase 1 execution hasn't started, HIPAA/BAA friction gates Phase 2, iPad spikes are Day 1. Realistically 4–6 months to first paying customer. Over the same 6 months Joshua can capture 20+ paying NC SMBs. **Opportunity cost of splitting attention is too high.**
- **AdForge:** AI video generation is a more crowded market than voice AI (Runway, Pika, Kling, Veo, Sora + 50 app-layer products), with lower switching costs. Even if Joey ships, MRR ceiling is lower than Joshua's with more competition. **Worse expected value.**

Instead, the #2 slot should be the **distribution flywheel for Joshua**: the Lead Generator outbound engine + bunncom.com SEO inbound + a single well-made product landing page. None of those three are separate products — they're all pipes feeding Joshua. Treating them as one focus item (not three) keeps this honestly two-focus.

## The mothball list (what gets ZERO hours for 90 days)

Honest: these don't die forever. They just don't get developer time until Joshua has >$5k MRR.

- **BunnTranslator** — pause execution. Keep the spec + memory intact. Revisit Q3 2026 if Joshua is profitable and you want a healthcare-vertical expansion.
- **AdForge** — pause at Phase 4. Dashboard + Kie.ai + Seedance are enough code to generate one or two Bunn landing-page hero videos if needed. No new feature work.
- **Princeville Connect** — Apple Developer is on hold anyway. Don't touch until Apple clears, and even then, only if you see a concrete paying customer signal.
- **Clarity Bridge v2** — keep the zero-contact posture, keep the BunnUSBtest rehearsal kit, but don't build more until Clarity Smithfield asks. It's a relationship investment, not a product.
- **Clarity Vision interpreter pilot (BunnTranslator Phase 1)** — connected to above; deferred.

## What stays running (maintenance-only, no new dev)

- **bunncom.com / SEO** — keep the 122 pages live, keep GSC monitoring, ship SEO tweaks opportunistically. This is Joshua's inbound lead source.
- **Bunn Transcribe** — already live on VPS, no customer depends on it enough to matter. Keep running; fix if it breaks.
- **Bunn Communications (parent company)** — telecom/IT work is the day job that pays the bills while Joshua gets to MRR. Don't disturb.
- **BunnBrain + bunn-cli + @bunncom/ui** — dev infrastructure, stays in use.
- **H&B Labs with Ben** — partnership, keep shipping to the shared org as work organically goes there.
- **BunnUSBtest** — complete the Smithfield sprint items (01-probe / 02-observe split, window-only capture, long recording) when the Smithfield visit date gets close. That's one focused block, maybe 4 hours total, not an ongoing commitment.

## The anti-patterns I'm guarding against

Things I want to flag explicitly so we don't drift:

1. **Starting a third product because Joshua hits a wall.** When Joshua stalls in GTM (it will — cold outbound takes weeks to pattern-match), the temptation is to "pivot" into AdForge or BunnTranslator. **Don't.** GTM stalls are normal and require iteration of messaging, not a new product.
2. **Building more Joshua features because it feels more productive than selling.** The tech is done. Features are a distraction from the actual bottleneck (distribution). The only feature work allowed in the next 30 days: onboarding flow, billing, vertical prompt templates for home-services / legal.
3. **Letting the brother's Retell comparison become existential.** If his Retell is faster/better, it's still a commercial platform he'd pay per-minute for; Joshua with Bunn support at $299/mo flat beats per-minute billing for most customers. Position against, not compete with.
4. **HIPAA-compliance detour for BunnTranslator.** Joey has the instinct to fix BunnTranslator to compete with No Barrier. Don't. HIPAA/BAA/SOC 2 is 6 months of compliance work before a single customer pays. Not the right fight for a solo founder in 2026.

## 30/60/90 target (to be fleshed out in GTM playbook)

- **Day 30:** 1 paying Joshua customer ($249–$399 MRR), 10 completed demos, onboarding flow live, landing page live for home-services vertical.
- **Day 60:** 3 paying customers, $900–$1,200 MRR, first customer case study written (w/ real missed-call-recovery dollars), second vertical landing page (legal).
- **Day 90:** 5–7 paying customers, $1,500–$2,500 MRR, referral program live, Retell/brother's-build comparison published as marketing asset.

At $2.5k MRR × 80% gross margin × 12 = ~$24k/year retained revenue by day 90 from one vertical, solo founder execution. Not a VC outcome; **is** a real, recurring, defensible income that funds the next vertical + eventual HB Labs / BunnTranslator investment.

## Bottom line

**Joshua + its distribution flywheel, 80% of the next 90 days.** Everything else either stays in maintenance or gets paused. The discipline of saying no to 10 things is what makes the 2 that remain actually ship.

---

**Open question for Joey (morning review):**
- Do you agree Joshua is #1? If you feel stronger about AdForge or BunnTranslator, say why — I'll re-run the triage with different weighting.
- Comfortable with BunnTranslator deferred to Q3? The Clarity relationship is the hesitation here.
- Any project I scored that you want to argue for? I'm open — this is your business, my scores are a starting point.
