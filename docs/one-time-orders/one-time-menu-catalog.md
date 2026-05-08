# One-Time Menu Catalog

This guide covers safe local and staging validation for the pickup-only one-time menu catalog.

## Test Commands

Run the self-contained catalog regression test:

```bash
npm run test:one-time-menu
```

Run the default test suite:

```bash
npm test
```

`npm run test:one-time-menu` uses an in-memory MongoDB instance and does not require Docker or a local MongoDB server.

## Safe Seed Usage

Seed only against local or staging databases:

```bash
NODE_ENV=staging MONGO_URI="<staging mongo uri>" npm run seed:one-time-menu
```

Required environment:

- `MONGO_URI` or `MONGODB_URI`
- `NODE_ENV` set to a non-production value for local/staging validation

The seed is guarded when `NODE_ENV=production`. It exits before connecting unless the operator explicitly sets:

```bash
MENU_SEED_ALLOW_PRODUCTION=true
```

Use the override only for an intentional production menu seed, never for routine validation.

## E2E Validation

Run E2E validation against staging, not Atlas production. Use Moyasar test credentials or an in-process payment mock in a dedicated validation script.

Suggested flow:

1. Run `npm run seed:one-time-menu` against staging.
2. Request `GET /api/orders/menu`.
3. Quote a fixed item.
4. Quote a `per_100g` item.
5. Create an order with a catalog product.
6. Verify `productSnapshot`, `selectedOptions`, `pricingSnapshot`, and `menuVersionId`.
7. Use dashboard menu APIs to hide/show a product and verify inactive items disappear from the customer menu.

## Business Rules To Verify

- Prices are Halala.
- VAT is included; do not add VAT again on clients.
- One-time orders are pickup-only.
- Client-supplied price fields are ignored by backend pricing.
- Delivery fulfillment is rejected for this launch.

## Launch Catalog Keys

Seeded category keys used by the mobile UI:

- `custom_order`: configurable Builder products. Frontend URL section `custom-order` maps to this backend key.
- `light_options`: retained as a compatible optional category key, but the final configurable launch products are under `custom_order`.
- `cold_sandwiches`: fixed cold sandwich products.
- `sourdough`: fixed sourdough products.
- `juices`: fixed juice products.
- `desserts`, `drinks`, `ice_cream`: additional fixed product categories.

Stable Builder product keys:

- `basic_salad`
- `basic_meal`
- `fruit_salad`
- `greek_yogurt`
- `green_salad`

Fixed direct-add launch product keys:

- Cold sandwiches: `boiled_egg_cold_sandwich`, `turkey_cold_sandwich`, `classic_halloumi_cold_sandwich`, `tuna_cold_sandwich`, `scrambled_egg_cold_sandwich`, `chicken_fajita_cold_sandwich`, `mexican_chicken_cold_sandwich`, `grilled_chicken_cold_sandwich`
- Sourdough: `halloumi_sourdough`, `turkey_sourdough`, `tuna_sourdough`, `grilled_chicken_sourdough`
- Desserts: `apple_cinnamon_muffin_2pcs`, `berry_cheesecake`, `strawberry_cheesecake`, `dark_brownies`, `protein_bar`, `basic_classic`, `protein_chocolate_cake`
- Juices: `berry_blast`, `berry_prot`, `classic_green`, `beet_punch`, `orange_carrot`, `watermelon_mint`
- Drinks: `protein_drink`, `diet_iced_tea`, `diet_soda`, `water`
- Ice cream: `vanilla_ice_cream`, `chocolate_ice_cream`, `ice_cream_add_on`

Stable Builder option group keys:

- `leafy_greens`
- `vegetables_legumes`
- `fruits`
- `proteins`
- `cheese_nuts`
- `sauces`
- `carbs`
- `nuts`

Customer menu products include derived optional helper fields:

- `requiresBuilder`: `true` when the product has any `optionGroups` or `pricingModel = "per_100g"`.
- `canAddDirectly`: `true` only when `pricingModel = "fixed"` and `optionGroups.length = 0`.

Mobile should use these helpers when present. Fallback logic is the same: open Builder for products with option groups or `per_100g` pricing, and direct-add only fixed products with zero option groups.

Seed migration aliases keep previously seeded fixed product keys from appearing as duplicate active products after rerunning the seed.

## Tech Debt

Current dynamic catalog products can persist their catalog-specific `itemType` values, such as `basic_salad`, on `Order.items`.

Longer term, a cleaner shape would keep `itemType` generic, for example `salad`, and store the specific catalog identity in `productId` or `productKey`, for example `basic_salad`. Do not change this during launch hardening unless a broader contract migration is planned.
