const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { seedCatalog } = require("../scripts/seed-catalog");
const MenuProduct = require("../src/models/MenuProduct");
const MenuOption = require("../src/models/MenuOption");
const CatalogItem = require("../src/models/CatalogItem");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");
const { CUSTOMER_VISIBLE_CARB_KEYS, STANDARD_MEAL_PROTEIN_KEYS } = require("../src/config/mealPlannerContract");

describe("Seed Catalog: Empty DB and Idempotency Rules", () => {
  let replset;
  let uri;

  beforeAll(async () => {
    replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = replset.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replset.stop();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe("Rule 1: Rebuilding an Empty Database", () => {
    beforeAll(async () => {
      // Ensure completely empty
      await mongoose.connection.db.dropDatabase();
      // Run the initial seed with sync = false (default create-missing-only)
      await seedCatalog({ sync: false });
    });

    it("should create expected products like basic_meal and basic_salad", async () => {
      const basicMeal = await MenuProduct.findOne({ key: "basic_meal" });
      const basicSalad = await MenuProduct.findOne({ key: "basic_salad" });
      expect(basicMeal).toBeDefined();
      expect(basicSalad).toBeDefined();
    });

    it("should generate missing CatalogItems and successfully link them to new MenuProducts and MenuOptions", async () => {
      const riceItem = await CatalogItem.findOne({ key: "white_rice" });
      expect(riceItem).toBeTruthy();
      expect(riceItem.itemKind).toBe("carb");

      const riceProduct = await MenuProduct.findOne({ key: "white_rice" });
      const riceOption = await MenuOption.findOne({ key: "white_rice" });
      expect(riceProduct).toBeTruthy();
      expect(riceOption).toBeTruthy();

      expect(riceProduct.catalogItemId.toString()).toBe(riceItem._id.toString());
      expect(riceOption.catalogItemId.toString()).toBe(riceItem._id.toString());
    });

    it("Rule 5: basic_meal should strictly use standard proteins and customer visible carbs only", async () => {
      const basicMeal = await MenuProduct.findOne({ key: "basic_meal" });
      
      const pgos = await ProductGroupOption.find({ productId: basicMeal._id }).populate("groupId optionId");
      
      const proteinOptions = pgos.filter((pgo) => pgo.groupId.key === "proteins").map((pgo) => pgo.optionId.key);
      const carbOptions = pgos.filter((pgo) => pgo.groupId.key === "carbs").map((pgo) => pgo.optionId.key);

      expect(proteinOptions.sort()).toEqual([...STANDARD_MEAL_PROTEIN_KEYS].sort());
      expect(carbOptions.sort()).toEqual([...CUSTOMER_VISIBLE_CARB_KEYS].sort());
    });

    it("Rule 6: basic_salad vs premium_large_salad validation", async () => {
      const basicSalad = await MenuProduct.findOne({ key: "basic_salad" });
      const premiumLarge = await MenuProduct.findOne({ key: "premium_large_salad" });

      const basicPgos = await ProductGroupOption.find({ productId: basicSalad._id }).populate("groupId optionId");
      const premPgos = await ProductGroupOption.find({ productId: premiumLarge._id }).populate("groupId optionId");

      // Check basic_salad standard/premium/extra_protein
      const basicProteins = basicPgos.filter(p => p.groupId.key === "proteins").map(p => p.optionId.key);
      const basicExtras = basicPgos.filter(p => p.groupId.key === "extra_protein_50g").map(p => p.optionId.key);
      
      expect(basicProteins).toContain("chicken");
      expect(basicProteins).toContain("beef_steak"); // is premium
      expect(basicProteins).toContain("shrimp");     // is premium
      expect(basicExtras.length).toBeGreaterThan(0);
      expect(basicExtras).toContain("extra_chicken_50g");

      // Check premium_large_salad rejections
      const premProteins = premPgos.filter(p => p.groupId.key === "proteins").map(p => p.optionId.key);
      const premExtras = premPgos.filter(p => p.groupId.key === "extra_protein_50g").map(p => p.optionId.key);

      expect(premProteins).not.toContain("beef_steak");
      expect(premProteins).not.toContain("shrimp");
      
      // premium_large_salad excludes extra_protein_50g entirely, so there should be 0 active extras, or no group at all
      expect(premExtras).toHaveLength(0);
    });
  });

  describe("Rule 8: Idempotency (Strict create-missing-only)", () => {
    it("should preserve manual edits (prices, names, relationships) on existing records", async () => {
      // Given: A Dashboard admin modified an existing product
      const product = await MenuProduct.findOne({ key: "basic_meal" });
      const oldPrice = product.priceHalala;
      product.priceHalala = 99999;
      product.name.en = "MODIFIED NAME";
      product.imageUrl = "https://example.com/modified.jpg";
      await product.save();

      // Given: An option was manually renamed
      const option = await MenuOption.findOne({ key: "chicken" });
      option.name.en = "Modified Chicken";
      await option.save();
      
      // Given: An option relation was price-hiked
      const pgo = await ProductGroupOption.findOne({ productId: product._id, optionId: option._id });
      pgo.extraPriceHalala = 2500;
      await pgo.save();

      // Given: Existing product WITHOUT catalogItemId to prove we don't blindly link without migrations
      const saladProd = await MenuProduct.findOne({ key: "basic_salad" });
      saladProd.catalogItemId = null;
      await saladProd.save();

      // When: The seed runs again in default mode
      await seedCatalog({ sync: false });

      // Then: The modified fields must remain modified!
      const afterProduct = await MenuProduct.findOne({ key: "basic_meal" });
      expect(afterProduct.priceHalala).toBe(99999);
      expect(afterProduct.name.en).toBe("MODIFIED NAME");
      expect(afterProduct.imageUrl).toBe("https://example.com/modified.jpg");

      const afterOption = await MenuOption.findOne({ key: "chicken" });
      expect(afterOption.name.en).toBe("Modified Chicken");

      const afterPgo = await ProductGroupOption.findOne({ productId: product._id, optionId: option._id });
      expect(afterPgo.extraPriceHalala).toBe(2500);
      
      const afterSaladProd = await MenuProduct.findOne({ key: "basic_salad" });
      expect(afterSaladProd.catalogItemId).toBeNull();
    });
  });
});
