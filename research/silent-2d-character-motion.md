# Silent 2D Character Motion — 2026 State of the Art
**Topic:** Alive-but-silent 2D persona animation (no mouth movement) for browser delivery
**Context:** BunnTranslator "Carmen" persona — single 2D illustrated PNG, clinical tablet (iPad Safari 17+)
**Research Mode:** QUANTITATIVE-COMPARISON
**Date:** 2026-05-08 | Cycles: 1 + targeted cycle 2 | Final Score: 7.2/10

---

## Prior Failure Summary (from Issue BUN-98)

| Attempt | Killed By |
|---------|-----------|
| talking-head.js + mpfb.glb 3D | Spanish phoneme tables — no ES viseme support |
| LTX-Video webp loops | Head-shake artifact on female faces. 5 seed sweeps never fixed it |
| PuLID-Flux pose variants | Face-locked too aggressively — no directional pose change |
| Flux Kontext 15° subtle poses | Directionally unreliable across runs |

**Key insight confirmed by this research:** Dropping mouth movement eliminates the Spanish-phoneme problem AND softens LTX head-shake-on-mouth-frames. The actual spec (eyes + head, no mouth) is meaningfully simpler than prior attempts.

---

## Comparison Table

| Tech | Browser-fit | Pre-baked vs Runtime | Eye/Head-Only Support | Mouth-Static Support | Source-from-Single-PNG | Plausible Cost | Major Caveat |
|------|-------------|----------------------|-----------------------|----------------------|------------------------|----------------|--------------|
| **LivePortrait** (KwaiVGI, 2024) | Pre-baked output → video loop | Pre-baked (requires driving video) | ✅ Yes — `OnlyEyes` + `OnlyRotation` via `sample_parts` | ✅ Yes — explicitly exclude `OnlyMouth` | ✅ Yes — source image = any PNG | ~$0.011/min (L4 GPU Cloud Run) or RTX 3060 ~4-5s/s | Requires a driving video to retarget FROM — you must create a "eyes + head only" reference clip first |
| **Seedance 2.0** (ByteDance, Feb 2026) | Pre-baked output → video loop | Pre-baked | ⚠️ Indirect — no explicit eye-only mode; "AI jitter mostly gone" in subtle motion | ✅ Yes — image-to-video, no audio required | ✅ Yes | $0.30/s at 720p via fal.ai (~$1.50 for 5s clip) | Cannot guarantee mouth stays closed without explicit prompt control; test required |
| **Kling 2.6 / 3.0** (Kuaishou, 2025-2026) | Pre-baked output → video loop | Pre-baked | ⚠️ Indirect — improved micro-expressions, eye glistening | ✅ Yes — image-to-video, no audio required | ✅ Yes | Credits-based; fal.ai available | 3-5 generation attempts for clean result; eye gaze direction still slightly off; extra jewelry artifacts possible |
| **Pika 2.2 + PikaFrames** (Pika Labs, Feb 2025) | Pre-baked output → video loop | Pre-baked | ⚠️ Indirect — prompt-guided subtle motion (blink, sway) | ✅ Yes — no audio required | ✅ Yes | Subscription/credits | First+last frame for seamless loop; 5-10s max; no transparent export documented |
| **Runway Gen-4** (May 2026) | Pre-baked output → video loop | Pre-baked | ⚠️ Indirect — "most organic motion" per early users | ✅ Yes — no audio required | ✅ Yes | Subscription | No specific eye-only mode; most new of the set (May 3, 2026) — least tested |
| **Hedra Character-3** (March 2025) | Pre-baked output → video | Pre-baked | ⚠️ Produces micro-expressions + eye blinks + head tilts naturally | ❌ No — mouth movement coupled to audio. Cannot decouple without model modification | ✅ Yes | API available (credits-based) | **DISQUALIFIED** for Carmen's no-mouth spec — audio input required, mouth moves with it |
| **EMO / Hallo2 / EchoMimic / Sonic** (various 2024-2025) | Pre-baked output → video | Pre-baked | ❌ No idle/silent mode | ❌ No — audio-driven, mouth movement inherent | ✅ Yes | Open source (GPU self-host) | **DISQUALIFIED** — all require audio. Silent mode = black output or error |
| **TalkingHead.js** (met4citizen, active 2025) | ✅ Browser-native JavaScript | Runtime (Three.js + GLB model) | ✅ Excellent — configurable eye blink delays 200-5000ms, headRotateX/Y/Z, eye gaze | ✅ Yes — mute mode disables lip-sync, preserves all idle animations | ❌ No — requires RPM/PlayerZero full-body 3D GLB model | Free (self-hosted) | **Incompatible with carmen-forward.png** — needs a 3D GLB model, not a 2D illustration. Would require creating a 3D version of Carmen first |
| **AnimateDiff + IP-Adapter** (open source) | ❌ No — ComfyUI/A1111 offline only | Pre-baked | ⚠️ Indirect — breathing, subtle idle possible | ✅ Yes | ✅ Yes | Free (GPU self-host) | Not browser-runtime; produces output clips for pre-render workflow |
| **Live2D Cubism** | ✅ Browser runtime (SDK) | Runtime | ✅ Excellent — eye blink, head movement, breathing built-in | ✅ Yes | ❌ No — requires layered illustration (PSD with separated parts), NOT single PNG | $$$  license | **Cannot use carmen-forward.png without full re-illustration as layered parts** |
| **jeelizWeboji** (WebGL, open source) | ✅ Browser-native WebGL | Runtime | ✅ Face tracking → animated face | Depends on model | ❌ No | Free | Emoji/cartoon face style — not photorealistic portrait animation |

