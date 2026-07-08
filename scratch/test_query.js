require("dotenv").config();
const mongoose = require("mongoose");
const MenuProduct = require("../src/models/MenuProduct");

const uri = "mongodb://mongo:UNMfiPiVYDrmJLfJPrAtznolkFmuERgy@hayabusa.proxy.rlwy.net:59730/basicdiet145?authSource=admin";
mongoose.connect(uri).then(async () => {
  const isTestTag = { isTestData: true };
  const activeProps = { isActive: true, isVisible: true, isAvailable: true, publishedAt: new Date(), availableFor: ["one_time"] };
  const pJuice = new MenuProduct({ key: "test_" + Date.now(), name: { en: "T Juice" }, category: { key: "juices" }, priceHalala: 1000, currency: "SAR", ...activeProps, ...isTestTag });
  await pJuice.save({ validateBeforeSave: false });
  
  function activePublishedQuery(extra = {}) {
    return {
      isActive: true,
      isVisible: { $ne: false },
      isAvailable: { $ne: false },
      publishedAt: { $ne: null },
      ...extra,
    };
  }
  function availableForOneTimeQuery() {
    return {
      $or: [
        { availableFor: { $exists: false } },
        { availableFor: [] },
        { availableFor: "one_time" },
      ],
    };
  }

  const query = activePublishedQuery({
      _id: pJuice._id,
      ...availableForOneTimeQuery(),
  });

  const found = await MenuProduct.findOne(query).lean();
  console.log("Found:", found ? true : false);
  if (!found) {
     const doc = await MenuProduct.findById(pJuice._id).lean();
     console.log("Actual doc in DB:", doc);
     console.log("Query used:", JSON.stringify(query, null, 2));
  }
  await MenuProduct.deleteOne({ _id: pJuice._id });
  process.exit(0);
});
