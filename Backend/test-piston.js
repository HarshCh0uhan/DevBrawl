#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// DevBrawl - Piston Integration Test
// Run: node test-piston.js
// ──────────────────────────────────────────────────────────────────────────────

import { executeCode, executeAgainstTestCases, checkPistonHealth, getSupportedRuntimes } from "./src/utils/pistonExecutor.js";

const TEST_CODE = {
  63: `// JavaScript
function add(a, b) { return a + b; }
console.log(add(2, 3));`,
  71: `# Python
def add(a, b): return a + b
print(add(2, 3))`,
  62: `// Java
public class Main {
    public static int add(int a, int b) { return a + b; }
    public static void main(String[] args) { System.out.println(add(2, 3)); }
}`,
  54: `// C++
#include <iostream>
int add(int a, int b) { return a + b; }
int main() { std::cout << add(2, 3) << std::endl; return 0; }`,
  60: `// Go
package main
import "fmt"
func add(a, b int) int { return a + b }
func main() { fmt.Println(add(2, 3)) }`,
  73: `// Rust
fn add(a: i32, b: i32) -> i32 { a + b }
fn main() { println!("{}", add(2, 3)); }`,
};

const TEST_CASES = [
  { input: "2 3", expectedOutput: "5" },
  { input: "10 20", expectedOutput: "30" },
  { input: "-5 5", expectedOutput: "0" },
];

async function runTests() {
  console.log("🧪 Testing Piston Integration\n");

  // Health check
  console.log("1. Health Check...");
  const healthy = await checkPistonHealth();
  console.log(`   Piston: ${healthy ? "✅ Healthy" : "❌ Unreachable"}\n`);

  // List runtimes
  console.log("2. Supported Runtimes...");
  try {
    const runtimes = await getSupportedRuntimes();
    console.log(`   Found ${runtimes.length} runtimes`);
    runtimes.slice(0, 10).forEach(r => console.log(`   - ${r.language} ${r.version}`));
    if (runtimes.length > 10) console.log(`   ... and ${runtimes.length - 10} more`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }
  console.log("");

  // Test each language
  console.log("3. Language Execution Tests...\n");
  for (const [langId, code] of Object.entries(TEST_CODE)) {
    const langNames = { 63: "JavaScript", 71: "Python", 62: "Java", 54: "C++", 60: "Go", 73: "Rust" };
    const name = langNames[langId] || `ID ${langId}`;
    
    try {
      console.log(`   Testing ${name}...`);
      const result = await executeCode(code, parseInt(langId));
      
      if (result.compilationFailed) {
        console.log(`   ❌ Compilation failed: ${result.stderr}`);
      } else if (result.timedOut) {
        console.log(`   ⏱️  Timed out`);
      } else if (result.code !== 0) {
        console.log(`   ❌ Runtime error (code ${result.code}): ${result.stderr}`);
      } else {
        console.log(`   ✅ Output: ${result.stdout.trim()}`);
        console.log(`      Time: ${result.executionTimeMs}ms`);
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
    console.log("");
  }

  // Test multiple test cases
  console.log("4. Multiple Test Cases (JavaScript)...");
  try {
    const results = await executeAgainstTestCases(TEST_CODE[63], 63, TEST_CASES);
    results.forEach((r, i) => {
      const status = r.compilationFailed ? "Compile Error" : 
                     r.timedOut ? "TLE" : 
                     r.code !== 0 ? "Runtime Error" : "OK";
      console.log(`   Test ${i + 1}: ${status} (${r.executionTimeMs}ms)`);
    });
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  console.log("\n✅ All tests completed!");
}

runTests().catch(console.error);