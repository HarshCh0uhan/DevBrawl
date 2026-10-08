#!/usr/bin/env node
// Test OpenRouter with Nemotron 3 Ultra

import 'dotenv/config';
import { generateStructuredJSON, isOpenRouterAvailable, listAvailableModels } from '../Backend/src/utils/openrouter.js';

async function testOpenRouter() {
  console.log('🔮 Testing OpenRouter (Nemotron 3 Ultra)...\n');
  console.log('Available:', isOpenRouterAvailable() ? '✅ Yes' : '❌ No - need OPENROUTER_API_KEY');
  
  if (!isOpenRouterAvailable()) {
    console.log('\n📝 Get your free key from: https://openrouter.ai/keys');
    console.log('Model: nvidia/nemotron-3-ultra:free');
    return;
  }

  // List available models
  console.log('\n📋 Fetching available models...');
  const models = await listAvailableModels();
  console.log(`Found ${models.length} models`);
  models.filter(m => m.includes('nemotron') || m.includes('nvidia')).forEach(m => console.log(`  - ${m}`));

  // Test question generation
  console.log('\n🧪 Testing question generation...');
  try {
    const result = await generateStructuredJSON({
      systemPrompt: 'You are a strict technical problem writer.',
      userPrompt: 'Generate an easy array problem. Return JSON with title, promptLines, constraintsLines, timeLimitMs, testCases.',
      temperature: 0.1,
    });
    console.log('✅ SUCCESS:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ ERROR:', e.message);
  }
}

testOpenRouter();