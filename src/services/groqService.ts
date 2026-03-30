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

// NOTE: Groq has been replaced with Gemini.
// This file is kept temporarily to avoid breaking older imports; new code should use `GeminiService`.
export class GroqService {
  private static notSupported(): never {
    throw new Error('Groq has been replaced with Gemini. Update imports to use GeminiService.');
  }

  // Method for analyzing individual ingredients
  static async analyzeIngredient(ingredient: string, allergen: any): Promise<string> {
    return this.notSupported();
  }

  // Method for analyzing risk levels
  static async analyzeRiskLevel(ingredient: string): Promise<number> {
    return this.notSupported();
  }

  // Method for generating overall summary
  static async generateOverallSummary(topAllergens: any[], logsLength: number): Promise<string> {
    return this.notSupported();
  }

  // Method for generating test kit suggestions
  static async generateTestKitSuggestions(topAllergens: any[]): Promise<string> {
    return this.notSupported();
  }

  // Method for clinical symptom analysis
  static async analyzeClinicalSymptoms(symptoms: string[], symptomDesc: string, timeSinceCondition: string): Promise<string> {
    return this.notSupported();
  }

  // Method for extracting ingredients from text
  static async extractIngredients(ingredientsText: string): Promise<string> {
    return this.notSupported();
  }

  static async analyzeLogIngredients(
    logId: string,
    ingredients: string[],
    symptoms: string[],
    severity: number,
    environmentalCause?: string
  ): Promise<AllergenAnalysis> {
    return this.notSupported();
  }

  static async generateFinalReport(
    allergenAnalyses: AllergenAnalysis[],
    logs: any[]
  ): Promise<AllergenReport> {
    return this.notSupported();
  }

  // Method for chatbot responses
  static async generateChatbotResponse(
    userMessage: string,
    logs: any[],
    localAllergens: any[],
    overallSummary: string,
    testKitSuggestions: string
  ): Promise<string> {
    return this.notSupported();
  }
} 