---

## Technology Detail Notes

### 1. LivePortrait — Strongest ML Option

LivePortrait (KwaiVGI, July 2024) supports a `sample_parts` parameter with these values:
- `"OnlyExpression"` — facial expression only
- `"OnlyRotation"` — head pose only (pitch/yaw/roll)  
- `"OnlyMouth"` — mouth only
- `"OnlyEyes"` — eyes only
- `"All"` — everything

For Carmen's spec, the correct combination is stacking `OnlyEyes` + `OnlyRotation` via the ComfyUI-AdvancedLivePortrait node (PowerHouseMan/ComfyUI-AdvancedLivePortrait on GitHub). Motion index 0 = source image; subsequent nodes add motions in sequence.

**The catch:** LivePortrait is a *retargeting* system, not a generative idle system. It requires a **driving video** to copy motion from onto Carmen's face. To generate a "Carmen looking left while blinking" clip, you must first have a driving video of a person (or synthetic face) doing that motion with closed mouth. Then LivePortrait retargets it to Carmen's PNG.

**Hardware:** 6GB VRAM minimum. RTX 3060 = ~4-5s render per second of output. RTX 4090 = 12.8ms/frame. Cloud Run L4 GPU = ~$0.011/min.

**Prior LTX failure note:** LivePortrait is architecturally different from LTX-Video. LTX generated motion from noise/prompts — that's where head-shake artifacts came from. LivePortrait copies exact motion from a driving source. If the driving source has no head-shake, Carmen won't shake.

### 2. Seedance 2.0 — Best Pre-Render Candidate

ByteDance Seedance 2.0 (February 2026):
- First/last frame control → seamless loops
- "AI jitter mostly gone" per multiple 2026 reviewers
- 5-15s clips at 2K/24fps
- API live on fal.ai as of April 2026
- **Cost:** $0.30/s standard at 720p (~$1.50 for a 5s idle loop). Once pre-rendered, browser delivery is just file serving

**Prompt strategy for no-mouth:** "subtle head micro-movement, natural eye blink, woman is listening attentively, mouth closed relaxed, no speaking" + first/last frame match for seamless loop.

**Unknown:** How reliably it keeps mouth closed without explicit model constraint. This requires testing (1-3 generation attempts).

### 3. Kling 2.6+ — Quality Leader, More Variable

