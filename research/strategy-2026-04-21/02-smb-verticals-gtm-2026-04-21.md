# SMB Verticals + GTM Patterns — 2026-04-21

## The Lead Generator database is your unfair advantage

Most voice-AI resellers start with zero prospect data and a LinkedIn scraper. You have **20,167 NC companies pre-crawled, 18,805 contacts with emails, proximity-sorted closest-to-Bunn-NC**, already in SQLite. This is an 18-month head start that almost nobody else in the voice-AI reseller race has.

**Actual DB composition (queried 2026-04-21 night):**

| Industry | Total | With email | Tier-A emails | Notes |
|---|---|---|---|---|
| Construction | 5,547 | 4,761 | 2,852 | Breaks down below |
| Manufacturing | 4,466 | — | — | Not voice-AI fit (B2B manufacturing, no intake calls) |
| Technology/IT | 3,564 | — | — | Not fit (tech buyers don't pay for AI receptionist) |
| **Real Estate** | **1,919** | **1,192** | — | **Fit — agents miss calls = lose deals** |
| **Legal** | **1,741** | **1,191** | 816 | **Fit — intake call = $500–$5k case** |
| **Accounting** | **1,734** | — | 645 | **Fit — tax-season overflow pain** |
| Marketing | 939 | — | — | Agencies — could be distribution partner not customer |
| Consulting | 710 | — | — | Varies |
| Automotive | 590 | — | — | Dealer service bays miss calls = lost revenue |

**Construction subtypes (voice-AI fit for missed-call home services):**

| Subtype | Total | Tier-A emails |
|---|---|---|
| General contractor | 2,692 | 1,379 |
| Roofing contractor | 871 | 330 |
| Plumber | 694 | 189 |
| Electrician | 613 | 233 |
| Other construction | 677 | 721 |

## The four best verticals for Joshua, ranked

### #1 — Home services (roofing / plumbing / electrical / HVAC-via-generic-GCs)

**Why it's #1:**
- Worst missed-call economics in SMB: emergency plumber call at 2am → next plumber gets the job. One missed call = $500–$2,000 in foregone revenue.
- Solo operators and 5-person shops can't afford a human 24/7 answering service.
- Decision-maker is the owner-operator → short sales cycle, no committee.
- Zero regulatory overhead (not HIPAA, not TCPA-restricted for inbound).
- **Your Lead Generator DB has ~2,700 roofers/plumbers/electricians in NC with emails. Tier-A: ~750.**

**Price point:** $249–$399/month recurring per business.
**Pitch:** "One captured emergency call pays for six months of service."
**Objections you'll hear:** "I already use an answering service" (positioning: AI answers at 2am without a live agent fee); "It sounds robotic" (demo with your current Hope voice).
**ROI math customer sees:** Miss rate of 25% × 20 calls/day × avg $800 job = $4,000/week in missed revenue → a $299/month service that captures half of that is a no-brainer.

### #2 — Legal intake (small firms, family/injury/real-estate)

**Why it's #2:**
- Law firm intake call = $500 to $5,000+ in potential fees depending on case type.
- Attorneys physically can't answer phones during court / client meetings.
- Intake quality matters — qualification questions, scheduling, conflict checks — all scriptable.
- **Lead Generator has 1,741 NC law firms with 816 tier-A emails and 350 tier-B.**

**Price point:** $399–$699/month per firm (legal tolerates higher prices because one captured case = 10× ROI).
**Pitch:** "Your intake is your front door. AI closes it 24/7."
**Objections:** "Attorney-client privilege" (use session-ephemeral audio, no retention, log only structured intake data); "We need to do the intake ourselves" (position as qualification + scheduling, not substantive intake).
**Geography:** **14 law firms are in Clayton or direct-radius (Wendell/Knightdale/Garner/Zebulon). That's the Bunn-walk-in territory.** Named examples from DB: *Whitaker & Hamer (Clayton), Paul Robinson Law (Clayton), Padovano & Zillioux (Clayton), Mast Law Firm (Garner), Sterling Law (Clayton branch).* Cold email to these firms, name-drop "Clayton-based" / "Bunn Communications" for local trust.

### #3 — Real estate agent/brokerage front desk

**Why it's #3 (not higher):**
- Missed call = lost listing or buyer inquiry, so ROI math is similar to home services.
- BUT: most agents are 1099, already use cellphone + voicemail + IG DMs. Hard to sell to solo agents.
- The real customer is the brokerage manager (Keller Williams / RE/MAX office) — each manages 20–100 agents.
- Brokerages are harder to close than solo shops (committee, corporate brand guidelines, etc.).
- **Lead Generator has 1,919 real estate orgs, 1,192 contactable.**

**Price point:** $499–$999/month for brokerage "after-hours intake + round-robin to agent cellphones".
**Deferred — revisit after #1 and #2 have 5+ customers each.**

### #4 — Accounting (tax-season overflow)

**Why it's an option:**
- Tax season (Jan–Apr) CPAs drown in calls. Voice AI triages "I have a W-2 question" vs "I need a new engagement letter."
- Off-season, the value drops by 70%. That's seasonality risk in pricing.
- **DB has 1,734 NC accounting firms, 645 tier-A.**

**Price point:** $199–$399/month with a higher-tier seasonal surge option. Seasonal product = hard to sell.
**Deferred.**

### What's NOT on the list (and why)

- **Dental / optometry / healthcare:** Everyone else is already there (Viva AI, Sully.ai, every vertical vendor). HIPAA is a hard precondition Joshua doesn't formally have yet. You'd have to build BAAs + SOC 2 Type II before your first customer conversation. Save for year 2 when Bunn has infrastructure and case studies.
- **Restaurants:** High call volume, low value per call, owner-operators don't pay subscriptions. Bad unit economics.
- **Retail:** Foot-traffic business, phone is peripheral. Bad fit.

## The sales motion that actually works

From 2026 SMB voice-AI agency reports ([Aloware](https://aloware.com/blog/best-ai-voice-agents-complete-guide-for-smbs), [MarketingProfs](https://www.marketingprofs.com/articles/2025/53949/voice-ai-smb-marketers-cx-roi), [Resonate](https://www.resonateapp.com/resources/ai-receptionists-statistics)):

### What works

- **Geographic / local-business outbound.** SMBs buy from vendors with local presence. "Bunn Communications, Clayton NC" beats "some startup in San Francisco" every time for a Raleigh roofer.
- **Free pilot → paid conversion.** Offer 30 days free, capture real calls, show the owner the transcripts + missed-call recovery revenue in dollars, convert at 40%+.
- **Referral from existing Bunn Communications customers.** You have telecom/IT customers since 1985. Those relationships are distribution.
- **Industry-specific landing pages.** One landing page per vertical (roofer.bunncom.com / lawyer.bunncom.com) beats a generic /joshua page every time.
- **The "one-captured-appointment-pays-for-it" frame.** Lower the perceived risk of the subscription.

### What doesn't work

- **Cold outbound AI calling.** FCC treats AI voices as prerecorded robocalls under TCPA → requires prior express written consent. Don't use Joshua to prospect Joshua customers. Email + LinkedIn + referrals.
- **Competing on features.** Retell has more features. You have local presence.
- **Selling to businesses that already have good human reception.** They don't care. Sell to businesses that chronically miss calls.
- **Long sales cycles.** SMB owners decide in 1–3 conversations. If you're 5 calls in without a signed contract, move on.

### Close rates to expect

From industry reports:
- Cold email → demo booked: **2–5%** (send 1,000 → get 20–50 demos)
- Demo → free pilot: **40–60%** (SMB owners who take a demo are curious)
- Free pilot → paid: **30–50%** if the pilot captures measurable missed-call revenue
- **Math:** 1,000 emails → 30 demos → 15 pilots → 5 paying customers. At $299/month × 5 = $1,495 MRR per 1,000 emails sent.

Scale that to the 2,700 roofers/plumbers/electricians in your DB: **potential early MRR ceiling of ~$4,000/month from just home services in NC** if you burn through the list once. Not life-changing, but real recurring revenue with high retention.

## Concrete first-30-prospect list (preview for GTM playbook)

Pulled from Lead Generator DB — highest-scored tier-A legal prospects near Clayton:

| City | Firm | Email | Notes |
|---|---|---|---|
| Clayton | Whitaker & Hamer PLLC | info@wh.lawyer | tier B (generic inbox) but in Clayton |
| Clayton | Paul Robinson Law | info@paulrobinsonlaw.com | tier B, Clayton |
| Clayton | Padovano & Zillioux | kzill@padovanoandzillioux.com | tier A, named contact |
| Clayton | Sterling Law | orders.clayton@sterlingclosings.com | real-estate closings, high-volume |
| Garner | Mast Law Firm | info@mastfirm.com | tier B |
| Cary | Barringer Wentz Maliszewski | casey@bwm.law | tier A, score 90, named contact |

**Full 30-prospect list with email templates → see `03-gtm-playbook-2026-04-21.md` (next doc).**

## Key takeaway for the strategy memo

**Joshua's competitive problem is not tech — it's distribution.** Lead Generator solves distribution if you focus it. The 2,700 home-services prospects in NC are your 90-day outreach universe. You don't need VC funding; you need focus + a weekly cadence.

---

**Sources cited:**
- [AI Receptionists Stats (Resonate)](https://www.resonateapp.com/resources/ai-receptionists-statistics)
- [Best AI Voice Agents SMB (Aloware)](https://aloware.com/blog/best-ai-voice-agents-complete-guide-for-smbs)
- [Voice AI SMB ROI (MarketingProfs)](https://www.marketingprofs.com/articles/2025/53949/voice-ai-smb-marketers-cx-roi)
- [Voice AI Market 2026 (Famulor)](https://www.famulor.io/blog/voice-ai-market-2026-the-billion-dollar-white-label-and-partner-opportunity-for-agencies)
- Lead Generator DB query results 2026-04-21 (local)
