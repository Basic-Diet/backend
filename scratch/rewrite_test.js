const fs = require('fs');
const content = fs.readFileSync('tests/branchPickupMealWalletSlotAppendPayment.test.js', 'utf8');

// Find all tests before the one we want and replace `await test(` with `// await test(`
let newContent = content;
const testStart = newContent.indexOf('await test("pickup availability exposes normalized pickupItems, sections, and dayAddons"');

if (testStart !== -1) {
  let before = newContent.substring(0, testStart);
  let after = newContent.substring(testStart);
  
  before = before.replace(/await test\(/g, '// await test(');
  
  // Add process.exit(0) after JSON CONTRACT END
  after = after.replace('console.log("=== JSON CONTRACT END ===");', 'console.log("=== JSON CONTRACT END ===");\n      process.exit(0);');
  
  fs.writeFileSync('scratch/fast_test.js', before + after);
}
