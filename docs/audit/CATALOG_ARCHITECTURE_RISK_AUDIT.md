A. SYSTEM INTENT (INFERRED)
PremiumUpgradeConfig becomes authoritative for subscription premium availability and pricing once any config exists; legacy fallback is allowed only while the collection is empty.
Premium upgrades modify existing subscription meal slots and never add meals or act as add-ons.
premiumKey is the canonical premium identity across quote, checkout, planner, balances, and clients.
Premium configuration must not alter one-time order pricing.
The dashboard Premium Upgrades page must manage only existing PremiumUpgradeConfig links through /api/dashboard/premium-upgrades.
Candidate eligibility must be resolved by the backend; clients must only render returned candidates.
Subscription-day, delivery, pickup-request, and order transitions should each have authoritative state rules.
Backend DTOs should own allowed actions, prices, balances, and payment requirements.
Dashboard and Flutter should render backend decisions rather than reproduce them.
Canonical planner records use selectionType, premiumKey, menu products/options, and snapshots; legacy builder fields exist only for compatibility.
B. ACTUAL SYSTEM BEHAVIOR
PremiumUpgradeConfig CRUD, candidate discovery, revision control, visibility, enabled state, readiness, and archiving exist.
An empty config collection activates legacy allow-all premium behavior.
Config-first pricing coexists with hardcoded prices, menu relation prices, menu option prices, menu product prices, Meal Builder rules, and BuilderProtein prices.
Different premium consumers apply different config predicates.
Premium identity can be resolved from premiumKey, builder IDs, menu IDs, aliases, or localized-name inference.
Candidate discovery is centralized in loadEligiblePremiumCandidates().
Candidate creation reuses the same resolver.
includeLinked defaults to false and structurally filters linked candidates correctly.
Candidate discovery contains explicit hardcoded product scope for premium_large_salad.
The dashboard /premium-meals page embeds MealBuilderPage and has no PremiumUpgradeConfig management client.
Dashboard subscription creation uses /api/admin/builder-premium-meals and submits legacy premiumMealId.
Flutter quote and checkout requests use canonical premiumKey.
Flutter independently computes premium credit coverage, pending premium counts, and pending premium amounts.
Subscription days, deliveries, pickup requests, and orders persist separate statuses.
A purported subscription-day transition service exists but has no non-test call sites.
Active operations use a different transition table in utils/state.js and direct status mutations.
Delivery cancellation reason codes differ between documentation, dashboard, and backend validation.
Legacy builder premium routes, legacy planner lookups, ID-based premium payloads, and name inference remain active.
C. DEVIATION TABLE
System Area	Intended	Actual	Type	Severity	Root Cause File
Premium pricing	Config is authoritative once any config exists	Planner/catalog consumers can still fall back to menu, builder, rule, or hardcoded prices	DUPLICATED_AUTHORITY	BLOCKER	[CatalogService.js (line 195)](/home/hema/Projects/basicdiet145/src/services/catalog/CatalogService.js:195)
Premium pricing	One shared config-state policy	mealSlotPlannerService requires active/enabled but ignores isVisible	LOGIC_CONFLICT	HIGH	[mealSlotPlannerService.js (line 898)](/home/hema/Projects/basicdiet145/src/services/subscription/mealSlotPlannerService.js:898)
Premium pricing	Hidden config is unavailable to customer planner	premiumIdentity also ignores isVisible when applying config price	LOGIC_CONFLICT	HIGH	[premiumIdentity.js (line 220)](/home/hema/Projects/basicdiet145/src/utils/subscription/premiumIdentity.js:220)
Premium pricing	Premium protein delta comes from authoritative config	Catalog contains hardcoded 2000-halalah values	DUPLICATED_AUTHORITY	HIGH	[CatalogService.js (line 59)](/home/hema/Projects/basicdiet145/src/services/catalog/CatalogService.js:59)
Premium salad pricing	Config controls configured premium salad delta	Menu product, basic_salad, and fixed 2900-halalah fallback remain pricing authorities	DUPLICATED_AUTHORITY	HIGH	[premiumLargeSaladPricingService.js (line 35)](/home/hema/Projects/basicdiet145/src/services/catalog/premiumLargeSaladPricingService.js:35)
Meal Builder pricing	Published planner reflects authoritative premium config	Builder rules and virtual defaults can supply 2000/2900 values	DUPLICATED_AUTHORITY	HIGH	[mealBuilderConfigService.js (line 1934)](/home/hema/Projects/basicdiet145/src/services/subscription/mealBuilderConfigService.js:1934)
Premium identity	premiumKey is canonical identity	Identity can be inferred from localized names and legacy IDs	LEGACY_LEAK_ACTIVE	HIGH	[premiumIdentity.js (line 77)](/home/hema/Projects/basicdiet145/src/utils/subscription/premiumIdentity.js:77)
Premium quote	Canonical payload is {premiumKey, qty}	Quote accepts premiumMealId and proteinId compatibility payloads	LEGACY_LEAK_ACTIVE	MEDIUM	[subscriptionQuoteService.js (line 208)](/home/hema/Projects/basicdiet145/src/services/subscription/subscriptionQuoteService.js:208)
Config DTO	sourceStatus and validation represent source eligibility	published is hardcoded true and relationValid equals source existence	DTO_MISMATCH	HIGH	[premiumUpgradeConfigService.js (line 73)](/home/hema/Projects/basicdiet145/src/services/subscription/premiumUpgradeConfigService.js:73)
Candidate ownership	One backend resolver owns premium-config eligibility	One canonical resolver is used by both list and create	—	—	[premiumUpgradeConfigService.js (line 238)](/home/hema/Projects/basicdiet145/src/services/subscription/premiumUpgradeConfigService.js:238)
Candidate filtering	Backend filters eligibility and linked state	includeLinked, search, source, product, and selection filters are centralized and structurally consistent	—	—	[premiumUpgradeConfigService.js (line 399)](/home/hema/Projects/basicdiet145/src/services/subscription/premiumUpgradeConfigService.js:399)
Candidate scope	Eligible menu sources are backend-resolved	Product-backed candidates are hardcoded to premium_large_salad; add-on detection also depends on itemType/UI card variant	CONTRACT_LEAKAGE	MEDIUM	[premiumUpgradeConfigService.js (line 199)](/home/hema/Projects/basicdiet145/src/services/subscription/premiumUpgradeConfigService.js:199)
Candidate DTO	Documented response includes status: true	Service/controller returns only {data, meta}	DTO_MISMATCH	MEDIUM	[premiumUpgradeController.js (line 30)](/home/hema/Projects/basicdiet145/src/controllers/dashboard/premiumUpgradeController.js:30)
Premium dashboard	Screen manages PremiumUpgradeConfig only	/premium-meals embeds MealBuilderPage	MISSING_IMPLEMENTATION	BLOCKER	[premium-meals/index.tsx (line 3)](/home/hema/Projects/full app/client_dashbourd/src/routes/_protected/premium-meals/index.tsx:3)
Premium dashboard	Use /api/dashboard/premium-upgrades endpoints	No dashboard client, types, hooks, or components reference those endpoints	MISSING_IMPLEMENTATION	BLOCKER	[premium-meals/index.tsx (line 35)](/home/hema/Projects/full app/client_dashbourd/src/routes/_protected/premium-meals/index.tsx:35)
Subscription creation	Premium selections use premiumKey	Dashboard fetches legacy builder premiums and submits premiumMealId	LEGACY_LEAK_ACTIVE	HIGH	[PremiumMealsSection.tsx (line 40)](/home/hema/Projects/full app/client_dashbourd/src/components/pages/subscriptions/create/PremiumMealsSection.tsx:40)
Premium semantics	Upgrade consumes an existing slot	Dashboard labels the operation “Add meal” and “meal price”	CONTRACT_LEAKAGE	MEDIUM	[PremiumMealsSection.tsx (line 84)](/home/hema/Projects/full app/client_dashbourd/src/components/pages/subscriptions/create/PremiumMealsSection.tsx:84)
Subscription-day lifecycle	One transition authority	subscriptionDayTransitionService is unreferenced; active operations use utils/state.js	DUPLICATED_AUTHORITY	HIGH	[subscriptionDayTransitionService.js (line 11)](/home/hema/Projects/basicdiet145/src/services/subscription/subscriptionDayTransitionService.js:11)
Subscription-day lifecycle	Transition rules are consistent	utils/state.js and subscriptionDayTransitionService define different delivery transitions	LOGIC_CONFLICT	HIGH	[state.js (line 1)](/home/hema/Projects/basicdiet145/src/utils/state.js:1)
Delivery lifecycle	Day and delivery states remain synchronized by one service	Courier cancellation directly mutates both persisted records	STATE_DESYNC	HIGH	[courierController.js (line 381)](/home/hema/Projects/basicdiet145/src/controllers/courierController.js:381)
Delivery lifecycle	Ready → dispatched → fulfilled	Active transition table permits ready_for_delivery → fulfilled	LOGIC_CONFLICT	HIGH	[state.js (line 6)](/home/hema/Projects/basicdiet145/src/utils/state.js:6)
Arriving-soon transition	Only out_for_delivery accepts arriving-soon	Backend helper accepts both scheduled and out_for_delivery	LOGIC_CONFLICT	HIGH	[deliveryWorkflowService.js (line 26)](/home/hema/Projects/basicdiet145/src/services/deliveryWorkflowService.js:26)
Delivery cancellation	Documented/dashboard reason codes are accepted	Backend accepts a different reason-code set	DTO_MISMATCH	BLOCKER	[deliveryWorkflowService.js (line 31)](/home/hema/Projects/basicdiet145/src/services/deliveryWorkflowService.js:31)
Courier DTO	Mutation endpoints return one unified delivery DTO	Deduplicated arriving-soon path returns {deliveryId,status,reminderSentAt}	DTO_MISMATCH	MEDIUM	[courierController.js (line 120)](/home/hema/Projects/basicdiet145/src/controllers/courierController.js:120)
Pickup lifecycle	Pickup request state has one authority	Pickup-request transition rules are defined inside operations service while model and settlement services also mutate state	DUPLICATED_AUTHORITY	HIGH	[opsTransitionService.js (line 791)](/home/hema/Projects/basicdiet145/src/services/dashboard/opsTransitionService.js:791)
Pickup duplication	Duplicate requests are prevented structurally	Uniqueness depends on caller-provided idempotencyKey; no independent selection/date uniqueness exists	FRONTEND_ASSUMPTION	MEDIUM	[SubscriptionPickupRequest.js (line 105)](/home/hema/Projects/basicdiet145/src/models/SubscriptionPickupRequest.js:105)
Dashboard order actions	Backend DTO owns allowed actions	Dashboard synthesizes pickup actions when backend actions are absent	CONTRACT_LEAKAGE	HIGH	[oneTimeOrderActions.ts (line 10)](/home/hema/Projects/full app/client_dashbourd/src/lib/oneTimeOrderActions.ts:10)
Dashboard courier cancellation	Client sends backend-defined reason	Client defaults to customer_unreachable, rejected by the backend enum	FRONTEND_ASSUMPTION	BLOCKER	[fetchCourierDeliveries.ts (line 181)](/home/hema/Projects/full app/client_dashbourd/src/utils/fetchCourierDeliveries.ts:181)
Dashboard operations DTO	One backend DTO is consumed directly	Adapter resolves multiple aliases for source, entity, delivery mode, address, IDs, and status	FRONTEND_ASSUMPTION	MEDIUM	[operationsBoard.ts (line 372)](/home/hema/Projects/full app/client_dashbourd/src/lib/operationsBoard.ts:372)
Flutter premium accounting	Backend owns balances and pending payment totals	Flutter recomputes credit coverage and pending amount from catalog fees	CONTRACT_LEAKAGE	HIGH	[meal_planner_state.dart (line 705)](/home/hema/Projects/full app/mobile_app/lib/presentation/plans/timeline/meal_planner/bloc/meal_planner_state.dart:705)
Flutter premium identity	Backend-provided premiumKey is authoritative	Flutter falls back through premium key, legacy ID, and normalized name	LEGACY_LEAK_ACTIVE	HIGH	[meal_planner_state.dart (line 780)](/home/hema/Projects/full app/mobile_app/lib/presentation/plans/timeline/meal_planner/bloc/meal_planner_state.dart:780)
Flutter planner DTO	Client renders canonical planner fields	Mapper supplies default premium keys/types and derives salad fee from product price	FRONTEND_ASSUMPTION	MEDIUM	[meal_planner_menu_mapper.dart (line 756)](/home/hema/Projects/full app/mobile_app/lib/data/mappers/meal_planner_menu_mapper.dart:756)
Legacy service	Unused compatibility code should not define authority	premiumProteinService has no non-test source call site	LEGACY_LEAK_ACTIVE	LOW	[premiumProteinService.js (line 1)](/home/hema/Projects/basicdiet145/src/services/premiumProteinService.js:1)

