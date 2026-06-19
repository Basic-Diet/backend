const request = require("supertest");
const { createApp } = require("./src/app");
const app = createApp();
const api = request(app);
api.get("/api/subscriptions/meal-planner-menu?includeLegacy=true&lang=en").then(res => {
  console.log(Object.keys(res.body.data));
  console.log(res.body.data.builderCatalog ? Object.keys(res.body.data.builderCatalog) : null);
  process.exit(0);
});
