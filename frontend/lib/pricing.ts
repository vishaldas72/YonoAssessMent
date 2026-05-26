// USD per 1M tokens (input, output). Keep in sync with backend/app/runtime/pricing.py.
const PRICING: Record<string, [number, number]> = {
  "llama-3.3-70b-versatile": [0.59, 0.79],
  "llama-3.1-8b-instant": [0.05, 0.08],
  "mixtral-8x7b-32768": [0.24, 0.24],
  "claude-sonnet-4-6": [3.0, 15.0],
  "claude-haiku-4-5-20251001": [1.0, 5.0],
  "claude-opus-4-7": [15.0, 75.0],
  "llama3.1:8b": [0.0, 0.0],
  "llama3.1": [0.0, 0.0],
};

function priceFor(model: string | null | undefined): [number, number] {
  if (!model) return [0, 0];
  if (PRICING[model]) return PRICING[model];
  let best: { key: string; val: [number, number] } | null = null;
  for (const [key, val] of Object.entries(PRICING)) {
    if (model.startsWith(key) && (!best || key.length > best.key.length)) {
      best = { key, val };
    }
  }
  return best ? best.val : [0, 0];
}

export function calculateCost(
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  const [inRate, outRate] = priceFor(model);
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.0001) return "<$0.0001";
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
