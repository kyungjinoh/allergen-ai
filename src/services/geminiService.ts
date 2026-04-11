interface AllergenAnalysis {
  log_id: string;
  likely_allergens: string[];
  allergen_risk_score: { [key: string]: number };
}

interface AllergenRanking {
  allergen: string;
  risk_score: number;
  frequency: number;
  severity_correlation: number;
  risk_category: 'Low' | 'Medium' | 'High' | 'Critical';
  explanation: string;
  recommendation: string;
}

interface AllergenReport {
  rankings: AllergenRanking[];
  total_logs_analyzed: number;
  summary: string;
  next_steps: {
    test_kits: string[];
    medical_advice: string;
  };
}

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

// Gemini API endpoint (Generative Language API)
// https://ai.google.dev/api/generate-content
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Rate limiting + global queue: parallel callers (e.g. many useEffects) must not
// hit fetch() at once — they all pass MIN_INTERVAL checks unless serialized.
let lastCallTime = 0;
const MIN_INTERVAL = 3200; // ms between Gemini HTTP requests

const GEMINI_429_RETRIES = 5;
const GEMINI_429_BASE_MS = 6000;

function assertApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing REACT_APP_GEMINI_API_KEY. Add it to your .env and restart the dev server.');
  }
}

function extractTextFromGeminiResponse(data: any): string {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('') ?? '';
  return text;
}

export class GeminiService {
  private static geminiChain: Promise<unknown> = Promise.resolve();

