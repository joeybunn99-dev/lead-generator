# AI Video Ad Generation Research Report
## March 2026 - Comprehensive Analysis

**Goal:** Professional 15-30 second video ads with stock footage, text overlays, music, end cards. NO talking heads/avatars. Minimal effort. Minimal cost.

---

## Table of Contents
1. [AI Video Platforms (SaaS)](#1-ai-video-platforms-saas)
2. [AI Text-to-Video Models (Cutting Edge)](#2-ai-text-to-video-models)
3. [Free / Open Source Video Tools](#3-free--open-source-video-tools)
4. [Stock Footage Sources](#4-stock-footage-sources)
5. [Free Music / Audio](#5-free-music--audio)
6. [Programmatic Ad Generation](#6-programmatic-ad-generation)
7. [The "Build Our Own" Option](#7-the-build-our-own-option)
8. [Hybrid Approaches](#8-hybrid-approaches)
9. [Recommendations by Strategy](#9-recommendations-by-strategy)
10. [Recommended Stack](#10-recommended-stack)

---

## 1. AI Video Platforms (SaaS)

### InVideo AI
- **Pricing:** Free (2 min/wk, watermark) | Plus $20/mo (50 min AI gen) | Max $48/mo (200 min AI gen) | Generative $96/mo (15 min generative + 4K)
- **Quality:** 7/10 - Good templates, decent stock footage matching
- **Ease of Use:** 9/10 - Text prompt to video, very easy
- **Talking Heads Required?** No - fully supports text/stock footage style
- **API:** No public API
- **Verdict:** You already know this one. Burns credits fast. $20/mo gets you 50 minutes of AI generation which is ~100 short ads. Decent but expensive at scale.

### Synthesia
- **Pricing:** Free (3 min/mo) | Starter $18/mo | Creator $64/mo | Enterprise custom
- **Quality:** 8/10 for avatars, 5/10 for non-avatar videos
- **Ease of Use:** 7/10
- **Talking Heads Required?** Primarily designed for avatar videos. CAN do text/stock footage but it's not the focus - feels like an afterthought
- **API:** Yes (Enterprise)
- **Verdict:** SKIP. Wrong tool for the job. Built for AI presenters, not ad-style videos.

### Pictory AI
- **Pricing:** Starter $25/mo (200 min) | Professional $35/mo (600 min, 18M stock assets) | Teams $119/mo
- **Quality:** 7/10 - Good at script-to-video, auto-selects stock footage
- **Ease of Use:** 8/10 - Paste text, get video
- **Talking Heads Required?** No - designed for text/stock footage videos
- **API:** No
- **Free Trial:** 14 days, 3 full projects
- **Verdict:** Strong contender. $35/mo Professional plan includes Storyblocks library (18M assets). Great for Facebook/Instagram ads.

### Lumen5
- **Pricing:** Free (5 videos/mo, 2 min max, watermark) | Basic $29/mo | Starter $79/mo (1080p, 50M stock) | Professional $199/mo (500M stock)
- **Quality:** 7/10 - Clean, professional templates
- **Ease of Use:** 9/10 - Blog-to-video is excellent
- **Talking Heads Required?** No - text overlay + stock footage is the core product
- **API:** No
- **Verdict:** Overpriced. $79/mo to get 1080p is steep. Free tier too limited (watermark + 2 min max).

### Fliki
- **Pricing:** Free (5 min/mo, 720p, watermark) | Standard $21/mo (120 min, 1080p) | Premium $66/mo (600 min, voice cloning)
- **Quality:** 7/10 - Good voice + stock footage matching
- **Ease of Use:** 8/10
- **Talking Heads Required?** No - supports text/stock footage mode
- **API:** Yes (paid plans)
- **Verdict:** Good value at $21/mo. 120 minutes = hundreds of short ads. Solid AI voices in 80+ languages. Has an API.

### Wave.video
- **Pricing:** Free (watermark) | Creator ~$25/mo | Business ~$48/mo
- **Quality:** 7/10
- **Ease of Use:** 7/10
- **Talking Heads Required?** No
- **Stock Library:** 200M+ assets included
- **Verdict:** Decent all-rounder. Live streaming + hosting + editing bundled. 200M stock assets is huge.

### Animoto
- **Pricing:** Free (720p, watermark) | Basic $8/mo (1080p, no watermark) | Professional ~$15-29/mo | Pro Plus ~$39-79/mo
- **Quality:** 6/10 - Templates feel dated compared to newer AI tools
- **Ease of Use:** 8/10 - Drag and drop
- **Talking Heads Required?** No
- **Verdict:** Cheapest option at $8/mo for watermark-free 1080p. But templates are less modern. Good for bulk simple ads.

### Biteable
- **Pricing:** Free (watermark, non-commercial) | Pro $15/mo | Premium $49/mo
- **Quality:** 7/10 - Nice animations and cartoon characters
- **Ease of Use:** 8/10
- **Talking Heads Required?** No
- **Stock Library:** 800K+ clips, animations
- **Free Trial:** 7 days Premium
- **Verdict:** Free plan is non-commercial (useless for ads). Pro at $15/mo is reasonable.

### Renderforest
- **Pricing:** Free (720p, watermark) | Lite ~$5-9/mo | Pro ~$8-9/mo | Popular ~$10/mo | Enterprise $120/mo
- **Quality:** 6/10 - Template-heavy, some feel generic
- **Ease of Use:** 8/10
- **Talking Heads Required?** No
- **Verdict:** Cheapest paid option at ~$5/mo. Good for simple template videos. Quality is lower than competitors.

### VEED.io
- **Pricing:** Free (watermark, limited) | Lite $12/mo (annual) | Pro $29/mo (annual)
- **Quality:** 8/10 - Clean modern editor
- **Ease of Use:** 8/10
- **Talking Heads Required?** No
- **API:** No
- **Verdict:** Good editor but more focused on editing existing videos than generating from scratch. Auto-subtitles are excellent.

### Kapwing
- **Pricing:** Free (watermark, 4 min max, 250MB) | Pro $16/mo | Business $50/mo
- **Quality:** 7/10
- **Ease of Use:** 8/10
- **Talking Heads Required?** No
- **API:** No
- **AI B-roll:** Has an AI B-roll generator that auto-inserts relevant stock footage
- **Verdict:** Great editor, good AI features. No API limits automation potential.

### FlexClip
- **Pricing:** Free (720p, watermark, 10 min max) | Plus $12/mo | Business $20/mo (4K)
- **Quality:** 7/10
- **Ease of Use:** 8/10
- **Talking Heads Required?** No
- **AI Features:** 30+ AI tools, text-to-video, AI script, 400+ TTS voices, integrates Veo 3/Kling/Hailuo
- **Verdict:** Best bang-for-buck SaaS option. $12/mo gets 1080p, no watermark, and 30+ AI tools. Integrates cutting-edge AI video models directly.

### Canva Video
- **Pricing:** Free (limited) | Pro $15/mo (500 AI uses/mo) | Teams $10/user/mo
- **Quality:** 8/10 - Clean, modern designs
- **Ease of Use:** 9/10 - Familiar Canva interface
- **Talking Heads Required?** No
- **AI Video:** Powered by Google Veo-3, up to 8 seconds per generation, 5 AI video clips/month on paid plans
- **API:** No video API
- **Verdict:** Great for design-heavy ads. Limited AI video generation (5 clips/mo). Best used for template-based ads with your own footage.

---

## 2. AI Text-to-Video Models (Cutting Edge)

These generate actual video footage from text prompts. Useful for custom B-roll, not full ads.

### Runway ML (Gen-3 / Gen-4)
- **Pricing:** Free (125 credits, one-time) | Standard $12/mo (625 credits = ~62 sec Gen-3) | Pro $28/mo (2250 credits = ~225 sec) | Unlimited $76/mo
- **Quality:** 8/10 - Excellent for stylized/cinematic content
- **Best For:** Custom B-roll generation, artistic scenes
- **Turbo Variants:** Gen-4 Turbo is 7x faster at half credit cost
- **API:** Yes
- **Verdict:** Good for generating 5-10 second custom B-roll clips. $12/mo gets you about 1 minute of video - enough for ~4 ad B-roll clips.

### Pika Labs
- **Pricing:** Free (limited) | Standard $10/mo (700 credits) | Pro $35/mo (2300 credits) | Fancy $95/mo (6000 credits)
- **Quality:** 7/10 - Creative/attention-grabbing, not photorealistic
- **Speed:** 3-6x faster than competitors (30-90 seconds per generation)
- **API:** Yes
- **Verdict:** Cheapest AI video generation at $10/mo. Fast but quality varies. Credits burn unpredictably.

### Kling AI (Kuaishou) - Kling 3.0
- **Pricing:** Free (66 daily credits) | $6.99-$180/mo plans
- **Quality:** 9/10 - Excellent character consistency, cinematic quality
- **API:** Yes ($0.084-0.168/sec)
- **Key Features:** Multi-shot storyboarding, native audio, up to 3 min at 1080p/48fps, 4-image character consistency
- **Verdict:** Best quality-to-price ratio for AI video. Free tier is generous (66 daily credits). Kling 3.0 competes with Sora.

### OpenAI Sora 2
- **Pricing:** ChatGPT Plus $20/mo (unlimited 480p) | Pro $200/mo (10K credits, 1080p) | API $0.10-0.50/sec
- **Quality:** 9/10 - Best photorealism
- **Availability:** Requires ChatGPT Plus/Pro subscription (no free tier since Jan 2026)
- **Verdict:** Expensive. $20/mo gets unlimited 480p which is too low for ads. $200/mo for 1080p is overkill unless you're a studio.

### Google Veo 3.1
- **Pricing:** AI Pro $19.99/mo (~90 fast videos) | Ultra $249.99/mo (~2500 videos) | API $0.75/sec (Veo 3)
- **Quality:** 9/10 - Native audio generation, cinematic
- **Third-party:** fal.ai and Replicate offer Veo 3.1 Fast from ~$0.10/sec
- **Verdict:** Excellent quality. Expensive through Google directly but cheap through third-party APIs.

### Open Source Models (FREE - requires GPU)

#### Wan 2.2 (Alibaba) - BEST OPEN SOURCE
- **License:** Apache 2.0 (fully free, commercial use)
- **Quality:** 9/10 - Outperforms Sora, Pika 2.2, Runway 3
- **GPU Required:** 8GB+ VRAM (5B model at 720p), 16GB+ for 14B model, 24GB for S2V
- **Status:** Released July 2025
- **Verdict:** Best open-source video model. Period. If you have a GPU, this is free and beats paid alternatives.

#### HunyuanVideo (Tencent)
- **License:** Open source
- **Quality:** 8/10 - Outperforms Luma 1.6
- **GPU Required:** 14GB+ VRAM with offloading (8.3B params in v1.5)
- **Verdict:** Second-best open source option. Good quality, heavy GPU requirements.

#### CogVideoX (Tsinghua/Zhipu AI)
- **License:** Open source
- **Quality:** 7/10 - 6-10 sec clips at 720p
- **GPU Required:** Lighter (2B and 5B variants)
- **Verdict:** Lighter weight option for lower-end GPUs.

#### Other Open Source
- **Mochi 1** - Apache 2.0 license, good for experimentation
- **LTX Video** - Lightweight
- **Stable Video Diffusion** - Image-to-video, limited text-to-video
- **ModelScope Text2Video** - Older, lower quality

**Reality Check on Open Source:** You'd need at minimum an RTX 3070 (8GB) for the smallest models, RTX 4090 (24GB) for the best quality. Your gaming PC has an RTX 3070 but is shelved. Cloud GPU rental (RunPod, Vast.ai) runs $0.20-0.80/hour.

---

## 3. Free / Open Source Video Tools

### Remotion (React-based video) - TOP PICK FOR AUTOMATION
- **License:** Free for individuals and companies up to 3 people | $100/mo for larger teams
- **What It Does:** Define video scenes as React components, render to MP4
- **Quality:** 10/10 - Pixel-perfect, you control everything
- **Ease of Use:** 5/10 - Requires React/TypeScript knowledge
- **Key Features:**
  - Programmatic video from React components
  - Spring physics animations
  - Node.js rendering API (renderMedia(), renderStill())
  - AWS Lambda distributed rendering
  - Full control over text, images, animations, timing
- **Verdict:** THE answer for automated ad generation. Free for your size. React knowledge required but you know Node.js. Steeper learning curve but unlimited flexibility.

### Editly (Node.js declarative video)
- **License:** Open source
- **What It Does:** Declarative JSON/JS video composition with FFmpeg
- **Quality:** 7/10
- **Ease of Use:** 7/10 - Simple JSON API
- **Key Features:**
  - Clips, images, titles, transitions, music overlay
  - Custom content via Canvas/Fabric.js/GL shaders
  - Any input/output size (4K, Instagram, YouTube)
  - Audio crossfading, ducking, normalization
  - Subtitle overlay
- **Verdict:** Simpler than Remotion but less powerful. Good for quick prototyping.

### FFCreator (Node.js video creation)
- **License:** Open source
- **What It Does:** Lightweight video creation with animate.css-style effects
- **Quality:** 7/10
- **Ease of Use:** 7/10
- **Key Features:**
  - 90% of animate.css effects available
  - Components: FFScene, FFText, FFVideo, FFImage
  - Subtitle, chart, and VTuber components
  - Node Stream for performance
  - 5 min video renders in 1-2 minutes
- **Verdict:** Good middle ground. Lighter than Remotion, more animation options than editly. Chinese origin but solid.

### FFmpeg (command line)
- **License:** Free, open source
- **Quality:** 10/10 (if you know what you're doing)
- **Ease of Use:** 3/10 - Complex filter syntax
- **Key Features:**
  - drawtext filter for text overlays with fade/animation
  - filter_complex for multi-stream compositing
  - Any resolution, codec, format
  - Programmatically controllable via fluent-ffmpeg (Node.js)
- **Verdict:** The nuclear option. Can do everything but the learning curve is brutal. Best used as a rendering backend (which is what Remotion/editly do).

### MoviePy (Python)
- **License:** MIT, open source
- **Quality:** 8/10
- **Ease of Use:** 6/10
- **Key Features:**
  - TextClip with custom fonts, colors, positions
  - Video compositing, concatenation, effects
  - Audio manipulation
  - Uses FFmpeg under the hood
  - Python 3.9+
- **Verdict:** Python alternative to Remotion. Simpler API but less animation control. Good if you prefer Python over React.

### Traditional Video Editors (manual, not automated)
- **OpenShot** - Free, open source, basic editor
- **Kdenlive** - Free, open source, more advanced
- **DaVinci Resolve** - Free tier is incredibly powerful, professional grade
- **Verdict:** These are manual editors. Not useful for automation. DaVinci Resolve is best if you want to manually create a template.

---

## 4. Stock Footage Sources

### Free (No Cost, Commercial Use OK)

| Source | Library Size | Quality | API | Attribution | Notes |
|--------|-------------|---------|-----|-------------|-------|
| **Pexels** | Large | 8/10 | YES (free) | Not required | Best free API. Hand-curated. |
| **Pixabay** | 4.3M+ | 7/10 | YES (free, 100 req/min) | Not required | Largest free library. No hotlinking. |
| **Mixkit** | 44K+ | 9/10 | No | Not required | Highest quality free footage. Boutique feel. |
| **Coverr** | Medium | 8/10 | No | Not required | Clean, modern, mood-focused. |
| **Videvo** | Large | 7/10 | No | Some clips need attribution | Mixed quality, 4K available. |

### Paid (Unlimited Downloads)

| Source | Price | Library Size | Notes |
|--------|-------|-------------|-------|
| **Envato Elements** | $16.50/mo | 22M+ | Best value. Also includes music, templates, graphics. |
| **Storyblocks** | $21-40/mo | Large | Good quality. Includes AI credits. |
| **Artgrid** | $49/mo | Premium | 6K/8K footage. Cinematic quality. Overkill for ads. |

### AI-Generated Stock Footage
- **Kling AI free tier** (66 daily credits) - Generate custom B-roll from text
- **Runway free tier** (125 one-time credits) - Limited but useful
- **Pika free tier** - Short clips
- **Kapwing AI B-roll** - Auto-generates from transcript
- **Wan 2.2** (open source) - Best quality if you have GPU

**Best Free Strategy:** Use Pexels API (programmatic) + Pixabay API (backup) + Kling AI free tier (custom B-roll). This gives you unlimited free stock + custom AI footage.

---

## 5. Free Music / Audio

| Source | Library | Commercial Use | Downloads | Quality | API |
|--------|---------|----------------|-----------|---------|-----|
| **Pixabay Music** | 180K+ tracks | Yes, no attribution | Unlimited | 7/10 | Via Pixabay API |
| **YouTube Audio Library** | Large | Yes (YouTube only) | Unlimited | 7/10 | No |
| **Free Music Archive** | Large | Yes (check CC license) | Unlimited | 7/10 | No |
| **Uppbeat Free** | 30% catalog | Yes | 3-10/month | 8/10 | No |
| **Mixkit Music** | Medium | Yes | Unlimited | 8/10 | No |

### Paid Music

| Source | Price | Library | Commercial Ads |
|--------|-------|---------|----------------|
| **Epidemic Sound** | ~$17-30/mo | Huge, high quality | Yes (Pro plan) |
| **Envato Elements** | $16.50/mo (included) | Bundled with video/graphics | Yes |
| **Storyblocks** | $30/mo (All Access) | Included in plan | Yes |
| **Artlist** | ~$10-17/mo | High quality | Yes |

**Best Free Strategy:** Pixabay Music (unlimited, no attribution, searchable API) + Mixkit Music (high quality backup).

---

## 6. Programmatic Ad Generation

### Can We Build a Node.js Tool That Auto-Generates Video Ads?

**YES.** Here's what the stack would look like:

### Option A: Remotion Stack (RECOMMENDED)

```
Claude API (script generation)
    ↓
Pexels/Pixabay API (stock footage selection by keywords)
    ↓
Remotion (React components for scenes, text, animations)
    ↓
Pixabay Music API (background track)
    ↓
renderMedia() → MP4 output
```

**Libraries needed:**
- `remotion` + `@remotion/cli` + `@remotion/renderer` - Video rendering
- `@remotion/player` - Preview in browser
- Pexels API client - Stock footage
- Anthropic SDK - Script generation
- Node.js built-in fetch - API calls

**Estimated dev time:** 2-3 days for a basic version, 1-2 weeks for production quality.

### Option B: Editly/FFCreator Stack (SIMPLER)

```
Claude API (script generation)
    ↓
Pexels API (stock footage)
    ↓
editly or FFCreator (compose video from JSON spec)
    ↓
MP4 output
```

**Libraries needed:**
- `editly` or `ffcreator` - Video composition
- `fluent-ffmpeg` + `ffmpeg-static` - FFmpeg bindings
- Pexels/Pixabay client
- Anthropic SDK

**Estimated dev time:** 1-2 days basic, 1 week production.

### Option C: FFmpeg + Canvas (LOWEST LEVEL)

```
Claude API → script
    ↓
node-canvas → render frames with text/graphics
    ↓
FFmpeg → stitch frames + stock footage + music → MP4
```

**Libraries needed:**
- `canvas` (node-canvas) - Frame rendering
- `fluent-ffmpeg` + `ffmpeg-static`
- Pexels client

**Estimated dev time:** 3-5 days basic, 2+ weeks production.

### Option D: Cloud API (EASIEST, NOT FREE)

| API | Pricing | Approach |
|-----|---------|----------|
| **Shotstack** | $0.20-0.40/min, 10 free credits | JSON timeline → cloud render |
| **Creatomate** | $54/mo (200 short videos) | JSON template → cloud render |
| **JSON2Video** | $19.95/mo, 600 sec free | JSON → cloud render |

**Libraries needed:** Just HTTP client + their SDK. No FFmpeg needed.

**Verdict:** For automation, Shotstack has the best free trial (10 credits). Creatomate is best for ongoing use. Both accept JSON descriptions of videos.

---

## 7. The "Build Our Own" Option

### What Would It Take to Build a Simplified InVideo Clone?

**Architecture:**

```
┌─────────────────────────────────────────────┐
│  Ad Generator Service (Node.js)              │
│                                              │
│  1. Input: Business name, service, audience  │
│  2. Claude generates ad script (scenes,      │
│     text overlays, mood keywords)            │
│  3. Pexels API searches for matching clips   │
│  4. Remotion composes:                       │
│     - Scene 1: Hook (stock footage + text)   │
│     - Scene 2: Problem (stock + text)        │
│     - Scene 3: Solution (stock + text)       │
│     - Scene 4: CTA (logo + phone + website)  │
│  5. Pixabay Music adds background track      │
│  6. renderMedia() → final MP4               │
│                                              │
│  Output: 15-30 sec MP4 ad                    │
└─────────────────────────────────────────────┘
```

### Remotion Deep Dive

**How it works:**
1. You write React components that represent video scenes
2. Each component receives `frame` number and video metadata
3. You animate using `interpolate()`, `spring()`, CSS transforms
4. Remotion renders each frame as a screenshot, stitches with FFmpeg
5. Output: MP4, WebM, GIF, or image sequences

**Example scene structure:**
```jsx
// A single ad scene with animated text over stock video
const AdScene = ({ text, stockVideoUrl }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1]);

  return (
    <AbsoluteFill>
      <Video src={stockVideoUrl} />
      <div style={{ opacity, fontSize: 48, color: 'white' }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};
```

**Rendering:**
```js
// Server-side rendering
await renderMedia({
  composition,
  codec: 'h264',
  outputLocation: 'ad-output.mp4',
});
```

### Cost Analysis: Build vs Buy

| Approach | Monthly Cost | Per-Video Cost | Setup Time | Flexibility |
|----------|-------------|----------------|------------|-------------|
| InVideo AI | $20-48/mo | ~$0.40-1.00 | 0 | Low |
| Pictory | $25-35/mo | ~$0.10-0.50 | 0 | Low |
| FlexClip | $12-20/mo | ~$0.05-0.20 | 0 | Medium |
| Custom Remotion | $0/mo* | ~$0.01** | 2-5 days | Unlimited |
| Custom editly | $0/mo | ~$0.01** | 1-3 days | High |
| Shotstack API | $0.20-0.40/min | ~$0.10-0.20 | 1 day | High |

*Free for teams up to 3 people
**Cost is only Claude API for script generation (~$0.01-0.03 per script)

---

## 8. Hybrid Approaches

### Approach A: Free AI B-Roll + Programmatic Assembly
1. Use **Kling AI free tier** (66 daily credits) for custom B-roll clips
2. Supplement with **Pexels API** free stock footage
3. Use **Remotion** or **editly** to compose with text overlays
4. Add **Pixabay Music** (free)
5. **Cost: $0/month** (only Claude API for scripts ~$0.01/ad)

### Approach B: Cheap SaaS + Free Assets
1. Use **FlexClip** ($12/mo) for the video editor with built-in AI
2. Or **Animoto** ($8/mo) for simple template-based ads
3. Manually create ads using their templates + free stock footage
4. **Cost: $8-12/month** but requires manual work

### Approach C: API-First Automation
1. **Claude** generates ad script as structured JSON
2. **Pexels API** fetches matching stock footage
3. **Shotstack API** or **JSON2Video** renders the video
4. **Pixabay API** provides music
5. **Cost: $0-20/month** depending on volume

### Approach D: Maximum Quality, Some Cost
1. **Claude** generates script
2. **Kling AI** ($6.99/mo) generates custom cinematic B-roll
3. **Remotion** composes final video with text/transitions
4. **Envato Elements** ($16.50/mo) for premium stock + music
5. **Cost: ~$23/month** for near-studio quality

---

## 9. Recommendations by Strategy

### CHEAPEST PATH ($0/month)
**Stack:** Claude API + Pexels API + Remotion + Pixabay Music
- Script: Claude (~$0.01/ad)
- Footage: Pexels API (free, unlimited)
- Composition: Remotion (free for small teams)
- Music: Pixabay (free, no attribution)
- **Total: ~$0.01 per ad**
- **Tradeoff:** 2-5 days setup time, need React knowledge, stock footage only (no custom AI B-roll)

### EASIEST PATH ($12-25/month)
**Tool:** FlexClip ($12/mo) or Pictory ($25/mo)
- Just paste a script, platform does the rest
- Built-in stock footage, music, text animations
- No coding required
- FlexClip integrates Veo 3 and Kling AI for AI B-roll
- **Total: $12-25/month**
- **Tradeoff:** Manual work per ad, limited customization, can't fully automate

### BEST QUALITY ($23-30/month)
**Stack:** Claude + Kling AI ($6.99/mo) + Envato Elements ($16.50/mo) + Remotion
- Custom AI-generated B-roll from Kling (cinematic quality)
- Premium stock footage and music from Envato
- Pixel-perfect composition with Remotion
- **Total: ~$23.50/month + ~$0.01/ad**
- **Tradeoff:** Needs setup time, but produces near-professional results

### MOST AUTOMATABLE ($0-20/month)
**Stack:** Claude + Pexels API + Remotion (or Shotstack API)

**Remotion path ($0/mo):**
- Fully automated pipeline: prompt → script → footage → compose → MP4
- Runs locally, no API limits
- Need to build Remotion templates (one-time)

**Shotstack path (~$0-20/mo):**
- JSON timeline API, cloud rendered
- 10 free credits to start
- Easier than Remotion but costs money at scale

---

## 10. RECOMMENDED STACK

### Primary Recommendation: Custom Remotion Pipeline

This is the clear winner for your use case (B2B lead gen, need lots of ads, want minimal ongoing cost).

```
INPUT:  Business name, service type, target audience, phone, website
   ↓
STEP 1: Claude API generates structured ad script
        - 4-5 scenes with text overlays
        - Search keywords for stock footage per scene
        - Mood/genre for music selection
   ↓
STEP 2: Pexels API fetches matching video clips
        - Search by keywords from Claude's script
        - Download highest quality MP4s
   ↓
STEP 3: Pixabay Music API selects background track
        - Match genre/mood from script
   ↓
STEP 4: Remotion renders final video
        - Pre-built ad templates (React components)
        - Animated text overlays (fade in/out, slide, scale)
        - Stock footage as backgrounds
        - End card with logo, phone, website
        - Background music mixed in
   ↓
OUTPUT: Professional 15-30 sec MP4 ad
```

**Why Remotion over alternatives:**
- **Free** for your team size
- **Unlimited** videos, no credits to burn
- **Fully automated** via Node.js API
- **Pixel-perfect** - you control every frame
- **Reusable templates** - build once, generate thousands
- **No watermarks**, no subscription
- React-based (modern, well-documented, huge ecosystem)

**What you'd need to build:**
1. 3-5 ad templates as React components (different styles/layouts)
2. A script generator prompt for Claude
3. A Pexels/Pixabay API integration for footage search + download
4. A simple CLI or API endpoint to trigger generation
5. FFmpeg installed locally (Remotion uses it for rendering)

**Estimated total dev time:** 3-5 days for MVP, 1-2 weeks for polish.

**Ongoing cost:** ~$0.01-0.03 per ad (Claude API only).

### Secondary Recommendation (if you want zero dev work):

**FlexClip at $12/month** - Best SaaS value. Built-in AI tools, stock footage, music, text animations. Integrates Veo 3 and Kling AI. Just paste your script and tweak. Not automated but very fast manually.

### Fallback for Quick Start:

**Editly** (npm package) for a simpler, faster-to-build pipeline. Less animation control than Remotion but gets you generating ads in 1-2 days of dev work with zero cost.

---

## Quick Reference: All Platforms Rated

| Platform | Monthly Cost | Quality | Ease | No Talking Heads | API | Automatable |
|----------|-------------|---------|------|-------------------|-----|-------------|
| Remotion | $0 | 10/10 | 5/10 | Yes | Yes (Node.js) | Fully |
| Editly | $0 | 7/10 | 7/10 | Yes | Yes (Node.js) | Fully |
| FFCreator | $0 | 7/10 | 7/10 | Yes | Yes (Node.js) | Fully |
| FlexClip | $12 | 7/10 | 8/10 | Yes | No | No |
| Animoto | $8 | 6/10 | 8/10 | Yes | No | No |
| Biteable | $15 | 7/10 | 8/10 | Yes | No | No |
| Canva | $15 | 8/10 | 9/10 | Yes | No | No |
| Pictory | $25 | 7/10 | 8/10 | Yes | No | No |
| Fliki | $21 | 7/10 | 8/10 | Yes | Yes | Partially |
| InVideo AI | $20 | 7/10 | 9/10 | Yes | No | No |
| Renderforest | $5 | 6/10 | 8/10 | Yes | No | No |
| Wave.video | $25 | 7/10 | 7/10 | Yes | No | No |
| Lumen5 | $79 | 7/10 | 9/10 | Yes | No | No |
| Shotstack | $0.20/min | 8/10 | 6/10 | Yes | Yes | Fully |
| Creatomate | $54 | 8/10 | 7/10 | Yes | Yes | Fully |
| JSON2Video | $20 | 7/10 | 7/10 | Yes | Yes | Fully |
| Kling AI | $0-7 | 9/10 | 7/10 | Yes | Yes | B-roll only |
| Pika | $10 | 7/10 | 8/10 | Yes | Yes | B-roll only |
| Runway | $12 | 8/10 | 7/10 | Yes | Yes | B-roll only |

---

## Sources

### AI Video Platforms
- [InVideo AI Pricing](https://invideo.io/pricing/)
- [InVideo AI Plans and Credits](https://help.invideo.io/en/articles/11528140-what-plans-does-invideo-offer-and-what-s-included-in-each)
- [Pictory AI Pricing 2026](https://www.saasworthy.com/product/pictory-ai/pricing)
- [Pictory AI Review 2026](https://www.techraisal.com/blog/pictory-ai-review-2026-the-smart-slightly-sassy-video-generator-that-might-replace-your-editor/)
- [Lumen5 Pricing](https://lumen5.com/pricing/)
- [Lumen5 Review 2026](https://autogpt.net/ai-tool/lumen5-ai/)
- [Fliki Pricing](https://fliki.ai/pricing)
- [Fliki AI Review 2026](https://fluxnote.io/guides/fliki-ai-video-review-2026)
- [Synthesia Pricing](https://www.synthesia.io/pricing)
- [Synthesia AI Review 2026](https://filmora.wondershare.com/video-editor-review/synthesia-ai-video-generator.html)
- [Wave.video Pricing](https://wave.video/pricing)
- [Animoto Pricing](https://animoto.com/pricing)
- [Biteable Pricing](https://biteable.com/pricing/)
- [Renderforest Pricing](https://www.renderforest.com/subscription)
- [VEED.io Pricing](https://www.veed.io/pricing?locale=en)
- [Kapwing Pricing](https://www.kapwing.com/pricing)
- [FlexClip Pricing](https://www.flexclip.com/pricing.html)
- [FlexClip Review 2026](https://blogrecode.com/flexclip-review-after-making-50-videos-in-30-days/)
- [Canva AI Video Generator](https://www.canva.com/features/ai-video-generator/)
- [Canva AI Video Review 2026](https://www.clipcat.com/blog/complete-guide-to-canva-ai-video-generator-2025-features-pricing-and-honest-review/)

### AI Text-to-Video Models
- [Runway ML Pricing](https://runwayml.com/pricing)
- [Runway ML Review 2026](https://max-productive.ai/ai-tools/runwayml/)
- [Pika Labs Pricing](https://pika.art/pricing)
- [Pika Labs Pricing Guide](https://www.imagine.art/blogs/pika-labs-pricing)
- [Kling AI Review 2026](https://max-productive.ai/ai-tools/kling-ai/)
- [Kling 3.0 Review](https://www.atlascloud.ai/blog/guides/kling-3.0-review-features-pricing-ai-alternatives)
- [Sora 2 Pricing Guide](https://magichour.ai/blog/sora-pricing)
- [Sora 2 Complete Guide 2026](https://wavespeed.ai/blog/posts/openai-sora-2-complete-guide-2026/)
- [Google Veo 3.1 Pricing](https://www.imagine.art/blogs/Google-Veo-3.1-pricing)
- [Google Veo Pricing Calculator](https://costgoat.com/pricing/google-veo)
- [Best Open Source AI Video Models 2026](https://www.pixazo.ai/blog/best-open-source-ai-video-generation-models)
- [Open Source AI Video Models](https://aifreeforever.com/blog/open-source-ai-video-models-free-tools-to-make-videos)
- [HunyuanVideo GitHub](https://github.com/Tencent-Hunyuan/HunyuanVideo)
- [CogVideo GitHub](https://github.com/zai-org/CogVideo)
- [Wan 2.2 on HuggingFace](https://huggingface.co/Wan-AI/Wan2.2-T2V-A14B)
- [Wan 2.2 Guide](https://www.ori.co/blog/how-to-run-wan-2.2)

### Programmatic Video Tools
- [Remotion Official Site](https://www.remotion.dev/)
- [Remotion GitHub](https://github.com/remotion-dev/remotion)
- [Remotion Licensing](https://www.remotion.dev/docs/license)
- [Remotion Node.js API](https://www.remotion.dev/docs/api)
- [Editly GitHub](https://github.com/mifi/editly)
- [FFCreator GitHub](https://github.com/tnfe/FFCreator)
- [FFCreator npm](https://www.npmjs.com/package/ffcreator)
- [Shotstack Pricing](https://shotstack.io/pricing/)
- [Shotstack Video Editing API](https://shotstack.io/product/video-editing-api/)
- [Creatomate Pricing](https://creatomate.com/pricing)
- [Creatomate API](https://creatomate.com/developers)
- [JSON2Video Pricing](https://json2video.com/pricing/)
- [Video Rendering with Node.js and FFmpeg](https://creatomate.com/blog/video-rendering-with-nodejs-and-ffmpeg)
- [MoviePy Documentation](https://zulko.github.io/moviepy/getting_started/quick_presentation.html)
- [MoviePy GitHub](https://github.com/Zulko/moviepy)
- [FFmpeg Drawtext Filter](https://ottverse.com/ffmpeg-drawtext-filter-dynamic-overlays-timecode-scrolling-text-credits/)

### Stock Footage
- [Pexels API](https://www.pexels.com/api/)
- [Pixabay API Documentation](https://pixabay.com/api/docs/)
- [Best Free Stock Video Sites 2026](https://swarmify.com/blog/10-best-free-stock-video-sites/)
- [Best Free B-Roll Websites 2026](https://swarmify.com/blog/best-free-b-roll-websites/)
- [Mixkit](https://mixkit.co/)
- [Envato Elements Pricing](https://elements.envato.com/pricing)
- [Storyblocks vs Envato](https://www.footagesecrets.com/buyers-guide/storyblocks-vs-envato-elements/)
- [AI B-Roll Generators 2026](https://www.opus.pro/blog/best-ai-b-roll-generators-short-form-video)

### Music/Audio
- [Pixabay Music](https://pixabay.com/music/)
- [Free Music Archive](https://freemusicarchive.org/)
- [Uppbeat](https://uppbeat.io/)
- [Best Free Royalty-Free Music 2026](https://swarmify.com/blog/free-music-for-your-videos-the-importance-and-where-to-find/)
- [YouTube Audio Library Guide](https://vidiq.com/blog/post/royalty-free-music-youtube-audio-library/)
- [Epidemic Sound Pricing](https://www.epidemicsound.com/pricing/)