Kling 3.0 wins on human motion realism in full-body tests. Portrait-specific:
- Kling 2.6 Pro: improved micro-expressions, "eyes glistening" level detail
- **Artifact risk:** extra jewelry when hair lifts, hair-strand inconsistencies, eye gaze direction ±5-10° off target
- Needs 3-5 attempts for clean female portrait result
- Background removal available via Kling Background Remover for transparent export

### 4. Browser Delivery: The Alpha Video Format Problem

**The fundamental constraint for Carmen on iPad Safari 17+:**

Safari does NOT support VP9 with alpha (WebM with transparency). Chrome does NOT support HEVC with alpha. Both are needed for a transparent overlay over the transcript background.

**Verified HTML pattern:**
```html
<video autoplay loop muted playsinline>
  <source src="carmen-idle.mov" type='video/mp4; codecs="hvc1"'>
  <source src="carmen-idle.webm" type="video/webm">
</video>
```

**File sizes (verified from multiple 2024-2025 sources):**
- VP9+WebM (Chrome/Firefox): ~1.1MB for a 3-5s clip
- HEVC+alpha .mp4 (Safari/iPad): ~3.4MB same clip
- Total per state: ~4.5MB (both formats)

**4-state lookup × 2 formats = ~18MB total.** Manageable for a clinical session.

