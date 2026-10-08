#!/usr/bin/env node
// Test script to check which Groq models are available for your API key

import 'dotenv/config';
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testModels() {
  console.log('🔍 Testing Groq API key and available models...\n');
  console.log('API Key:', process.env.GROQ_API_KEY?.startsWith('gsk_') ? '✅ Valid format' : '❌ Invalid format');
  console.log('');

  try {
    // List all models
    console.log('📋 Fetching available models from Groq...');
    const response = await groq.models.list();
    const models = response.data.map(m => m.id);
    
    console.log(`\n✅ Found ${models.length} available models:\n`);
    models.forEach(m => console.log(`  - ${m}`));
    
    // Test each model with a simple request
    console.log('\n🧪 Testing each model with a simple request...\n');
    
    for (const model of models) {
      try {
        const result = await groq.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'Say "OK"' }],
          max_tokens: 10,
        });
        console.log(`  ✅ ${model} - WORKS`);
      } catch (e) {
        console.log(`  ❌ ${model} - FAILED: ${e.message?.split('\n')[0]}`);
      }
    }
    
  } catch (e) {
    console.error('❌ Failed to list models:', e.message);
  }
}

testModels();