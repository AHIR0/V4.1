
'use server';
/**
 * @fileOverview An AI agent for generating explanations for quiz questions.
 *
 * - generateQuizExplanation - A function that generates an explanation for a given quiz question.
 * - QuizExplanationInput - The input type for the generateQuizExplanation function.
 * - QuizExplanationOutput - The return type for the generateQuizExplanation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuizOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const QuizExplanationInputSchema = z.object({
  questionText: z.string().describe('The text of the quiz question.'),
  options: z.array(QuizOptionSchema).describe('An array of possible answers for the question.'),
  correctOptionId: z.string().describe('The ID of the correct option.'),
});
export type QuizExplanationInput = z.infer<typeof QuizExplanationInputSchema>;

const QuizExplanationOutputSchema = z.object({
  explanation: z.string().describe('A detailed explanation of why the correct answer is correct, in Traditional Chinese.'),
});
export type QuizExplanationOutput = z.infer<typeof QuizExplanationOutputSchema>;

export async function generateQuizExplanation(input: QuizExplanationInput): Promise<QuizExplanationOutput> {
  return quizExplanationFlow(input);
}

const quizExplanationPrompt = ai.definePrompt({
  name: 'quizExplanationPrompt',
  input: {schema: QuizExplanationInputSchema},
  output: {schema: QuizExplanationOutputSchema},
  prompt: `你是一位電腦組裝專家與教育者。請針對以下選擇題，提供一個清晰且易於理解的詳盡解釋，說明為什麼正確答案是正確的。請以【繁體中文】回答。

題目：{{{questionText}}}

選項：
{{#each options}}
- {{{this.text}}} (ID: {{{this.id}}})
{{/each}}

正確答案的 ID 是：{{{correctOptionId}}}

請解釋為什麼 ID 為 {{{correctOptionId}}} 的選項是正確的。如果適用，可以簡要說明其他選項為何不正確。你的解釋應該有助於學習者理解相關概念。`,
});

const quizExplanationFlow = ai.defineFlow(
  {
    name: 'quizExplanationFlow',
    inputSchema: QuizExplanationInputSchema,
    outputSchema: QuizExplanationOutputSchema,
  },
  async (input: QuizExplanationInput) => {
    // Find the correct option text to potentially include it directly if needed, though the prompt relies on ID.
    // const correctOption = input.options.find(opt => opt.id === input.correctOptionId);
    // const correctOptionText = correctOption ? correctOption.text : '未知（ID對應選項不存在）';

    const {output} = await quizExplanationPrompt(input);
    if (!output) {
      return { explanation: '抱歉，AI 暫時無法提供此題的詳解，請稍後再試。' };
    }
    return output;
  }
);

