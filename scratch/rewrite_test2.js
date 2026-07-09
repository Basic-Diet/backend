const fs = require('fs');
const lines = fs.readFileSync('tests/branchPickupMealWalletSlotAppendPayment.test.js', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('await test("slot-based pickup request'));
const endIdx = lines.findIndex(l => l.includes('await test("pickup availability exposes normalized pickupItems'));

const newLines = [
  ...lines.slice(0, startIdx),
  ...lines.slice(endIdx)
];

const finalStr = newLines.join('\n').replace(
  'console.log("=== JSON CONTRACT END ===");',
  'console.log("=== JSON CONTRACT END ===");\n      process.exit(0);'
);

fs.writeFileSync('scratch/fast_test2.js', finalStr);
