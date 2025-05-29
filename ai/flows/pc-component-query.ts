
'use server';

/**
 * @fileOverview An AI assistant for answering student queries about PC components, compatibility, and troubleshooting.
 *
 * - pcComponentQuery - A function that handles student queries related to PC components.
 * - PcComponentQueryInput - The input type for the pcComponentQuery function.
 * - PcComponentQueryOutput - The return type for the pcComponentQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PcComponentQueryInputSchema = z.object({
  query: z.string().describe('The query from the student regarding PC components, compatibility, or troubleshooting.'),
});
export type PcComponentQueryInput = z.infer<typeof PcComponentQueryInputSchema>;

const PcComponentQueryOutputSchema = z.object({
  answer: z.string().describe('The answer to the student query.'),
});
export type PcComponentQueryOutput = z.infer<typeof PcComponentQueryOutputSchema>;

export async function pcComponentQuery(input: PcComponentQueryInput): Promise<PcComponentQueryOutput> {
  return pcComponentQueryFlow(input);
}

const pcComponentQueryPrompt = ai.definePrompt({
  name: 'pcComponentQueryPrompt',
  input: {schema: PcComponentQueryInputSchema},
  output: {schema: PcComponentQueryOutputSchema},
  prompt: `You are a helpful AI assistant for students learning about PC building. Answer the following question regarding PC components, compatibility, or troubleshooting in Traditional Chinese:

{{{query}}}`,
});

const pcComponentQueryFlow = ai.defineFlow(
  {
    name: 'pcComponentQueryFlow',
    inputSchema: PcComponentQueryInputSchema,
    outputSchema: PcComponentQueryOutputSchema,
  },
  async input => {
    const {output} = await pcComponentQueryPrompt(input);
    if (!output) {
      return { answer: '抱歉，AI 暫時無法回答您的問題，請稍後再試。' };
    }
    return output;
  }
);
