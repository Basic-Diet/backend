#!/bin/bash
set -e

mkdir -p /home/hema/Projects/basicdiet145/tmp/meal-planner-debug
OUT_DIR="/home/hema/Projects/basicdiet145/tmp/meal-planner-debug"

BASE_URL="https://basicdiet145-production-51e9.up.railway.app"
API_BASE="${BASE_URL}/api"
LANG="en"

echo "Running BasicDiet Runtime Debug Audit..."
echo "Targeting: ${BASE_URL}"

echo "1. Fetching Health..."
curl -s -X GET "${BASE_URL}/health" > "${OUT_DIR}/health.json"
echo "Saved to ${OUT_DIR}/health.json"

echo "2. Fetching Canonical Meal Planner Menu..."
curl -s -X GET "${API_BASE}/subscriptions/meal-planner-menu?lang=${LANG}" > "${OUT_DIR}/meal-planner-menu.json"
echo "Saved to ${OUT_DIR}/meal-planner-menu.json"

echo "3. Fetching Subscription Menu..."
curl -s -X GET "${API_BASE}/subscriptions/menu" > "${OUT_DIR}/subscriptions-menu.json"
echo "Saved to ${OUT_DIR}/subscriptions-menu.json"

echo "4. Fetching One-Time Orders Menu..."
curl -s -X GET "${API_BASE}/orders/menu" > "${OUT_DIR}/orders-menu.json"
echo "Saved to ${OUT_DIR}/orders-menu.json"

echo "5. Fetching Deprecated Categories With Meals..."
curl -s -w "\\nHTTP_STATUS:%{http_code}\\n" -X GET "${API_BASE}/categories-with-meals" > "${OUT_DIR}/categories-with-meals.txt"
echo "Saved to ${OUT_DIR}/categories-with-meals.txt"

echo ""
echo "==== AUDIT COMPLETE ===="

if command -v jq &> /dev/null; then
    echo "Running jq search for targets in meal-planner-menu.json..."
    
    if [ -n "$TARGET_PRODUCT_KEY" ]; then
        echo "Searching for product key: $TARGET_PRODUCT_KEY"
        jq -c ".. | objects | select(.key == \"$TARGET_PRODUCT_KEY\" or .productKey == \"$TARGET_PRODUCT_KEY\") | {key: (.key // .productKey), name: (.name // .nameEn // .title), selectionType, action, requiresBuilder: .action.requiresBuilder}" "${OUT_DIR}/meal-planner-menu.json" || true
    fi

    if [ -n "$TARGET_PRODUCT_NAME" ]; then
        echo "Searching for product name: $TARGET_PRODUCT_NAME"
        jq -c ".. | objects | select((.name != null and (.name | test(\"$TARGET_PRODUCT_NAME\"; \"i\"))) or (.nameEn != null and (.nameEn | test(\"$TARGET_PRODUCT_NAME\"; \"i\")))) | {key: (.key // .productKey), name: (.name // .nameEn // .title), selectionType, action}" "${OUT_DIR}/meal-planner-menu.json" || true
    fi

    if [ -n "$TARGET_CATEGORY_KEY" ]; then
        echo "Searching for category key: $TARGET_CATEGORY_KEY"
        jq -c ".. | objects | select(.key == \"$TARGET_CATEGORY_KEY\" or .categoryKey == \"$TARGET_CATEGORY_KEY\" or .sectionKey == \"$TARGET_CATEGORY_KEY\") | {key: (.key // .categoryKey // .sectionKey), name: (.name // .nameEn // .title), sectionKey}" "${OUT_DIR}/meal-planner-menu.json" || true
    fi

else
    echo "jq is not installed. Skipping structured search. Use grep manually."
fi
