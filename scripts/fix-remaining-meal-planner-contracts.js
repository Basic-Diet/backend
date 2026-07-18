const fs = require('fs');

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path, after);
  console.log(`[updated] ${path}`);
}

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`${label}: source text not found`);
  console.log(`[replace] ${label}`);
  return source.replace(search, replacement);
}

update('src/services/catalog/CatalogService.js', (input) => {
  let output = input;

  output = replaceRequired(
    output,
`function buildV3ProductPayload(product, lang, overrides = {}) {
  return sanitizeObject({
    id: String(product._id),`,
`function buildV3ProductPayload(product, lang, overrides = {}) {
  const pricing = buildV3PricingPayload(product, overrides.pricing || {});
  return sanitizeObject({
    id: String(product._id),`,
    'compute v3 pricing once'
  );

  output = replaceRequired(
    output,
`    pricing: buildV3PricingPayload(product, overrides.pricing || {}),
    nutrition: buildNutritionPayload(product),`,
`    pricing,
    priceHalala: pricing.basePriceHalala,
    extraFeeHalala: pricing.extraFeeHalala,
    currency: pricing.currency,
    nutrition: buildNutritionPayload(product),`,
    'expose canonical product pricing aliases'
  );

  output = replaceRequired(
    output,
`  const premiumMealRelationGroups = await buildV3ProductOptionGroups({
    product: basicMealProduct,
    lang,
    optionFilter({ option, group }) {`,
`  const premiumMealRelationGroups = await buildV3ProductOptionGroups({
    product: basicMealProduct,
    lang,
    groupKeyResolver(group) {
      if (group.key === MENU_PROTEIN_GROUP_KEY) {
        return {
          key: "protein",
          sourceKey: MENU_PROTEIN_GROUP_KEY,
          canonicalGroupKey: "protein",
        };
      }
      return { key: group.key };
    },
    optionFilter({ option, group }) {`,
    'normalize premium protein group key'
  );

  return output;
});

update('tests/mealPlanner.integration.test.js', (input) => {
  let output = input;

  for (const [name, marker] of [
    ['Berry Blast', "name: { ar: 'عصير التوت', en: 'Berry Blast' }, category: 'juice', kind: 'item',"],
    ['Water', "name: { ar: 'ماء', en: 'Water' }, category: 'juice', kind: 'item',"],
    ['Protein Bar', "name: { ar: 'بروتين بار', en: 'Protein Bar' }, category: 'snack', kind: 'item',"],
    ['Small Salad', "name: { ar: 'سلطة صغيرة', en: 'Small Salad' }, category: 'small_salad', kind: 'item',"],
    ['Inactive Juice Item', "name: { ar: 'عنصر غير نشط', en: 'Inactive Juice Item' }, category: 'juice', kind: 'item',"],
  ]) {
    output = replaceRequired(
      output,
      marker,
      `${marker}\n      billingMode: 'flat_once',`,
      `set ${name} billing mode`
    );
  }

  output = replaceRequired(
    output,
`    assertEqual(res.status, 402, 'plan add-on selection requires payment');
    const paymentRequirement = res.body.paymentRequirement || res.body.error?.details?.paymentRequirement;
    assertTrue(!!paymentRequirement, 'payment requirement returned');`,
`    assertEqual(res.status, 400, 'plan add-on selection is rejected');
    const errCode = res.body.error?.code;
    assertTrue(errCode === 'INVALID' || errCode === 'INVALID_ONE_TIME_ADDON_SELECTION', 'plan add-on request rejected');`,
    'restore direct plan add-on rejection contract'
  );

  return output;
});

console.log('Remaining Meal Planner contract fixes applied.');
