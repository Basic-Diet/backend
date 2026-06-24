# Screen Contract: 16_SETTINGS

## 1. Screen Purpose

The Settings screen is a lightweight Arabic-only ownership and navigation screen for general settings. It must not become a duplicate editor for pricing, menu configuration, delivery zones, premium upgrades, or restaurant operations.

No truly general editable setting is currently proven to be both effective and correctly owned by this screen. Until such a setting is introduced with a tested backend contract, the screen displays Arabic guidance rather than editable inputs.

## 2. Dashboard Route

`/settings`

## 3. Visible UI Requirements

* All visible interface text is Arabic.
* Explain that no general settings are currently editable from this screen.
* Link only to verified owner routes:
  * Delivery fees: `/zones`
  * Custom meal and salad configuration: `/menu`
  * Premium upgrade pricing: `/premium-meals`
  * Restaurant hours, delivery windows, and cutoff: `/restaurant-hours`
* Explain that VAT is controlled by backend financial configuration and is not editable from the Dashboard.
* Do not render a settings form or save button when there are no owned editable settings.

## 4. Endpoints Used by This Screen

None.

The active Settings screen does not call `GET /api/dashboard/settings` or `PATCH /api/dashboard/settings` because it has no owned editable settings. This prevents foreign-owner or persisted-only keys from being presented as authoritative controls.

## 5. Backward-Compatible Backend Endpoints

The backend continues to expose the following admin endpoints for compatibility and dedicated consumers:

* `GET /api/dashboard/settings`
* `PATCH /api/dashboard/settings`
* `PUT /api/dashboard/settings/cutoff`
* `PUT /api/dashboard/settings/delivery-windows`
* `PUT /api/dashboard/settings/skip-allowance`
* `PUT /api/dashboard/settings/premium-price`
* `PUT /api/dashboard/settings/subscription-delivery-fee`
* `PUT /api/dashboard/settings/vat-percentage`
* `PUT /api/dashboard/settings/custom-salad-base-price`
* `PUT /api/dashboard/settings/custom-meal-base-price`

Their continued existence does not make every stored key an effective or Settings-owned Dashboard control.

## 6. Ownership Rules

| Setting / Area | Current Key or Source | Owner | Settings UI Rule |
| --- | --- | --- | --- |
| Zone delivery fee | `Zone.deliveryFeeHalala` | Delivery Zones | Hidden; manage in `/zones` |
| Subscription delivery fallback | `subscription_delivery_fee_halala` | Backend delivery fallback | Hidden; not presented as the main delivery fee |
| Custom meal price | `custom_meal_base_price` | Menu / Meal Builder | Hidden |
| Custom salad price | `custom_salad_base_price` | Menu / Meal Builder | Hidden |
| Premium upgrade price | `PremiumUpgradeConfig` | Premium Upgrades | Manage in `/premium-meals`; legacy `premium_price` is hidden |
| Restaurant open/close | `restaurant_open_time`, `restaurant_close_time`, `restaurant_is_open` | Restaurant Hours | Hidden; manage in `/restaurant-hours` |
| Delivery windows | `delivery_windows` | Restaurant Hours | Hidden; manage in `/restaurant-hours` |
| Cutoff time | `cutoff_time` | Restaurant Hours | Hidden; manage in `/restaurant-hours` |
| Subscription skip allowance | Plan `skipPolicy` | Packages / subscription plan policy | Legacy `skip_allowance` is hidden |
| VAT | Backend `VAT_PERCENTAGE` configuration | Backend finance configuration | Read-only explanation; no editable input |

## 7. Business Authority

* Backend behavior remains the source of truth.
* The Dashboard must not infer that a persisted key is operationally effective.
* VAT remains controlled by `src/config/vat.js`; the `vat_percentage` database key is not an authoritative pricing control.
* Premium upgrades remain controlled by `PremiumUpgradeConfig`; `premium_price` must not be reconnected as an active control.
* Zone delivery fees remain controlled by Zone records and backend quote services.
* Custom meal and salad pricing behavior is unchanged and remains with menu configuration.

## 8. Roles

The `/settings` Dashboard route is available to `admin` and `superadmin`. The compatibility backend settings endpoints are also restricted to those roles.

## 9. Frontend Restrictions

* Do not call Settings mutation endpoints while the screen has no owned editable keys.
* Do not submit hidden, legacy, fallback-only, or foreign-owner keys.
* Do not add local financial defaults or calculations.
* Do not add a navigation link unless its Dashboard route exists and is permitted for the same roles.

## 10. Contract Tests Required

* The screen displays Arabic ownership guidance.
* The screen renders no generic editable settings form.
* Foreign-owner keys are absent from the screen and cannot be submitted.
* Navigation targets are limited to `/zones`, `/menu`, `/premium-meals`, and `/restaurant-hours`.
* Existing settings endpoint URL helpers remain backward compatible.

## 11. Known Limitations

* Legacy and fallback keys remain stored and writable through backward-compatible backend endpoints.
* The backend response does not yet include ownership/effectiveness metadata.
* No general business setting currently qualifies for editing on this screen.

## 12. Status

`READY_WITH_LIMITATIONS`
