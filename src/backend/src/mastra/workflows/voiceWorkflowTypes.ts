
import { z } from 'zod';

export const VoiceInputSchema = z.object({
  audio: z.any().describe('The audio file to transcribe'),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
});

export const VoiceOutputSchema = z.object({
  audio: z.any().describe('The synthesized audio response'),
  transcription: z.string(),
  responseText: z.string(),
});

export type VoiceInput = z.infer<typeof VoiceInputSchema>;
export type VoiceOutput = z.infer<typeof VoiceOutputSchema>;