  /** One Gemini HTTP sequence at a time (retries included). */
  private static enqueueGeminiTask<T>(task: () => Promise<T>): Promise<T> {
    const next = GeminiService.geminiChain.then(() => task());
    GeminiService.geminiChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  /** When Gemini is unavailable or rate-limited, turn OpenFoodFacts-style text into a comma list. */
  static ingredientsTextToCommaList(ingredientsText: string): string {
    const parts = ingredientsText
      .split(/[,;]|(?:\s+and\s+)/i)
      .map(s => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(s => s.length > 0 && s.length < 200);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const p of parts) {
      const key = p.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }
    return unique.join(', ');
  }

  private static callGeminiAPI(
    prompt: string,
    systemMessage?: string,
    temperature: number = 0.1,
    maxOutputTokens: number = 4000
  ): Promise<string> {
    assertApiKey();

    const fullPrompt = systemMessage ? `${systemMessage}\n\n${prompt}` : prompt;

    return GeminiService.enqueueGeminiTask(async () => {
      for (let attempt = 0; attempt <= GEMINI_429_RETRIES; attempt++) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;
        if (timeSinceLastCall < MIN_INTERVAL) {
          await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - timeSinceLastCall));
        }
        lastCallTime = Date.now();

        const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY!)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens,
            },
          }),
        });

        if (response.status === 429 && attempt < GEMINI_429_RETRIES) {
          const waitMs = GEMINI_429_BASE_MS * Math.pow(2, attempt);
          console.warn(`Gemini 429; retrying in ${waitMs}ms (attempt ${attempt + 1}/${GEMINI_429_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
          }
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return extractTextFromGeminiResponse(data);
      }

      throw new Error('API rate limit exceeded. Please try again later.');
    });
  }

  static async analyzeIngredient(ingredient: string, allergen: any): Promise<string> {
    const prompt = `Analyze the potential allergenic properties of "${ingredient}" based on the following data:

Frequency: ${allergen.frequency} occurrences
Average Severity: ${allergen.averageSeverity.toFixed(1)}/10
Symptoms: ${allergen.symptoms.join(', ') || 'None'}
Environmental Notes: ${allergen.environmentalNotes.join(', ') || 'None'}

Provide a concise medical analysis covering:
1. Likelihood of this being a true allergen
2. Severity assessment based on the user's data
3. Medical recommendations for management

Keep the response professional and medically focused.`;

    return this.callGeminiAPI(
      prompt,
      'You are a medical allergy specialist. Provide concise, professional medical analysis of potential allergens.',
      0.3,
      300
    );
  }

  static async analyzeRiskLevel(ingredient: string): Promise<number> {
    const prompt = `Analyze the inherent allergenic risk level of "${ingredient}" as a food ingredient. Consider:

1. How commonly this ingredient causes allergic reactions
2. The typical severity of reactions to this ingredient
3. Whether it's a known major allergen (like peanuts, tree nuts, shellfish, etc.)
4. Cross-reactivity potential with other allergens

Based on this analysis, provide a risk level score from 0-100 where:
- 0-20: Very Low Risk (rarely causes allergies)
- 21-40: Low Risk (occasionally causes mild reactions)
- 41-60: Moderate Risk (moderately allergenic)
- 61-80: High Risk (commonly causes reactions)
- 81-100: Very High Risk (major allergen, severe reactions common)

Respond with ONLY the numerical score (0-100), no other text.`;

    const response = await this.callGeminiAPI(
      prompt,
      'You are a medical allergy specialist. Analyze allergen risk levels and respond with only a numerical score from 0-100.',
      0.1,
      32
    );

    const riskLevel = parseInt(response.trim().replace(/[^\d]/g, ''), 10);
    if (!isNaN(riskLevel) && riskLevel >= 0 && riskLevel <= 100) return riskLevel;
    throw new Error('Invalid risk level response');
  }

  /** One API call for many ingredients (avoids N parallel requests from Analysis). */
  static async analyzeRiskLevelsBatch(ingredients: string[]): Promise<number[]> {
    const names = ingredients.map(s => String(s).trim()).filter(Boolean);
    if (names.length === 0) return [];

    const list = names.map((ing, i) => `${i + 1}. ${ing}`).join('\n');
    const prompt = `For each food ingredient below, estimate inherent allergenic risk as an integer from 0-100 (0 = very low, 100 = major allergen / severe risk common). Use clinical/epidemiological priors, not this user's history.

${list}

Respond with ONLY a JSON array of exactly ${names.length} integers in the same order, e.g. [12, 45, 80]. No markdown fences, no explanation.`;

    const response = await this.callGeminiAPI(
      prompt,
      'You reply with only a JSON array of integers.',
      0.1,
      800
    );

    const parseArray = (text: string): number[] => {
      const t = text.trim();
      const start = t.indexOf('[');
      const end = t.lastIndexOf(']');
      if (start === -1 || end <= start) return [];
      try {
        const raw = JSON.parse(t.slice(start, end + 1));
        if (!Array.isArray(raw)) return [];
        return raw.map((x: unknown) => {
          const n = parseInt(String(x).replace(/[^\d-]/g, ''), 10);
          return isNaN(n) ? NaN : Math.min(100, Math.max(0, n));
        });
      } catch {
        return [];
      }
    };

    let scores = parseArray(response);
    while (scores.length < names.length) scores.push(50);
    scores = scores.slice(0, names.length);
    return scores.map(s => (typeof s === 'number' && !isNaN(s) ? s : 50));
  }

  static async generateOverallSummary(topAllergens: any[], logsLength: number): Promise<string> {
    const prompt = `Based on the following allergy data, provide a concise overall summary (2-3 sentences) of the user's allergy patterns:

Top Allergens:
${topAllergens
  .map(
    (allergen: any, idx: number) =>
      `${idx + 1}. ${allergen.ingredient} (Frequency: ${allergen.frequency}, Avg Severity: ${allergen.averageSeverity.toFixed(
        1
      )}/10, Symptoms: ${allergen.symptoms.join(', ') || 'None'})`
  )
  .join('\n')}

Total Logs Analyzed: ${logsLength}

Provide a clear, medical-focused summary that highlights the most important patterns and concerns. Focus on the most frequent allergens and their severity levels.`;

    return this.callGeminiAPI(
      prompt,
      'You are a medical allergy specialist. Provide concise, professional summaries focused on the most important allergy patterns.',
      0.3,
      300
    );
  }

  static async generateTestKitSuggestions(topAllergens: any[]): Promise<string> {
    const prompt = `Based on the following allergy data, suggest exactly 5 specific allergy test kits that would be most appropriate for this user:

Top Allergens (Most Likely Allergens):
${topAllergens
  .map((allergen: any, idx: number) => `${idx + 1}. ${allergen.ingredient} (Frequency: ${allergen.frequency}, Avg Severity: ${allergen.averageSeverity.toFixed(1)}/10)`)
  .join('\n')}

Return ONLY the names of exactly 5 specific test kits with brand names. Do not include any explanations, descriptions, or asterisks. Format as a simple numbered list (1-5) with just the test kit names.`;

    return this.callGeminiAPI(
      prompt,
      'You are a medical allergy specialist. Return ONLY the names of exactly 5 specific test kits with brand names. No explanations, descriptions, or asterisks. Just a numbered list of test kit names.',
      0.3,
      350
    );
  }

  static async analyzeClinicalSymptoms(symptoms: string[], symptomDesc: string, timeSinceCondition: string): Promise<string> {
    const prompt = `Analyze these symptoms in 5-6 sentences using medical terminology: ${symptoms.join(', ')}. Description: ${symptomDesc}. Time since onset: ${timeSinceCondition}. Focus on the clinical features, possible mechanisms, and differential diagnosis.`;

    return this.callGeminiAPI(
      prompt,
      'You are a board-certified allergist. Provide a thorough, medically accurate analysis of the symptoms using appropriate medical terminology. Focus on describing the clinical presentation, possible pathophysiological mechanisms, and differential diagnosis. Do not provide treatment advice or urgency assessment. Your response should be clear, professional, and about 5-6 sentences long.',
      0.7,
      350
    );
  }

  static async extractIngredients(ingredientsText: string): Promise<string> {
    const trimmed = ingredientsText?.trim() ?? '';
    if (!trimmed) return '';

    try {
      const ai = await this.callGeminiAPI(
        trimmed,
        `You are an expert at extracting food ingredients from product labels and barcode databases. Given the following text, extract only the most structured, quantified, or English ingredient list. If any ingredient is in a different language, translate it to English. Output ONLY the ingredient list itself, with NO introductory, explanatory, or summary sentences. The output must be a single, comma-separated list, with NO duplicate or overlapping items. If there are no ingredients, return nothing.`,
        0.2,
        250
      );
      const cleaned = ai.trim();
      if (cleaned) return cleaned;
    } catch (e) {
      console.warn('Gemini extractIngredients failed; using local parse.', e);
    }

    return this.ingredientsTextToCommaList(trimmed);
  }

  static async analyzeLogIngredients(
    logId: string,
    ingredients: string[],
    symptoms: string[],
    severity: number,
    environmentalCause?: string
  ): Promise<AllergenAnalysis> {
    const prompt = `
Analyze the following allergy log entry and identify potential allergens:

Log ID: ${logId}
Ingredients consumed: ${ingredients.join(', ')}
Symptoms experienced: ${symptoms.join(', ')}
Symptom severity (1-10): ${severity}
Environmental factors: ${environmentalCause || 'None'}

Please identify which ingredients are potential allergens and provide a risk score for each (0.0 to 1.0).

Respond with ONLY a valid JSON object in this exact format:
{
  "log_id": "${logId}",
  "likely_allergens": ["ingredient1", "ingredient2"],
  "allergen_risk_score": {
    "ingredient1": 0.8,
    "ingredient2": 0.4
  }
}
`;

    try {
      const response = await this.callGeminiAPI(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return analysis;
    } catch {
      return { log_id: logId, likely_allergens: [], allergen_risk_score: {} };
    }
  }

  static async generateFinalReport(allergenAnalyses: AllergenAnalysis[], logs: any[]): Promise<AllergenReport> {
    const prompt = `
Based on the following allergen analyses from multiple allergy logs, create a comprehensive risk assessment and ranking:

Allergen Analyses: ${JSON.stringify(allergenAnalyses, null, 2)}

Total Logs: ${logs.length}

Respond with ONLY a valid JSON object in this exact format:
{
  "rankings": [
    {
      "allergen": "peanut",
      "risk_score": 85,
      "frequency": 5,
      "severity_correlation": 0.8,
      "risk_category": "High",
      "explanation": "Appeared in 5 logs with high severity correlation",
      "recommendation": "Consider allergy testing"
    }
  ],
  "total_logs_analyzed": ${logs.length},
  "summary": "Overall assessment summary",
  "next_steps": {
    "test_kits": ["Everlywell Food Allergy Test", "myLAB Box Food Allergy Test"],
    "medical_advice": "Consult with an allergist for professional testing"
  }
}
`;

    try {
      const response = await this.callGeminiAPI(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const report = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return report;
    } catch {
      return {
        rankings: [],
        total_logs_analyzed: logs.length,
        summary: 'Analysis could not be completed',
        next_steps: { test_kits: [], medical_advice: 'Please consult with a healthcare provider' },
      };
    }
  }

  static async generateChatbotResponse(
    userMessage: string,
    logs: any[],
    localAllergens: any[],
    overallSummary: string,
    testKitSuggestions: string
  ): Promise<string> {
    const logsSummary = logs.map(log => ({
      time: log.time,
      severity: log.severity,
      symptoms: log.symptoms,
      products: log.products?.map((p: any) => p.name).join(', ') || 'None',
      environmentalCause: log.environmentalCause || 'None',
    }));

    const allergensSummary = localAllergens.map(allergen => ({
      ingredient: allergen.ingredient,
      frequency: allergen.frequency,
      averageSeverity: allergen.averageSeverity,
      symptoms: allergen.symptoms,
    }));

    const prompt = `You are an AI allergy assistant with access to the user's allergy data. Respond to their question in a helpful, informative, and conversational manner.

User's Question: "${userMessage}"

User's Allergy Data:
- Total Logs: ${logs.length}
- Overall Summary: ${overallSummary}
- Top Allergens: ${allergensSummary.map(a => `${a.ingredient} (freq: ${a.frequency}, avg severity: ${a.averageSeverity.toFixed(1)})`).join(', ')}
- Recent Logs: ${logsSummary.slice(-3).map(log => `${log.time}: ${log.symptoms.join(', ')} (severity: ${log.severity})`).join('; ')}
- Test Kit Recommendations: ${testKitSuggestions}`;

    return this.callGeminiAPI(
      prompt,
      "You are a helpful AI allergy assistant. Provide informative, personalized responses based on the user's allergy data. Be conversational, supportive, and accurate.",
      0.7,
      350
    );
  }
}

