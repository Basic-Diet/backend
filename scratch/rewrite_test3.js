const fs = require('fs');
const content = fs.readFileSync('tests/branchPickupMealWalletSlotAppendPayment.test.js', 'utf8');

const firstTestStr = 'await test("slot-based pickup request reserves selected slot only"';
const targetTestStr = 'await test("pickup availability exposes normalized pickupItems, sections, and dayAddons"';

const startIdx = content.indexOf(firstTestStr);
const endIdx = content.indexOf(targetTestStr);

let newContent = content.substring(0, startIdx) + content.substring(endIdx);

// Add the JSON output logic
const jsonOutputLogic = `
      require("fs").writeFileSync("scratch/actual_json.json", JSON.stringify(data, null, 2));
      console.log("JSON successfully written to scratch/actual_json.json");
      process.exit(0);
`;

newContent = newContent.replace(
  'assert(Array.isArray(data.pickupItems), "pickupItems should be present");',
  jsonOutputLogic
);

fs.writeFileSync('tests/branchPickupMealWalletSlotAppendPayment.test.js', newContent);
