# Research: Chatterbox TTS vs ElevenLabs — Quality, Latency, and Voice Cloning Benchmarks (2026)

**Date:** 2026-04-09
**Cycles:** 2
**Final Score:** 8.2/10
**Playbook Version:** 1.2

## Executive Summary

Chatterbox TTS (Resemble AI, MIT-licensed) wins 63.75% of blind preference tests against ElevenLabs but trades quality perception for a 6x latency disadvantage: ElevenLabs Flash v2.5 delivers ~75ms TTFA while Chatterbox Turbo's first chunk arrives in ~472ms on an RTX 4090. On Joey's RTX 3070, Chatterbox Turbo achieves RTF 0.718 — faster than real-time but nowhere near ElevenLabs' cloud-optimized infrastructure. The critical finding is that Chatterbox has **zero published objective quality metrics** (no MOS, PESQ, WER) — all quality claims rest on Podonos subjective preference tests, which three different evaluation arenas score differently. For the Joshua rework, Chatterbox Turbo is viable for self-hosted voice agents where cost ($0 vs $30-60/1M chars) matters more than sub-100ms latency.

## Detailed Findings

### Quality Benchmarks: Subjective Preference

**Podonos Blind Tests (Resemble AI's benchmark):**
- Chatterbox vs ElevenLabs: 63.75% preferred Chatterbox (38.75% strongly, 25% moderately)
- ElevenLabs preferred: 27.5% (11.25% strongly, 16.25% moderately)
- Neutral: 8.75%

**Chatterbox Turbo vs Competitors (Resemble AI):**
- vs ElevenLabs Turbo v2.5: 65.3% prefer Chatterbox
- vs Cartesia Sonic 3: 49.8% (near parity)
- vs VibeVoice 7B: 59.1% prefer Chatterbox

**ELO Rankings (CONTRADICTORY across arenas):**

| Arena | Chatterbox ELO | ElevenLabs ELO | Gap |
|-------|---------------|----------------|-----|
| Inworld benchmark | 1,050 (#12) | 1,108 (#3) | -58 (EL wins) |
| OcDevel/TTS Arena | 1,502 (#15) | 1,548 (#7) | -46 (EL wins) |
| GenMediaLab | Unranked | 1,196 (#2) | N/A |

**Key contradiction:** Podonos preference tests (run by Resemble AI) show Chatterbox winning 63.75%, but independent ELO arenas consistently rank ElevenLabs higher. This suggests controlled A/B testing with cherry-picked prompts may differ from diverse, crowd-sourced evaluation.

**HN Community Reality Check:**
- "Okay, not as good as ElevenLabs" — casual user
- "Very natural sounding" — general impression
- Scottish accents become Australian; Australian becomes RP English — accent fidelity issues
- "Strange artifacts — air venting, machine whirring" — audio quality reports
- MegaTTS3 mentioned as potentially superior in speaker similarity

### Objective Quality Metrics: The Missing Data

**Chatterbox has NO published:**
- Mean Opinion Score (MOS)
- PESQ (Perceptual Evaluation of Speech Quality)
- STOI (Short-Time Objective Intelligibility)
- UTMOS predictions
- Word Error Rate (WER)

**ElevenLabs HAS published:**
- Pronunciation accuracy: 81.97% (vs OpenAI 77.30%)
- Hallucination rate: 5% (vs OpenAI 10%)

This is a significant gap. All Chatterbox quality claims rest on a single Podonos subjective preference test commissioned by Resemble AI. Independent objective evaluation is absent.

### Latency and Real-Time Performance

| System | TTFA / First Chunk | RTF | Hardware |
|--------|-------------------|-----|----------|
| ElevenLabs Flash v2.5 | ~75ms (model only) | N/A (cloud) | Cloud API |
| ElevenLabs Flash v2.5 | ~150ms (P90 incl network) | N/A | Cloud API |
| Chatterbox Turbo | 472ms (first chunk) | 0.499 | RTX 4090 |
| **Chatterbox Turbo** | **N/A** | **0.718** | **RTX 3070 (Joey's confirmed)** |
| Chatterbox (M4 Max) | N/A | ~1.5x real-time (SLOWER) | M4 Max 128GB |
| Cartesia Sonic 3 | 40ms | N/A | Cloud API |
| Kokoro 82M | N/A | 0.0047 (210x) | RTX 4090 |
| Kokoro 82M | N/A | 0.011 (90x) | RTX 3090 |

**Key insight:** Chatterbox Turbo's 472ms first-chunk latency is 6x slower than ElevenLabs' 75ms. For voice agents where perceived responsiveness matters, this is the critical tradeoff. However, once streaming begins, RTF < 1.0 means audio generates faster than playback — the bottleneck is only the initial chunk.

**Apple Silicon caveat:** M4 Max (128GB) generates 3:01 of audio in 4:28 — that's RTF ~1.5, which is SLOWER than real-time. Chatterbox on Apple Silicon is not viable for real-time voice agents without further optimization.

### Model Architecture Comparison

| Feature | Chatterbox Turbo | Chatterbox Original | ElevenLabs Flash v2.5 |
|---------|-----------------|--------------------|-----------------------|
| Parameters | 350M | 500M | Proprietary |
| License | MIT | MIT | Proprietary API |
| Languages | English only | English only | 32 |
| Multilingual variant | 500M, 23 languages | — | 70+ (Eleven v3) |
| Voice cloning audio | 5-10 seconds | 5-10 seconds | 30 seconds |
| Voice cloning cost | Free | Free | $5/mo minimum |
| Output quality | 24kHz WAV | 24kHz WAV | Up to 44.1kHz WAV |
| Emotion control | Paralinguistic tags | CFG + exaggeration sliders | Audio tags (text markup) |
| Paralinguistic tags | [laugh] [cough] [chuckle] [gasp] [sigh] | Same | Limited |
| Watermarking | PerTH (built-in) | PerTH | None public |
| Speed control | Adjustable rate | Adjustable rate | Standard |
| VRAM required | 4-8GB | 8-16GB | N/A (cloud) |
| Model download | ~3.5GB | ~3.5GB | N/A |

### Pricing at Scale

| Volume | ElevenLabs Flash v2.5 | Chatterbox (self-hosted) | Savings |
|--------|----------------------|--------------------------|---------|
| 100K chars/mo | ~$3-6 | GPU cost only | Marginal |
| 500K chars/mo | ~$15-30 | GPU cost only | ~$180-360/yr |
| 1M chars/mo | ~$30-60 | GPU cost only | ~$360-720/yr |
| 5M chars/mo | ~$150-300 | GPU cost only | ~$1,800-3,600/yr |
| 10M+ chars/mo | ~$300-600+ | GPU cost only | ~$3,600-7,200+/yr |

Breakeven depends on GPU hosting cost. A dedicated RTX 3070 (owned) makes self-hosting essentially free after hardware amortization. Cloud GPU (A10G on Modal) adds ~$1-3/hr when active.

### Streaming Integration Code

**Chatterbox Turbo (basic):**
```python
from chatterbox.tts_turbo import ChatterboxTurboTTS
import torchaudio as ta

model = ChatterboxTurboTTS.from_pretrained(device="cuda")
wav = model.generate(
    "Hi there [chuckle], have you got a minute?",
    audio_prompt_path="ref_clip.wav"
)
ta.save("output.wav", wav, model.sr)
```

**Chatterbox Streaming (with metrics):**
```python
from chatterbox.tts import ChatterboxTTS
import torch

model = ChatterboxTTS.from_pretrained(device="cuda")
chunks = []
for audio_chunk, metrics in model.generate_stream(
    text,
    audio_prompt_path="reference.wav",
    exaggeration=0.7,
    cfg_weight=0.3,
    chunk_size=25  # Lower = reduced latency
):
    chunks.append(audio_chunk)
    print(f"Chunk {metrics.chunk_count}, RTF: {metrics.rtf:.3f}")
    if metrics.latency_to_first_chunk:
        print(f"First chunk: {metrics.latency_to_first_chunk:.3f}s")
final = torch.cat(chunks, dim=-1)
```

**Key streaming parameters:**
- `chunk_size=25` — lowest latency (default 50)
- `exaggeration=0.5` — balanced emotion
- `cfg_weight=0.5` — balanced voice fidelity
- `temperature=0.8` — moderate randomness

### Fine-Tuning Requirements

| Method | VRAM Required | Use Case |
|--------|--------------|----------|
| LoRA | 18GB | Voice adaptation with minimal data |
| GRPO | 12GB | Reinforcement-based quality tuning |
| Zero-shot | 4-8GB | No training, reference audio only |

Joey's RTX 3070 (8GB) can run inference but cannot fine-tune with LoRA or GRPO. The planned RTX 3090 (24GB) would support LoRA fine-tuning.

### 2026 Open-Source TTS Landscape

Beyond Chatterbox, the competitive landscape has shifted dramatically:

| Model | Params | Standout Feature | vs ElevenLabs |
|-------|--------|-----------------|---------------|
| Voxtral TTS (Mistral) | 4B | 62.8% preference, 90ms TTFA | Strong competitor |
| Fish Audio S2 Pro | Unknown | 81.88% EmergentTTS win rate | Tops quality leaderboards |
| Kokoro | 82M | 210x RTF, 2-3GB VRAM | Speed champion |
| Qwen3-TTS | 600M | 97ms streaming, Apache 2.0 | Low-latency open source |
| CosyVoice 2.0 | 500M | 150ms streaming | Alibaba-backed |
| Hume Octave | Unknown | 64% emotional expressiveness | Emotion specialist |

**Kokoro deserves special attention:** At 82M parameters and 210x real-time on RTX 4090, it's 35x faster than Chatterbox Turbo's 6x. For pure speed with acceptable quality (ELO ~1400-1500), Kokoro on the RTX 3070 would likely achieve 30-50x RTF.

## Source Quality

| Source Type | Queries | Useful Findings | Rating |
|-------------|---------|-----------------|--------|
| Resemble AI official (2 pages) | 2 | Podonos data, Turbo specs | High |
| ElevenLabs docs | 3 | Model specs, latency data | High (but many 404s) |
| GitHub repos (3 repos) | 3 | Streaming code, architecture, server config | High |
| Comparison sites (GenMediaLab, Inworld, OcDevel) | 3 | ELO tables, pricing, head-to-head | High |
| HN discussion | 1 | Real user reports, contradictions | High |
| Dev.to articles | 2 | Practitioner experience, Apple Silicon data | Medium |
| HuggingFace model cards | 1 | Architecture confirmation, Turbo code | Medium |
| Modal docs | 1 | Deployment config | Medium |
| BentoML/FindSkill.ai | 2 | Broader landscape, Voxtral/Kokoro data | Medium |
| last30days (Reddit) | 1 | 0 relevant results | Low |
| Joey's confirmed data | 1 | RTF 0.718 on RTX 3070 | High (ground truth) |

## Contradictions & Open Questions

### Documented Contradictions
1. **ELO scores differ across 3 arenas** — Inworld (1050), OcDevel (1502), GenMediaLab (unranked). Different evaluation methodologies, prompt sets, and voter populations produce incomparable scores.
2. **Podonos preference vs ELO ranking** — 63.75% prefer Chatterbox in controlled A/B tests, but ELO arenas consistently rank ElevenLabs higher. Possible explanation: Resemble-selected test prompts may favor Chatterbox strengths.
3. **Latency claims vs reality** — "Sub-200ms" (marketing) vs 472ms first chunk (benchmark) vs 2-5 seconds (real-world typical hardware) vs ~2 min for 11s (M4 Max with model loading). These measure different things but create confusion.
4. **Accent fidelity** — Official marketing says "natural-sounding." HN users report Scottish becoming Australian. Real accent reproduction is unreliable.
5. **Voice cloning reference length** — 5 seconds (official site), 10 seconds (HuggingFace model card), 5-10 seconds (streaming repo). The minimum viable length is unclear.

### Open Questions
- What is Chatterbox's actual WER/MOS compared to ElevenLabs under controlled conditions?
- How does Chatterbox Turbo perform on RTX 3070 in streaming mode (first-chunk latency)?
- Does Chatterbox handle long-form content (>5 minutes) without quality degradation? (40s demo limit suggests this is untested publicly)
- How does Chatterbox perform on telephony-quality audio (8kHz) vs studio quality (24kHz)?
- Can Kokoro's speed advantage be combined with Chatterbox's quality through a hybrid approach?

## Actionable Next Steps

1. **For Joshua rework:** Use `ChatterboxTurboTTS` (350M) on RTX 3070 — confirmed RTF 0.718. Install via `pip install chatterbox-tts`. Import: `from chatterbox.tts_turbo import ChatterboxTurboTTS`.

2. **Streaming integration:** Use `generate_stream()` with `chunk_size=25` for lowest latency. Each chunk is ~1s of audio at 24kHz. First chunk on RTX 3070 will likely be 600-800ms (extrapolating from 472ms on RTX 4090).

3. **Voice cloning:** Prepare 10-second reference WAV clips (use HuggingFace recommendation, not the 5s minimum). Higher quality reference = better output.

4. **Latency budget:** Plan for 600-800ms TTFA on RTX 3070 vs 75ms on ElevenLabs. This means Chatterbox adds ~0.5-0.7s to perceived response time in voice agent workflows. Acceptable if LLM response time is the bigger bottleneck (~1-2s for Claude).

5. **Cost savings:** At current ElevenLabs usage, self-hosting eliminates $30-60/1M chars. Free on owned hardware.

6. **Fine-tuning path:** RTX 3070 (8GB) cannot fine-tune. If voice quality needs improvement, use the planned RTX 3090 (24GB) for LoRA fine-tuning (18GB VRAM needed).

7. **Monitor Kokoro:** At 82M params and 210x RTF, Kokoro may be a better speed/quality tradeoff for high-throughput scenarios. Test on RTX 3070 for comparison RTF data.

8. **Run own benchmarks:** Since no objective quality metrics exist for Chatterbox, run UTMOS predictions on Chatterbox vs ElevenLabs outputs using the same test sentences to get ground truth for Joey's specific use case.

## Score History

| Cycle | Depth | Diversity | Corroboration | Actionability | Novelty | Composite |
|-------|-------|-----------|---------------|---------------|---------|-----------|
| 1 | 7 | 8 | 8 | 6 | 7 | 7.2 |
| 2 | 8 | 8 | 9 | 8 | 8 | 8.2 |

## Related

- [[Joshua]] — Current stack uses ElevenLabs Flash v2.5 (Hope voice), rework planned to Chatterbox Turbo
- [[Joshua Rework]] — Option B hybrid free stack details
- [[Voice AI Research]] — Comprehensive voice AI research baseline
- [[LiveKit Voice Baseline]] — Best call quality config with current ElevenLabs integration
- [[Gaming PC]] — RTX 3070 8GB confirmed Chatterbox Turbo RTF 0.718
- [[AdForge]] — Chatterbox could replace ElevenLabs for video ad voiceovers
- [[Decisions]] — Locked-in decision pending on TTS swap

## Meta: What the Loop Learned

- **Most valuable source this session:** Inworld benchmark page — single page with ELO rankings, pricing, and latency data for 12+ systems. Highest information density encountered.
- **Least valuable source this session:** last30days/Reddit — zero relevant results for this specific TTS comparison topic. Reddit is consistently empty for niche voice AI topics.
- **Surprising discovery:** Three different evaluation arenas produce three incompatible ELO scores for the same models. "Chatterbox ELO" is meaningless without specifying which arena. This undermines confidence in any single benchmark ranking.
