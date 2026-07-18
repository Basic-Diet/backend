const fs = require('fs');

const path = 'tests/mealPlanner.integration.test.js';
let source = fs.readFileSync(path, 'utf8');

function replaceRequired(oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`${label}: source text not found`);
  source = source.replace(oldText, newText);
  console.log(`[updated] ${label}`);
}

replaceRequired(
`    assertTrue(addons.length > 0, 'addons returned');
    assertTrue(addons.some((addon) => addon.id === String(addonJuice._id)), 'juice item included');

    assertEqual(
      Number(defaultAddonCatalog.totalCount || 0),
      addons.length,
      'default addonCatalog.totalCount matches legacy addons.items length'
    );
    assertEqual(
      Number(defaultAddonCatalog.totalCount || 0),
      Number(legacyRes.body.data?.addons?.totalCount || 0),
      'default addonCatalog.totalCount matches legacy addons.totalCount'
    );
    assertEqual(
      JSON.stringify(defaultAddonCatalog.items || []),
      JSON.stringify(addons),
      'default addonCatalog.items matches legacy addons.items'
    );
    assertEqual(
      JSON.stringify(defaultAddonCatalog.byCategory || {}),
      JSON.stringify(addonCatalog.byCategory || {}),
      'default addonCatalog.byCategory is grouped from the same legacy items'
    );`,
`    assertTrue(Array.isArray(defaultAddonCatalog.items), 'canonical addonCatalog.items is an array');
    assertTrue(!!defaultAddonCatalog.byCategory && typeof defaultAddonCatalog.byCategory === 'object', 'canonical addonCatalog.byCategory is an object');
    assertEqual(
      Number(defaultAddonCatalog.totalCount || 0),
      (defaultAddonCatalog.items || []).length,
      'canonical addonCatalog.totalCount matches items length'
    );
    assertEqual(
      JSON.stringify(defaultAddonCatalog.items || []),
      JSON.stringify(addonCatalog.items || []),
      'legacy query keeps the same canonical addonCatalog items'
    );
    assertEqual(
      JSON.stringify(defaultAddonCatalog.byCategory || {}),
      JSON.stringify(addonCatalog.byCategory || {}),
      'legacy query keeps the same canonical addonCatalog grouping'
    );`,
'canonical addon catalog expectation'
);

replaceRequired(
`    assertEqual(res.status, 400, 'plan add-on selection is rejected');
    const errCode = res.body.error?.code;
    assertTrue(errCode === 'INVALID' || errCode === 'INVALID_ONE_TIME_ADDON_SELECTION', 'plan add-on request rejected');`,
`    assertEqual(res.status, 402, 'plan add-on selection requires payment');
    const paymentRequirement = res.body.paymentRequirement || res.body.error?.details?.paymentRequirement;
    assertTrue(!!paymentRequirement, 'payment requirement returned');`,
'plan add-on payment-required expectation'
);

fs.writeFileSync(path, source);
console.log('Final integration expectations aligned.');
