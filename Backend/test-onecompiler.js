#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// DevBrawl - OneCompiler Regression Test
// Run: npm run test:executor  (or: node test-onecompiler.js)
// ──────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { executeCode, executeAgainstTestCases } from './src/utils/oneCompilerExecutor.js';

const TEST_CODE = {
  63: `// JavaScript\nconsole.log(1 + 1);`,
  71: `# Python\nprint(1 + 1)`,
};

const TEST_CASES = [
  { input: "", expectedOutput: "2" },
  { input: "", expectedOutput: "2" },
];

let allPassed = true;

async function testLanguage(langId, code, name) {
  try {
    console.log(`Testing ${name} (langId ${langId})...`);
    const result = await executeCode(code, langId);

    if (result.compilationFailed) {
      console.log(`  ❌ FAIL: Compilation error - ${result.stderr}`);
      return false;
    }
    if (result.timedOut) {
      console.log(`  ❌ FAIL: Timed out`);
      return false;
    }
    if (result.code !== 0) {
      console.log(`  ❌ FAIL: Runtime error (code ${result.code}) - ${result.stderr}`);
      return false;
    }
    if (!result.stdout.trim().includes('2')) {
      console.log(`  ❌ FAIL: Expected stdout to contain "2", got: "${result.stdout.trim()}"`);
      return false;
    }

    console.log(`  ✅ PASS: stdout="${result.stdout.trim()}", time=${result.executionTimeMs}ms`);
    return true;
  } catch (e) {
    console.log(`  ❌ FAIL: Exception - ${e.message}`);
    return false;
  }
}

async function testMultipleCases(langId, code, name) {
  try {
    console.log(`Testing ${name} multiple test cases...`);
    const results = await executeAgainstTestCases(code, langId, TEST_CASES);

    let passed = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.compilationFailed) {
        console.log(`  Case ${i + 1}: ❌ Compile error - ${r.stderr}`);
      } else if (r.timedOut) {
        console.log(`  Case ${i + 1}: ❌ Timed out`);
      } else if (r.code !== 0) {
        console.log(`  Case ${i + 1}: ❌ Runtime error - ${r.stderr}`);
      } else if (r.stdout.trim() === '2') {
        console.log(`  Case ${i + 1}: ✅ PASS (${r.executionTimeMs}ms)`);
        passed++;
      } else {
        console.log(`  Case ${i + 1}: ❌ Wrong output: "${r.stdout.trim()}"`);
      }
    }

    if (passed === TEST_CASES.length) {
      console.log(`  ✅ All ${passed} cases passed`);
      return true;
    } else {
      console.log(`  ❌ ${passed}/${TEST_CASES.length} cases passed`);
      return false;
    }
  } catch (e) {
    console.log(`  ❌ FAIL: Exception - ${e.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 OneCompiler Regression Test\n');

  // Test single execution for each language
  for (const [langId, code] of Object.entries(TEST_CODE)) {
    const name = langId === '63' ? 'JavaScript' : 'Python';
    const ok = await testLanguage(parseInt(langId), code, name);
    allPassed = allPassed && ok;
    console.log('');
  }

  // Test multiple test cases (JavaScript only, to save quota)
  const ok = await testMultipleCases(63, TEST_CODE[63], 'JavaScript');
  allPassed = allPassed && ok;

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('❌ UNHANDLED ERROR:', e);
  process.exit(1);
});