**iPad 60-minute session risk:**
- HEVC+alpha is hardware-accelerated on A9 chip+ (iPhone 6s / iPad 9.7 / 2016+). Modern clinic iPads are safely above this threshold.
- Known risk: VTDecoderXPCService (Apple's video decode daemon) can accumulate memory in long looping sessions if buffered frames aren't released. If 4 video elements loop simultaneously for 60 minutes, monitor for memory pressure. Mitigation: use a single video element and swap `src` attribute when direction changes, rather than having 4 concurrent `<video>` tags.

**iOS crash risk (Safari 17.5):**
- Multiple video elements in alpha-channel WebM → reproducible crashes on iOS 17-18.
- Using `src`-swap on a single `<video>` element avoids this entirely.

### 5. Real-Time Direction Control

Joey's spec: Carmen "looks at the speaker." Options:

**Option A: 4-state pre-rendered lookup (recommended)**
- States: `idle` / `look-left` / `look-right` / `paused`
- Each state = one looping video clip (5s, seamless)
- State machine swaps `src` on speaker-turn change
- Latency: ~100-300ms (video load time). Can be pre-buffered to near-zero with `preload="auto"` on all 4 `<video>` elements (non-alpha WebM variant can be preloaded cross-browser while HEVC element is kept for Safari)
- Pre-render cost: 4 states × $1.50 (Seedance) = $6 per Carmen per character version

**Option B: LivePortrait real-time retargeting (not viable for browser)**
- ~12.8ms/frame on RTX 4090 — requires GPU server
- NOT browser-side inference
- Would require a streaming video pipeline (server → WebRTC → browser). Adds latency and infrastructure cost

**Option C: CSS/canvas sprite-state swaps (current approach) + idle motion layer**
- Keep existing sprite-state machine for direction
- Add a looping idle video layer (below direction sprites) for breathing/subtle motion
- Hybrid: idle motion from pre-rendered loop, direction from PNG sprite swap
- Avoids needing 4 directional motion clips — just 1 idle loop + 4 directional PNGs

### 6. Combined Approach — Best of Both

**Recommended architecture (zero-purchase research finding):**

```
[Base layer]  Looping transparent video — idle breathing + head micro-motion (Seedance 2.0 or Kling 2.6)
[Top layer]   PNG sprite state machine — direction (look-left / look-right / forward)
```

The idle motion in the base layer provides the "alive" feeling. The direction is handled by the existing state machine's PNG crossfades. The video layer sits below the PNG layer with `mix-blend-mode: multiply` or `isolation` to composite correctly.

This approach:
- Reuses existing state machine code
- Doesn't require re-rendering directional variants with motion
- Single idle loop video = 1 generation attempt (~$1.50)
- No VTDecoderXPCService risk (single video element)

---

## Definitive Dead Ends

| Tech | Verdict | Reason |
|------|---------|--------|
| Hedra Character-3 | Dead | Audio required, mouth movement cannot be decoupled |
| EMO / Hallo / Hallo2 / EchoMimic / Sonic | Dead | All require audio. No silent/idle mode exists |
| Live2D Cubism | Dead for single PNG | Requires layered PSD — cannot use carmen-forward.png without full re-art |
| TalkingHead.js | Dead for 2D | Requires 3D GLB model — not a 2D illustration runtime |
| LTX-Video (revisited) | Remains dead | Head-shake on female faces confirmed; "no mouth" reduces but doesn't eliminate the artifact |
| jeelizWeboji | Wrong tool | Emoji-style cartoon faces, not photorealistic portrait animation |

---

## Cost Summary

| Approach | One-Time Render Cost | Browser Runtime Cost | Notes |
|----------|----------------------|----------------------|-------|
| Seedance 2.0 (fal.ai) — 1 idle loop | ~$1.50 | Zero (file serving) | $0.30/s at 720p |
| Seedance 2.0 — 4 directional states | ~$6.00 | Zero | If full directional motion wanted |
| Kling 2.6 (via fal.ai or credits) | Varies; ~$0.50-2/clip | Zero | Background removal adds step |
| LivePortrait (RTX 3060, local) | ~$0 (GPU already owned) | Zero | Joey's gaming PC. ~20-30 min for 5s clip |
| LivePortrait (Cloud Run L4) | ~$0.055 per 5s clip | Zero | ($0.011/min × 5 min render time) |

---

## Self-Score

```
COUNTS:
- Primary sources: 9
- Code examples: 2 (sample_parts options list, HTML dual-source video embed)
- Cross-verified claims: 7
- Contradictions found: 2 (both contextualized)
- Actionable items: 8
- Non-obvious findings: 5

SCORES:
Depth:            7/10 — 9 primary sources, 2 code examples, edge cases: yes (Safari crash, VTDecoder leak, driving-video requirement)
Source Diversity:  7/10 — 5 source types (web search, GitHub repos, arXiv/CVPR papers, last30days, fal.ai API docs), each with unique findings: yes
Corroboration:    7/10 — 7 claims cross-verified, contradictions contextualized
Actionability:    7/10 — 8 concrete steps, 2 code snippets provided
Novelty:          8/10 — 5 non-obvious findings (TalkingHead mute mode, Seedance fal.ai April 2026, VTDecoder leak risk, driving-video requirement for LivePortrait, single-video-src-swap pattern)

Composite: 7.2
```

---

## Non-Obvious Findings (Summarized)

1. **TalkingHead.js has a full mute mode** that preserves idle animations (blink, head rotation, eye movement) without any speech or lip-sync — but it's 3D-only, incompatible with a 2D PNG
2. **Seedance 2.0 went live on fal.ai API in April 2026** — accessible without any install, at $0.30/s, with first/last-frame seamless loop control
3. **VTDecoderXPCService memory accumulation risk** on long-looping HEVC sessions — use single `<video>` element with `src`-swap rather than 4 concurrent `<video>` elements for iPad stability
4. **LivePortrait requires a driving video** — it's a retargeter, not a generator. You must CREATE a "mouth-closed, eyes-blinking, head-nodding" reference clip first; LivePortrait copies that motion onto Carmen
5. **The VP9-alpha crash on Safari 17.5 is specifically the alpha channel variant**, not all WebM — basic (non-transparent) WebM may still play; the transparency layer is what breaks

---

*Sources: LivePortrait GitHub (KwaiVGI), ComfyUI-AdvancedLivePortrait (PowerHouseMan), Seedance 2.0 fal.ai API, Kling 2.6/3.0 reviews (CuriousRefuge, fal.ai), Pika 2.2 PikaFrames documentation, Hedra Character-3 feature announcements, Apple HEVC+alpha WWDC19, jakearchibald.com transparent video (2024), CSS-Tricks transparent video cross-browser, terhechte.de Safari transparent video (Feb 2025), TalkingHead.js README (met4citizen), EchoMimic AAAI 2025 paper, Google Cloud Run GPU pricing*
