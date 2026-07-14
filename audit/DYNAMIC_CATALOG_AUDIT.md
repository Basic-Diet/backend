# Dynamic Catalog Audit

## Stabilization Scope

This pass stopped broad dynamic-catalog expansion and stabilized the premium vertical flow only.

## Static Dependency Inventory

| Domain | Static dependency found | Affected file | Current source of truth | Target database source | Runtime risk | Fix status | Migration required | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Premium upgrades | `CANONICAL_PREMIUM_KEYS`, name maps, legacy premium aliases | `src/utils/subscription/premiumIdentity.js` | Mixed static inference plus DB | `PremiumUpgradeConfig` with `MenuOption`, `MenuProduct`, or `BuilderProtein` source | New premium keys fail quote/checkout/catalog | Premium vertical fixed; aliases retained for legacy | Move aliases to DB metadata later | `tests/dynamicCatalogPremium.test.js`, `tests/checkout.integration.test.js` |
| Premium public catalog | Static premium eligibility only | `src/services/catalog/CatalogService.js` | Static eligibility plus DB config | Active `PremiumUpgradeConfig` | Dashboard-created premium can quote but not appear in catalog | Fixed for active config-backed premium options | No migration for code; data needs active configs | Dynamic dashboard-to-catalog test |
| Premium pricing | Hardcoded legacy fallback prices | `src/services/subscription/premiumUpgradeConfigService.js`, `premiumLargeSaladPricingService.js` | Static fallback plus DB | Active config or DB-backed source record | Quote/checkout can diverge from dashboard | Fixed for premium path; DB fallback only when no config exists | Backfill config rows for legacy defaults recommended | Dynamic and checkout tests |
| Premium archive | Archived config could fall back to active source option | `catalogResolutionService`, `premiumUpgradeConfigService` | Mixed | Config status gates new purchase | Archived premium remains purchasable | Fixed | None | Dynamic archive rejection test |
| Premium snapshots | Draft/contract lacked immutable source metadata | `CheckoutDraft`, `Subscription`, checkout/contract/activation services | Live catalog or partial rows | Backend-generated immutable snapshot | Old purchase can change after catalog edit | Fixed for premium balance and overview | Existing old drafts remain legacy-compatible | Dynamic snapshot survival test |
| Subscription packages | `CANONICAL_PUBLIC_PLAN_KEYS` | `src/controllers/planController.js` | Static allowlist | Future `Plan.getSellableQuery()` phase | New package hidden publicly | Reverted from premium phase | Later package phase | Not covered in this pass |
| Add-on categories | Static `juice/snack/small_salad` enum | `Addon`, `addonController` | Static enum | Future dashboard config | Dynamic category blocked | Reverted from premium phase | Later add-on phase | Not covered in this pass |
| One-time add-ons | `CANONICAL_ONETIME_ADDONS` | `menuController`, bootstrap cleanup script | Static allowlist | Future DB visibility/availability | Public/catalog mismatch | Reverted from premium phase | Later menu/add-on phase | Existing checkout/mobile tests |
| Builder premium delete | Physical delete | `builderPremiumMealController` | Hard delete | Soft archive | Historical references can break | Retained; premium-related | Add reference guard hardening later | Syntax and existing checkout coverage |
| Meal builder proteins/carbs/salad rules | Static keys and allowlists | `mealPlannerContract`, CatalogService tests | Static protocol and item keys | Future DB config | New builder items need code | Not changed in this pass | Later meal-builder phase | Existing tests still expose failures in full suite |
| Seeds/bootstrap | Specific product keys and destructive clears | `scripts/bootstrap/*`, seed scripts | Seed definitions | Explicit bootstrap/migration only | Production reseeding risk | Documented only | Required later | Full suite has seed failures |

## Cross-Domain Changes

- Retained: builder premium soft archive because it protects premium historical integrity.
- Reverted: add-on category enum relaxation, one-time add-on public allowlist removal, public plan allowlist removal, `BuilderCarb` archive fields.
- Reverted/fixed unrelated breakage: one-time menu protein visibility filter in `menuCatalogPresenter` because it broke mobile order contracts.
- Pre-existing/user work not reverted: test-runner Mongo safety changes, QA seed removals, subscription planning behavior, generated test report changes.

## Remaining Static Runtime Behavior

Premium legacy name inference remains in `premiumIdentity.js` for old contracts. It is not the primary authority for new dynamic premium purchases. `premium_large_salad` remains a protocol-level selection type and a legacy product key. Broader package/menu/add-on/meal-builder hardcoding remains intentionally out of scope for this premium stabilization pass.