D. CRITICAL ARCHITECTURE BREAKS
BLOCKER — Premium pricing has no single source of truth.
Competing config, builder, menu relation, menu product, rule, and hardcoded prices remain reachable.

BLOCKER — The documented Premium Upgrade dashboard is missing.
The route invokes Meal Builder instead of the PremiumUpgradeConfig API.

BLOCKER — Delivery cancellation contract is internally incompatible.
Documentation/dashboard send customer_unreachable; backend validation does not accept it.

HIGH — Config visibility is not consistently enforced.
A hidden config can still be resolved by services that query only active/enabled state.

HIGH — Premium identity remains multi-authority.
Canonical keys coexist with database IDs, aliases, and localized-name inference.

HIGH — Subscription-day transitions have conflicting authorities.
The named transition service is unused, while the active table permits different transitions.

HIGH — Delivery and subscription-day statuses require manual synchronization.
Multiple controllers and operations handlers mutate the two documents.

HIGH — Frontends reproduce premium accounting and action eligibility.
Backend results are not the exclusive authority for pending amounts, credit usage, or allowed actions.

E. DUPLICATED AUTHORITIES MAP
Subscription premium price
PremiumUpgradeConfig.upgradeDeltaHalala
MenuOption.extraFeeHalala
MenuOption.extraPriceHalala
ProductGroupOption.extraPriceHalala
BuilderProtein.extraFeeHalala
Meal Builder rule extraFeeHalala
Hardcoded premium protein 2000
MenuProduct.priceHalala
basic_salad product fallback
Fixed premium salad 2900
Flutter catalog fee used for pending totals

