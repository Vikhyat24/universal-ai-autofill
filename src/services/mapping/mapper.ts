/**
 * Semantic field mapper.
 *
 * Given FieldSignals for a control, produce the best (kind, confidence)
 * match. The pipeline, in priority order:
 *
 *   1. Learned mappings   — user-confirmed signatures (highest trust)
 *   2. autocomplete attr  — standards-based, near-certain
 *   3. input type hints   — type=email/tel/date etc.
 *   4. Taxonomy scoring   — weighted keyword/phrase matching across signals
 *   5. Custom-key fuzzy   — user-defined custom fields matched by similarity
 *
 * The Mapper interface is deliberately async-friendly and pure over
 * FieldSignals so an LLM-backed implementation can replace/augment
 * `mapField` later (see docs/ROADMAP.md) without touching the detector.
 */
import { TAXONOMY, type KindSpec } from '@/shared/taxonomy';
import type { FieldKind, LearnedMapping } from '@/shared/types';
import { type FieldSignals, normalize, tokenize, fieldSignature, similarity } from './signals';

export interface MappingResult {
  kind: FieldKind;
  customKey?: string;
  confidence: number; // 0..1
  signature: string;
}

export interface MapperContext {
  learned: LearnedMapping[];
  /** Custom field keys available in the active profile. */
  customKeys: string[];
  /** Enable the fuzzy/semantic layer (Settings.aiMappingEnabled). */
  semantic: boolean;
}

/** Per-signal weights: how much a keyword hit in each signal is worth. */
const SIGNAL_WEIGHTS: Array<{ key: keyof FieldSignals; weight: number }> = [
  { key: 'label', weight: 1.0 },
  { key: 'ariaLabel', weight: 0.95 },
  { key: 'placeholder', weight: 0.85 },
  { key: 'name', weight: 0.8 },
  { key: 'id', weight: 0.7 },
  { key: 'nearbyText', weight: 0.55 },
  { key: 'sectionHeading', weight: 0.3 },
  { key: 'className', weight: 0.35 },
  { key: 'dataAttrs', weight: 0.35 },
];

function scoreAgainstSpec(signals: FieldSignals, spec: KindSpec, semantic: boolean): number {
  let best = 0;

  for (const { key, weight } of SIGNAL_WEIGHTS) {
    const raw = signals[key];
    if (typeof raw !== 'string' || !raw) continue;
    const norm = normalize(raw);
    if (!norm) continue;
    const tokens = tokenize(raw);
    const joined = tokens.join('');

    let signalScore = 0;

    // Phrase hit: strongest evidence within a signal.
    for (const phrase of spec.phrases) {
      if (norm.includes(phrase)) {
        signalScore = Math.max(signalScore, 1.0);
        break;
      }
    }

    // Keyword hit: token equality, or containment for compound tokens.
    if (signalScore < 1) {
      for (const kw of spec.keywords) {
        if (tokens.includes(kw) || joined === kw) {
          signalScore = Math.max(signalScore, 0.9);
          break;
        }
        if (kw.length >= 4 && joined.includes(kw)) {
          signalScore = Math.max(signalScore, 0.75);
        }
      }
    }

    // Fuzzy layer for unusual namings ("candidatemailid" ≈ "emailaddress").
    if (semantic && signalScore < 0.6) {
      for (const kw of spec.keywords) {
        if (kw.length < 4) continue;
        const sim = similarity(joined, kw);
        if (sim > 0.72) signalScore = Math.max(signalScore, sim * 0.7);
      }
    }

    // Negative tokens veto this signal's contribution.
    if (signalScore > 0 && spec.negative) {
      for (const neg of spec.negative) {
        if (norm.includes(neg)) {
          signalScore = 0;
          break;
        }
      }
    }

    best = Math.max(best, signalScore * weight);
  }

  // Input-type hint adds corroboration but never stands alone for
  // ambiguous types; email/tel/date types are strong on their own.
  if (spec.inputTypes?.includes(signals.inputType)) {
    best = Math.max(best, signals.inputType === 'text' ? best : 0.85);
  }

  return Math.min(best, 1);
}

/** Map one field. Pure & synchronous — safe to call in tight loops. */
export function mapField(signals: FieldSignals, ctx: MapperContext): MappingResult {
  const signature = fieldSignature(signals);

  // 1. Learned mappings (exact signature match).
  const learned = ctx.learned.find((m) => m.signature === signature);
  if (learned) {
    return {
      kind: learned.kind,
      customKey: learned.customKey,
      confidence: Math.min(0.95 + learned.votes * 0.01, 1),
      signature,
    };
  }

  // 2. Standard autocomplete attribute → canonical kind.
  const ac = normalize(signals.autocomplete).replace(/\s/g, '-');
  if (ac && ac !== 'off' && ac !== 'on') {
    for (const spec of TAXONOMY) {
      // autocomplete can carry section prefixes: "section-x shipping tel".
      if (spec.autocomplete.some((a) => ac === a || ac.endsWith(`-${a}`) || ac.includes(a))) {
        return { kind: spec.kind, confidence: 0.98, signature };
      }
    }
  }

  // 3+4. Taxonomy scoring across all kinds.
  let bestSpec: KindSpec | null = null;
  let bestScore = 0;
  for (const spec of TAXONOMY) {
    const s = scoreAgainstSpec(signals, spec, ctx.semantic);
    if (s > bestScore) {
      bestScore = s;
      bestSpec = spec;
    }
  }

  // 5. Custom keys — fuzzy match against user-defined field names.
  let bestCustom: { key: string; score: number } | null = null;
  if (ctx.semantic) {
    const candidates = [signals.label, signals.placeholder, signals.name, signals.ariaLabel, signals.nearbyText];
    for (const key of ctx.customKeys) {
      for (const cand of candidates) {
        if (!cand) continue;
        const sim = similarity(cand, key);
        const norm = normalize(cand);
        const exact = norm && norm === normalize(key) ? 1 : 0;
        const score = Math.max(exact, sim * 0.85);
        if (score > 0.62 && (!bestCustom || score > bestCustom.score)) {
          bestCustom = { key, score };
        }
      }
    }
  }

  if (bestCustom && bestCustom.score > bestScore) {
    return { kind: 'custom', customKey: bestCustom.key, confidence: bestCustom.score, signature };
  }
  if (bestSpec && bestScore > 0.3) {
    return { kind: bestSpec.kind, confidence: bestScore, signature };
  }
  return { kind: 'unknown', confidence: 0, signature };
}

/**
 * For select/radio groups: choose the option whose label best matches the
 * profile value. Returns the option index or -1.
 */
export function bestOptionIndex(options: string[], value: string): number {
  if (!value) return -1;
  const normValue = normalize(value);
  let bestIdx = -1;
  let bestScore = 0;
  options.forEach((opt, i) => {
    const normOpt = normalize(opt);
    if (!normOpt) return;
    let score = 0;
    if (normOpt === normValue) score = 1;
    else if (normOpt.includes(normValue) || normValue.includes(normOpt)) score = 0.85;
    else score = similarity(normOpt, normValue) * 0.8;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  return bestScore > 0.55 ? bestIdx : -1;
}
