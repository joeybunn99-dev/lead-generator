# Monday Quickstart — 5 things to do Monday morning

Read this first. The longer strategy memo (`STRATEGY-2026-04-21.md`) justifies everything here — but if you only have 5 minutes, do these five things and you're already shipping today.

## 1. Reboot + verify your environment is green (5 min)

```bash
# after reboot:
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\jlb2s\Documents\BunnTranslator\tools\check-mic.ps1"
node "C:\Users\jlb2s\Documents\bunn-status\bunn-status.js"
```

- `check-mic.ps1` must report PASS before you open BunnTranslator (max_volume > -50 dB).
- `bunn-status` will likely show **Joshua=RED** because the worker process doesn't survive a reboot. That's expected — restart it:
  ```bash
  cd "C:\Users\jlb2s\Documents\Joshua" && node worker.js start &
  ```
  Then re-run `bunn-status` — should be GREEN.

## 2. Read the strategy memo (10 min)

Open **`STRATEGY-2026-04-21.md`** in the same folder. It answers:
- Which 2 things to focus on (Joshua + its distribution flywheel)
- How MRR happens in 90 days (home services at $249–$399/mo)
- What prevents another day like 2026-04-20 (the tools from step 1)

It ends with 5 open questions. Answer them — in your head or in a reply — before doing step 3.

## 3. Send 5 personalized emails before lunch (30 min)

Open **`06-ready-to-send-emails-2026-04-21.md`**. The first 5 emails are Clayton neighbors — Brady Contracting, Ambit Plumbing, Deep Roots Electrical, Hon Electric, Local Roofing. Review each draft, tweak anything that rings wrong, paste into Gmail (`jxbunn@bunncom.com`), send.

**That's it for send-volume today.** 5 emails, not 50. Today is about proving the motion works, not blasting the list. Wednesday you send the next 5.

## 4. Deploy the landing page (30–60 min)

Open **`07-joshua-landing-page-draft.html`**. Replace three placeholders:
- `{{CALENDLY_LINK}}` — set up a 15-min slot Calendly link if you don't have one
- `{{STRIPE_PILOT_LINK}}` — Stripe Checkout link with 30-day free pilot (or just route to the Calendly for now and build Stripe in week 2)
- `{{HOPE_DEMO_AUDIO_URL}}` — record a 30-second demo of Hope speaking a greeting, upload as MP3, link it

Drop the file into `C:\Users\jlb2s\Documents\BunnComm-Redesign\public-v3\joshua\index.html` — scp to VPS — pm2 restart bunncomm. Live at `bunncom.com/joshua/`.

## 5. Set up the daily health habit (2 min)

Every morning before opening any product, before any customer call, before any demo:

```bash
node "C:\Users\jlb2s\Documents\bunn-status\bunn-status.js"
```

If GREEN, you're safe. If RED, the tool names the broken service and the recovery step. No more "everything looked fine until I walked into the demo."

Add it to your Windows Startup folder or a keyboard shortcut if you want it literally one-click.

## That's the day

If you do these 5 things, by end of Monday:
- Environment is green
- Strategy is loaded
- 5 cold emails are out
- Landing page is live
- Daily-health habit is running

Nothing else is required. The GTM playbook (`04-`) has what to do next. The rest of the bundle answers questions as they come up.

**Resist the urge to do more today.** Focus is the entire point of this rework. Five small things shipped beats ten half-shipped things every time.

---

**If you disagree with any of this:** reply to me with which part. I scored + drafted this for you based on 2 hours of research + 18 months of your project memory, but this is your business and your life and your call. I'd rather we have a real argument about Joshua-vs-BunnTranslator than execute a plan you're not bought into.

**If you're already energized and want more:** the hardest thing you can do tomorrow for your long-term success is NOT do more. Do these five, then close the laptop and go outside. The 90-day plan is a MARATHON. Don't burn week 1 trying to be a hero.