Premium identity
premiumKey
BuilderProtein._id
MenuOption._id
premiumMealId
proteinId
custom_premium_salad alias
Localized-name inference

Subscription-day transitions
utils/state.js
subscriptionDayTransitionService.js
opsTransitionService.js
Courier direct mutations
Fulfillment service mutations

Delivery state
SubscriptionDay.status
Delivery.status
Derived DTO state from arrivingSoonReminderSentAt

Pickup state
SubscriptionDay.status and pickup timestamp fields
SubscriptionPickupRequest.status
Pickup credit reservation/consumption timestamps
Operations-local pickup transition table
Settlement service direct updates

Allowed UI actions
Backend allowedActions
Dashboard one-time order fallback table
Dashboard courier flags converted to actions
Operations adapter normalization

F. CONTRACT LEAKS (FRONTEND)
Dashboard premium route controls Meal Builder instead of rendering PremiumUpgradeConfig.
Dashboard premium subscription form uses legacy builder IDs.
Dashboard derives SAR display values from raw halala.
Dashboard assigns semantic labels describing upgrades as additional meals.
Dashboard synthesizes one-time order actions from status.
Dashboard defaults cancellation reason codes independently of the backend enum.
Dashboard normalizes multiple backend shapes and field aliases.
Flutter computes premium credit consumption.
Flutter computes pending premium payment amounts.
Flutter matches premium entitlement using key, ID, and normalized name.
Flutter derives premium salad identity and fee from product fields when canonical fields are absent.
Flutter normalizes legacy standard_combo into standard_meal.
G. FINAL ARCHITECTURE STATE
BROKEN