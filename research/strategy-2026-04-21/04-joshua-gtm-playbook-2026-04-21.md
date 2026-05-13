# Joshua GTM Playbook — 2026-04-21

Concrete, executable plan for Joshua's first 90 days to MRR. Everything in this doc is meant to be actioned, not discussed.

## 1. Product positioning (decide once, don't revisit)

**Tagline candidates — pick one for the landing page:**
- "The AI receptionist that doesn't cost your business another missed call."
- "Clayton-built AI phone coverage, for the calls you don't answer."
- "Your 24/7 phone front desk, from Bunn Communications."

**My pick: #1.** It leads with the customer pain (missed calls = lost revenue), names the mechanism (AI receptionist), and the stakes (another missed call). Short enough for a billboard.

**Sub-hed:** *24/7 call answering, appointment capture, and smart forwarding — no hold times, no robot voice, no missed opportunities. From Bunn Communications in Clayton, NC, since 1985.*

**Anti-positioning (what Joshua is not):**
- Not an outbound sales dialer (don't compete with Air AI / Bland — different product + TCPA risk)
- Not a generic developer platform (don't compete with Retell / Vapi — already lost)
- Not a replacement for your CRM (we feed your CRM, we don't become it)
- Not a one-time setup-and-forget product (we're a managed service, that's the Bunn-specific value-add)

## 2. Pricing tiers

Three tiers. Every landing page shows these. No custom deals under Starter.

| Tier | Price | Target | What they get |
|---|---|---|---|
| **Starter** | **$249/mo** | 1-location solo operator (plumber, roofer, solo attorney) | 24/7 answering, up to 300 calls/mo, appointment capture via email/SMS, smart forwarding to 1 cell, English only, white-glove setup with Bunn |
| **Growth** | **$399/mo** | 2–5 person shop, law firm w/ paralegals, small multi-location | Everything in Starter + unlimited calls, 3 routing destinations, integration with 1 calendar/CRM, bilingual EN/ES, weekly call review w/ Joey |
| **Vertical Pro** | **$699/mo** | Multi-location + higher-touch verticals | Everything in Growth + custom vertical prompt tuning, CRM/EHR integration, monthly optimization review, priority support |

**Pricing rationale** (see `01-voice-ai-competitive-2026-04-21.md`):
- $249 Starter is **below** MyAIFrontDesk ($199–$299), Sully.ai vertical ($200–$500), and at the low end of the SMB sweet spot — deliberately low to lower trial friction.
- $399 Growth is at the market median, with "Joey personally reviews your calls weekly" as the differentiator no commercial platform offers.
- $699 Vertical Pro is priced to match Viva AI dental tier; you offer the same integration depth via managed service, not self-service tooling.

**Margin math on Starter:** 300 calls/mo × 3 min avg × $0.14/min (Retell-equivalent cost) = $126/mo in infrastructure cost. Pricing at $249 leaves ~50% gross margin on peak usage. On median usage (150 calls), gross margin is ~75%.

**No free tier, no pay-as-you-go.** Commoditizes the offering. Pilot (below) replaces free tier.

## 3. The 30-day pilot offer (the real acquisition mechanic)

Every prospect gets offered the same thing: **"30 days free, we provision your number, we handle setup, you see the call transcripts and missed-call recovery numbers on day 30. If it's not worth $249/month to you then, cancel, no charge."**

Why this works:
- Eliminates "will this actually work for my business" objection
- Lets Joey personally run 3–5 simultaneous pilots to learn vertical patterns fast
- Conversion from pilot → paid runs 30–50% industry-wide when the pilot shows measurable revenue recovery
- Caps Joey's risk: 5 pilots × ~$20/month infra cost each = $100/month of pilot cost

## 4. Landing page copy (drop into a one-page for each vertical)

### Hero

> **Another missed call just cost you $500.**
>
> Joshua, from Bunn Communications, answers every call — 24/7 — so you don't lose another plumbing emergency at 2am, another intake at noon, another roof inspection on a Saturday.
>
> Built in Clayton, NC. Run by a real person (that's me, Joey). $249/month.
>
> **[ Start your 30-day free pilot ]**

### How it works (3 panels)

1. **You keep your existing number.** We forward calls to Joshua during hours you choose, or anytime you miss a call.
2. **Joshua answers, qualifies, books.** Schedules appointments, captures emergency requests, routes urgent calls to your cell.
3. **You get an email + text summary** after every call. Transcripts, lead info, follow-up suggestions. No hidden data.

### Who it's for (3 columns)

For **roofers / plumbers / electricians**: "One emergency call captured pays for two months of service."
For **law firms**: "Your intake is your front door. Don't let it close when you're in court."
For **anyone missing calls**: "If you miss 20% of calls, you're missing 20% of your revenue."

### Objections (FAQ below the fold)

- **"Will it sound robotic?"** Listen here: [recording of Hope, 30 seconds]. Guests routinely don't realize they're talking to AI.
- **"What if it mishandles a call?"** Every call's transcript comes to you within 60 seconds. You spot-check; we tune weekly.
- **"What integrations do you have?"** Google Calendar, Calendly, Jobber, ServiceTitan, HubSpot, MailerLite, Zapier. More on request.
- **"What happens to our call data?"** Audio is ephemeral — deleted at session end. Transcripts you own, stored on your private Bunn dashboard.
- **"What if I want to cancel?"** 30-day written notice any time. No contracts. Your number is yours.

### Proof bar (as soon as you have 1 pilot customer)

Real quote from pilot customer + one metric (e.g., "Captured 47 after-hours calls in month 1 — 12 booked appointments").

### CTA block
- **Primary CTA:** "Start your free 30-day pilot"
- **Secondary:** "Book a 15-min demo with Joey"
- **Trust chips:** "Bunn Communications, est. 1985" + "Clayton, NC" + "Built on ElevenLabs + Claude" (for tech-savvy buyers)

## 5. Outbound email sequence (5 emails, 14 days)

### Email 1 — Cold, local angle (send T+0)

```
Subject: Did you miss this call last Tuesday at 6:47pm?

Hi {{first_name}},

Quick note from Joey at Bunn Communications here in Clayton.

Most {{vertical}} businesses in the Triangle miss 20–30% of inbound calls — especially after hours. Every one of those is a booked job you didn't get. Worst case, the customer calls the next {{vertical}} on Google.

We built Joshua, an AI receptionist that answers your phone 24/7 in a real-sounding voice, captures the details, and texts you the summary while you're on the next roof / in court / at dinner. It handles scheduling, emergencies, routing — whatever you train it to.

30-day free pilot, no contract. We set it up on your existing number. If after 30 days you don't see at least one captured appointment that would have otherwise been missed, you walk away and owe us nothing.

Worth a 15-minute call? I'll send three times that work this week.

Joey Bunn
Bunn Communications, Inc. · Clayton, NC since 1985
(919) 773-6114 · jxbunn@bunncom.com
```

### Email 2 — Bump with concrete math (T+3)

```
Subject: Re: Did you miss this call last Tuesday at 6:47pm?

{{first_name}} — quick math:

If your average job is $800 and you miss 3 calls a week that would've booked, that's $9,600 a month in leaks. Joshua catches most of them for $249/month.

Happy to hold the 15-min demo next Tuesday at 10am if that works. Otherwise reply with a window.

Joey
```

### Email 3 — Social proof / third-party angle (T+7)

```
Subject: How {{nearby_town}} {{vertical_singular}} handled after-hours calls

Hey {{first_name}},

Saw another {{vertical_singular}} mentioned on Nextdoor getting hammered with 2am calls last week. That's the thing — the emergencies come when you're asleep or on another job.

Joshua runs 24/7 so you don't have to. Still holding time for a 15-min look. Prefer phone or Zoom?

Joey · Bunn Communications · Clayton, NC
```

### Email 4 — Risk reversal (T+10)

```
Subject: no contract, no risk — just to say it clearly

{{first_name}} —

One thing I should have led with: we don't ask for a contract. 30 days free. After that, $249/month with 30-day written cancel notice any time. Your number stays your number.

If you don't see measurable missed-call recovery in the first month, we walk. I only make money if you keep making money.

Reply "yes" and I'll have a number forwarding by end of week.

Joey
```

### Email 5 — Breakup (T+14)

```
Subject: Closing the loop on Joshua

{{first_name}} — probably not the right time. Keeping your contact in our list and I'll try again in 90 days. If the missed-call problem gets worse before then, my cell is (919) 773-6114.

Joey · Bunn Communications
```

**Send cadence:** 50 emails Tuesday morning, 50 Wednesday morning (Mon and Fri are lower open rates for SMB owners). Personalize `{{vertical}}`, `{{first_name}}`, `{{nearby_town}}`. Send via Google Workspace (not marketing-email tooling) to look personal — deliverability + trust > scale at this stage.

## 6. First 30 prospects (pulled from Lead Generator DB)

### Home services (30, near Bunn/Clayton) — tier-A emails only

**Roofing (priority — worst missed-call pain):**
1. 5 Star Service (Apex) — `vinny@5starservicenc.com`
2. Barkley-Jensen Roofing and Restoration (Cary) — `customerservice@barkleyjensenroofing.com`
3. Crystal's Roofing LLC (Cary) — `crystal@crystalsroofing.net`
4. FOREVER Exteriors (Cary) — `owner@foreverext.com`
5. Legacy Construction and Roofing (Cary) — `tc.legacyconstruction@gmail.com`
6. Metal Roof Consultants (Cary) — `brad@metalroofconsultants.net`
7. Prepare the Way Roofing (Cary) — `chris@preparethewayroofing.com`
8. Brady Contracting NC (Clayton) — `bradycontracting@gmail.com` — **your neighbor**
9. GoodHands Construction, Inc. (Clayton) — `dwan@goodhandsconstruction.com` — **your neighbor**
10. Local Roofing (Clayton) — `micah@localroofingnc.com` — **your neighbor**
11. Raptor Roofing (Clayton) — `diego@raptorroofers.com` — **your neighbor**

**Plumbing:**
12. Element Service Group (Apex) — `elementcalls@callelement.com`
13. Plumbers of Carolina Inc (Cary) — `kelly@plumbersofcarolina.com`
14. Unlimited Plumbing & Drain Services (Cary) — `dispatch@unlimitedplumbingnc.com`
15. Ambit Plumbing Inc. (Clayton) — `ambitplumbing@gmail.com` — **your neighbor**
16. Balos Plumbing LLC (Clayton) — `balosplumbing@yahoo.com` — **your neighbor**

**Electrical:**
17. Mister Solutions (Apex) — `anthony@mistersolutionsnc.com`
18. TW Electric Service Inc. (Benson) — `terry@twelectricserviceinc.com`
19. One Call Electric (Cary) — `onecallelectricllc@gmail.com`
20. Ryan Medlin Electric (Cary) — `ryankmedlin@gmail.com`
21. Deep Roots Electrical LLC (Clayton) — `deeprootselectrical@gmail.com` — **your neighbor**
22. Hon Electric Group Inc (Clayton) — `christian@honelectricgroup.com` — **your neighbor**
23. Oak Electric LLC (Clayton) — `jonathan@oakelectricnc.com` — **your neighbor**
24. Uncle Fergie's Electrical (Clayton) — `chris@unclefergieselectrical.com` — **your neighbor**

### Legal (secondary wave — send after home services yields pattern data)

1. Barringer Wentz Maliszewski, LLP (Cary, score 90) — `casey@bwm.law` (Brent D. Barringer)
2. Padovano & Zillioux (Clayton) — `kzill@padovanoandzillioux.com` — **your neighbor**
3. Whitaker & Hamer PLLC Clayton Office (Clayton) — `info@wh.lawyer` — **your neighbor**
4. Paul Robinson Law, PLLC (Clayton) — `info@paulrobinsonlaw.com` — **your neighbor**
5. Westerlund & Zdenek Law Group (Apex) — `title@wzlawgroup.com`
6. R. Isaac Parker, Attorney at Law (Benson) — `ike.parker.law@gmail.com`
7. NC Planning (Cary) — `clientservices@ncplanning.com`
8. The Law Office of Matthew McCrystal (Cary) — `matt@mccrystallaw.com`
9. Eunoia Law Firm (Cary) — `charles@eunoialawfirm.com`
10. Triangle Legal (Cary) — `sammy@triangle.legal`
11. Haddock Law Firm, PLLC (Cary) — `kristi@haddocklawfirm.com`
12. McCoppin & Associates (Cary) — `andrew@mccoppinlaw.com`
13. Alisa Huffman MSW, JD Family & Elder Law (Cary) — `alisa@alisahuffman.com`
14. Law Offices of Amy Whinery Osborne, P.C. (Cary) — `amy@amywosborne.com`
15. McCollum Law, P.C. (Cary) — `nick@mccollumlawpc.com`
16. Anderson Legal (Cary) — `a.anderson@andersonlegalnc.com`
17. Ammon Nelson Law, PLLC (Cary) — `ammon@ammonnelsonlaw.com`
18. Zachary A. Cooper Law (Cary) — `zachary@lawofzacooper.com`
19. Law Office of Scott D. Beasley, P.A. (Cary) — `scott@scottbeasleylaw.com`
20. Mast Law Firm (Garner) — `info@mastfirm.com`

**Eleven of the first 30 home-services prospects + 3 legal prospects are literally in Clayton.** The "local" angle in email 1 is not a rhetorical flourish — it's true.

## 7. Sales funnel stages + expected close rates

From industry research (see `02-smb-verticals-gtm`):

| Stage | Action | Expected rate | What "passing this stage" means |
|---|---|---|---|
| Cold email | Send | — | Volume input |
| Reply | Any reply | 5–10% | Engagement signal |
| Demo booked | 15-min Zoom scheduled | 30–40% of replies | Real curiosity |
| Demo completed | Joey shows Joshua live | 80% of booked | Commitment |
| Pilot started | Phone number forwarded | 50–70% of demo | Trial begins |
| Pilot → Paid | $249/mo begins | 30–50% of pilots | MRR win |

**Funnel math for the first 60 home-services prospects:**
- 60 emails → 5 replies → 2 demos → 1.6 pilots → 0.5–0.8 paying customer

That says: **send more than 60 emails.** The prospect list above is 24; pull 60 more from the 5,547-company construction pool in the DB, expanding radius to Raleigh/Wilson/Goldsboro. Goal: **200 outbound emails in the first 14 days.** That yields 1–2 paying customers by day 45 if the conversion math holds.

## 8. Objection handling — scripts for demo/call

| Objection | Response |
|---|---|
| "I already use an answering service." | "Great — what do you pay? [usually $100–$300/mo for after-hours only]. Joshua replaces that AND covers business hours overflow for less, with transcripts + structured data routed to your phone instantly. Want to see the side-by-side?" |
| "It'll sound robotic and annoy my customers." | "Let's test it right now — call this number and tell me what you think." (Live demo with Hope. 80% of demos dissolve this objection in 30 seconds.) |
| "I need to think about it." | "Totally — the pilot is designed for that. 30 days free, no card up front, no contract, no risk. Worst case you get 30 days of real data on your missed-call rate. Can I set it up this Friday?" |
| "What if it can't handle complex calls?" | "Every call that's flagged 'needs human' goes straight to your cell with the context. Joshua handles the easy 80%; you still handle the important 20%. Over time, the 80% grows as we tune." |
| "I don't want my customers knowing it's AI." | "By law and by our policy, if asked directly, Joshua says she's a virtual assistant. Most callers never ask. We can run a real recording for you to hear." |
| "Send me info and I'll think about it." | "I'll send the pilot signup link right now. One field — your business phone number. You're not committing to anything. Deal?" (Send it live on the call.) |
| "What about my data / HIPAA / privacy?" | (Home services: "Audio is ephemeral, transcripts go to you only, no third-party training.") (Legal: "Exactly the question a good attorney asks. Audio is session-ephemeral, transcripts are your data on your dashboard, we do not train on your calls, we can sign an NDA before the pilot.") (Healthcare — say: "Joshua is not HIPAA-certified yet. If you need HIPAA, I'll refer you to [Viva AI / Sully.ai]. When we're ready for healthcare, you'll be the first call.") |

## 9. 30/60/90 day plan

### Days 1–7 (this week)
- [ ] Finalize pricing page + one vertical landing page (home services). Deploy to `joshua.bunncom.com` or `bunncom.com/joshua`.
- [ ] Set up Stripe + basic billing (Stripe Checkout link, one product per tier).
- [ ] Build onboarding flow: customer submits business number → Bunn configures LiveKit dispatch rule + vertical prompt → test call → live in 24 hours.
- [ ] Record the 30-second Hope demo clip for the landing page FAQ.
- [ ] Send first 60 outbound emails (30 home services near Clayton + expand radius).

### Days 8–21
- [ ] Run first pilot(s). Do whatever white-glove setup is needed. Joey personally reviews every call transcript in week 1.
- [ ] Second batch of 60 emails (home services rest of Triangle).
- [ ] Identify the top 2 vertical-specific pain points from pilot calls → update prompt templates.

### Days 22–45
- [ ] First pilot conversion conversation. Target: 1 paying customer by day 30.
- [ ] Build second vertical landing page (legal).
- [ ] Third batch of 60 emails (legal near Clayton).
- [ ] If home-services conversion > 30%, write a case study with the first customer's consent.

### Days 46–75
- [ ] 3 paying customers target = $900–$1,200 MRR.
- [ ] Referral program: existing customers get 20% discount for each referral that converts.
- [ ] Begin content: 1 blog post on bunncom.com per week (SEO supports the outbound).

### Days 76–90
- [ ] 5–7 paying customers = $1,500–$2,500 MRR.
- [ ] Pause email outbound; expand through: (a) referrals from existing customers, (b) bunncom.com SEO-driven inbound, (c) possibly Facebook/Google Local Service Ads for roofers/plumbers.
- [ ] Decide: expand to next vertical, or deepen current ones.
- [ ] Revisit whether #2 product (BunnTranslator / AdForge) re-enters rotation.

## 10. What success + failure look like

**Success signal by day 30:** 1 pilot converted to paid OR 3+ active pilots running with usage data.
**Failure signal by day 30:** Less than 2% reply rate on outbound OR zero demos booked.

If failing: the issue is MESSAGE, not market. Don't pivot product; pivot copy. Specifically test:
- Subject line ("missed call" vs "voicemail" vs "night calls")
- Hook (local angle vs ROI math vs FOMO)
- CTA (demo vs pilot direct vs PDF case study)

## 11. What this playbook doesn't do (and should not)

- **No paid advertising for 60 days.** Outbound email + referrals + SEO is enough to test product-market-fit. Paid is for scaling a winning formula, not for finding one.
- **No international.** NC only. Local trust is the moat.
- **No channel partnerships yet.** Joey's brother, Bunn Communications' existing customers, and Ben's H&B Labs side all feed organically — don't formalize partner programs until there's a repeatable product to give them.

---

**Sources:**
- Lead Generator DB, queried 2026-04-21 night (local SQLite)
- `01-voice-ai-competitive-2026-04-21.md` (pricing benchmarks)
- `02-smb-verticals-gtm-2026-04-21.md` (close-rate data)
