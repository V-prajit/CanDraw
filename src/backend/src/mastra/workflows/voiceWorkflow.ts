

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { chatWorkflow } from './chatWorkflow';
import { VoiceInputSchema, VoiceOutputSchema } from './voiceWorkflowTypes';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const processVoice = createStep({
  id: 'processVoice',
  description: 'Transcribes audio, gets a response from the chat agent, and synthesizes the response to audio',
  inputSchema: VoiceInputSchema,
  outputSchema: VoiceOutputSchema,
  execute: async ({ inputData }) => {
    const { audio, threadId, resourceId } = inputData;

    // 1. Transcribe audio to text
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audio as any,
    });

    console.log(transcription.text)

    // 2. Get a response from the chat agent
    const run = await chatWorkflow.createRunAsync();
    const result = await run.start({
      inputData: {
        prompt: transcription.text,
        threadId,
        resourceId,
      },
    });

    if (result.status !== 'success') {
      throw new Error(`Chat workflow failed: ${result.status}`);
    }

    const responseText = result.result.content;

    // 3. Synthesize the response text to audio
    const responseAudio = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: responseText,
      speed: 1.15,
    });

    return {
      audio: responseAudio.body,
      transcription: transcription.text,
      responseText,
    };
  },
});

export const voiceWorkflow = createWorkflow({
  id: 'voiceWorkflow',
  description: 'Handles voice interactions by transcribing, processing, and synthesizing speech',
  inputSchema: VoiceInputSchema,
  outputSchema: VoiceOutputSchema,
})
  .then(processVoice)
  .commit();

