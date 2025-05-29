
'use server';

/**
 * @fileOverview An AI assistant for analyzing PC configurations.
 *
 * - analyzePcConfiguration - A function that takes a PC configuration and returns an AI-generated analysis.
 * - PcConfigAnalyzerInput - The input type for the analyzePcConfiguration function.
 * - PcConfigAnalyzerOutput - The return type for the analyzePcConfiguration function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PcConfigAnalyzerInputSchema = z.object({
  pcConfig: z.string().describe('使用者提供的電腦零組件和配置的文本描述。'),
});
export type PcConfigAnalyzerInput = z.infer<typeof PcConfigAnalyzerInputSchema>;

const PcConfigAnalyzerOutputSchema = z.object({
  isPcRelated: z.boolean().describe('指出輸入的文本是否與電腦零組件或配置相關。'),
  analysis: z.string().describe('AI對電腦配置的分析，包括相容性檢查、瓶頸識別和改進建議（如果相關）。如果不相關，則為一條禮貌的中文訊息。所有分析均以繁體中文提供。'),
});
export type PcConfigAnalyzerOutput = z.infer<typeof PcConfigAnalyzerOutputSchema>;

export async function analyzePcConfiguration(input: PcConfigAnalyzerInput): Promise<PcConfigAnalyzerOutput> {
  return pcConfigAnalyzerFlow(input);
}

const pcConfigAnalyzerPrompt = ai.definePrompt({
  name: 'pcConfigAnalyzerPrompt',
  input: { schema: PcConfigAnalyzerInputSchema },
  output: { schema: PcConfigAnalyzerOutputSchema },
  prompt: `你是一位專門分析電腦硬體配置的 AI 專家。請仔細分析使用者提供的文本，並以【繁體中文】回答。

任務指示：
1.  首先，判斷使用者輸入的文本是否與電腦零組件、PC配置或相關技術有關。
    *   如果文本與電腦配置無關，請將 'isPcRelated' 設為 false，並在 'analysis' 欄位提供一條禮貌的中文訊息，例如：「抱歉，我主要協助分析電腦配置。您提供的內容似乎與此無關，請嘗試提供您的電腦零組件清單或相關問題。」
    *   如果文本與電腦配置相關，請將 'isPcRelated' 設為 true，然後繼續執行以下分析。

2.  如果 'isPcRelated' 為 true，請對提供的電腦配置進行全面分析：
    *   檢查零組件之間的潛在相容性問題（例如 CPU 插槽與主機板、RAM 類型與主機板、PSU 瓦數與零組件功耗）。
    *   找出潛在的效能瓶頸（例如，高階 GPU 搭配低階 CPU，或記憶體不足以應對高負載任務）。
    *   如果適用，請提出改進建議或替代零組件，並考慮性價比和效能。例如，如果使用者選擇了對於已鎖定 CPU 而言過於昂貴的主機板，請建議一個更合適的。
    *   如果配置均衡良好，請予以肯定。
    *   提供清晰、簡潔且易於理解的分析。如果適用，請使用項目符號或編號列表來呈現建議。

使用者輸入的文本：
\`\`\`
{{{pcConfig}}}
\`\`\`

開始你的分析：`,
});

const pcConfigAnalyzerFlow = ai.defineFlow(
  {
    name: 'pcConfigAnalyzerFlow',
    inputSchema: PcConfigAnalyzerInputSchema,
    outputSchema: PcConfigAnalyzerOutputSchema,
  },
  async (input: PcConfigAnalyzerInput) => {
    const { output } = await pcConfigAnalyzerPrompt(input);
    if (!output) {
      // This case should ideally be handled by the prompt returning isPcRelated: false
      // But as a fallback, return a generic error.
      return {
        isPcRelated: false,
        analysis: '抱歉，分析時發生未預期的錯誤，請稍後再試。',
      };
    }
    return output;
  }
);
