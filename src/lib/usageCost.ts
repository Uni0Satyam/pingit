interface UsageCost {
  amountUsd: number;
  inputRateUsdPerMillion: number;
  outputRateUsdPerMillion: number;
  infrastructureUsdPerRequest: number;
}

const GEMINI_MODEL_RATES: Record<
  string,
  { input: number; output: number }
> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.8-flash": { input: 1.5, output: 7.5 },
};

function readNonNegativeNumber(name: string) {
  const value = process.env[name];
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function calculateUsageCost(
  inputTokens: number,
  outputTokens: number,
  model = "gemini-3.5-flash-lite",
): UsageCost | null {
  const rates = GEMINI_MODEL_RATES[model];
  if (!rates) return null;
  const inputRateUsdPerMillion =
    readNonNegativeNumber(`${model.toUpperCase().replaceAll("-", "_")}_INPUT_USD_PER_MILLION_TOKENS`) ??
    rates.input;
  const outputRateUsdPerMillion =
    readNonNegativeNumber(`${model.toUpperCase().replaceAll("-", "_")}_OUTPUT_USD_PER_MILLION_TOKENS`) ??
    rates.output;
  const infrastructureUsdPerRequest =
    readNonNegativeNumber("INFRASTRUCTURE_USD_PER_REQUEST") ?? 0;

  return {
    amountUsd:
      (inputTokens * inputRateUsdPerMillion +
        outputTokens * outputRateUsdPerMillion) /
        1_000_000 +
      infrastructureUsdPerRequest,
    inputRateUsdPerMillion,
    outputRateUsdPerMillion,
    infrastructureUsdPerRequest,
  };
}

export function getUsdToInrRate() {
  const rate = readNonNegativeNumber("USD_INR_EXCHANGE_RATE");
  return rate && rate > 0 ? rate : null;
}
