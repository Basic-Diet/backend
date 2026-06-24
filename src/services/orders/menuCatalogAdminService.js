function createMenuCatalogAdminService(deps) {
  const {
    mongoose,
    MenuCategory,
    MenuProduct,
    MenuOptionGroup,
    MenuOption,
    ProductOptionGroup,
    ProductGroupOption,
    MenuAuditLog,
    BuilderProtein,
    Sandwich,
    Setting,
    SYSTEM_CURRENCY,
    VAT_PERCENTAGE,
    assertCatalogItemLinkable,
    filterGloballyAvailable,
    loadCatalogItemsByIdForDocs,
    generateUniqueKey,
    isAllowedCategoryCardVariant,
    isAllowedCardVariant,
    isAllowedProductCardSize,
    isAllowedGroupDisplayStyle,
    normalizeCategoryUiMetadata,
    normalizeGroupUiMetadata,
    normalizeProductUiMetadata,
    normalizeUiMetadata,
    localizeName,
    localizedPair,
    truthyByDefault,
    serializePublicCategory,
    serializePublicProduct,
    serializePublicGroup,
    serializePublicOption,
    serializeDashboardPreviewCategory,
    serializeDashboardPreviewProduct,
    serializeDashboardPreviewGroup,
    serializeDashboardPreviewOption,
    isCustomerVisibleProduct,
    isCustomerVisibleGroup,
    isCustomerVisibleOption,
    resolvePublicProductCategory,
    sortPublicProducts,
    validateMenuCatalog,
    MenuValidationError,
    MenuNotFoundError,
    assertObjectId,
    normalizeOptionalObjectId,
    mirrorCompatibilityImage,
    isPlainObject,
    normalizeKey,
    normalizeOptionalKey,
    assertImmutableKey,
    assertImmutableCatalogItemLink,
    localizedString,
    optionalLocalizedString,
    normalizeBoolean,
    normalizeNonNegativeInteger,
    normalizeNullableNonNegativeInteger,
    normalizeStringArray,
    normalizeAvailableFor,
    normalizeOptionalString,
    serializeDoc,
    parsePaginationOptions,
    inferProductCustomizable,
    refreshProductCustomizableFromRelations,
    customerCatalogQuery,
    availableForChannelQuery,
    customerRelationQuery,
    assertCustomerAvailable,
    assertRelationAvailable,
    getSettingValue,
    writeMenuAudit,
  } = deps;

  function serializeDashboardOption(option) {
    const payload = serializeDoc(option);
    if (!payload) return null;

    const extraPrice = payload.extraPriceHalala || 0;
    const extraFee = (payload.extraFeeHalala !== undefined && payload.extraFeeHalala !== null && payload.extraFeeHalala !== 0)
      ? payload.extraFeeHalala
      : extraPrice;

    return {
      id: payload.id || String(payload._id),
      _id: payload._id,
      groupId: payload.groupId,
      catalogItemId: payload.catalogItemId !== undefined ? payload.catalogItemId : null,
      key: payload.key || "",
      name: payload.name || { ar: "", en: "" },
      description: payload.description || { ar: "", en: "" },
      imageUrl: payload.imageUrl || "",
      extraPriceHalala: extraPrice,
      extraWeightUnitGrams: payload.extraWeightUnitGrams || 0,
      extraWeightPriceHalala: payload.extraWeightPriceHalala || 0,
      currency: payload.currency || SYSTEM_CURRENCY,
      availableFor: payload.availableFor || ["one_time", "subscription"],
      availableForSubscription: payload.availableForSubscription !== undefined ? payload.availableForSubscription : true,
      nutrition: payload.nutrition || { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 },
      proteinFamilyKey: payload.proteinFamilyKey || "",
      displayCategoryKey: payload.displayCategoryKey || "",
      premiumKey: payload.premiumKey || "",
      ruleTags: payload.ruleTags || [],
      selectionType: payload.selectionType || "",
      extraFeeHalala: extraFee,
      isVisible: payload.isVisible !== undefined ? payload.isVisible : true,
      isAvailable: payload.isAvailable !== undefined ? payload.isAvailable : true,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
      sortOrder: payload.sortOrder || 0,
      publishedAt: payload.publishedAt || null,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  }

  async function getDashboardMenuPreview({ lang = "en", includeInactive = false, branchId = "" } = {}) {
    const showInactive = normalizeBoolean(includeInactive, "includeInactive", false);
    const statusQuery = showInactive ? {} : {
      isActive: true,
      isVisible: { $ne: false },
      isAvailable: { $ne: false },
    };
    const productQuery = {
      ...statusQuery,
      ...availableForChannelQuery("one_time"),
    };
    const optionQuery = {
      ...statusQuery,
      ...availableForChannelQuery("one_time"),
    };
    const categoryQuery = { ...statusQuery };
    const relationQuery = { ...statusQuery };
    if (branchId) {
      const channelOr = productQuery.$or;
      delete productQuery.$or;
      productQuery.$and = [
        { $or: channelOr },
        { $or: [{ branchAvailability: { $size: 0 } }, { branchAvailability: branchId }] },
      ];
      categoryQuery.$or = [{ "availability.branchIds": { $size: 0 } }, { "availability.branchIds": branchId }];
    }

    const [categories, products, groupRelations, optionRelations, groups, options, validation] = await Promise.all([
      MenuCategory.find(categoryQuery).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      MenuProduct.find(productQuery).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      ProductOptionGroup.find(relationQuery).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      ProductGroupOption.find(relationQuery).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      MenuOptionGroup.find(statusQuery).lean(),
      MenuOption.find(optionQuery).lean(),
      validateMenuCatalog().catch((err) => ({
        ok: false,
        warnings: [`Preview validation failed: ${err.message || "unknown error"}`],
        errors: [],
      })),
    ]);

    const categoryIds = new Set(categories.map((category) => String(category._id)));
    const categoriesById = new Map(categories.map((category) => [String(category._id), category]));
    const categoriesByKey = new Map(categories.map((category) => [category.key, category]));
    const productsById = new Map(
      products
        .filter((product) => categoryIds.has(String(product.categoryId)))
        .map((product) => [String(product._id), product])
    );
    const groupsById = new Map(groups.map((group) => [String(group._id), group]));
    const optionsById = new Map(options.map((option) => [String(option._id), option]));
    const optionRelationsByProductGroup = new Map();
    const productsByCategory = new Map();

    optionRelations.forEach((relation) => {
      const key = `${relation.productId}:${relation.groupId}`;
      if (!optionRelationsByProductGroup.has(key)) optionRelationsByProductGroup.set(key, []);
      optionRelationsByProductGroup.get(key).push(relation);
    });

    groupRelations.forEach((relation) => {
      const product = productsById.get(String(relation.productId));
      const group = groupsById.get(String(relation.groupId));
      if (!product || !group) return;
      const optionRows = (optionRelationsByProductGroup.get(`${relation.productId}:${relation.groupId}`) || [])
        .map((optionRelation) => {
          const option = optionsById.get(String(optionRelation.optionId));
          if (!option) return null;
          return serializeDashboardPreviewOption(optionRelation, option, lang);
        })
        .filter(Boolean)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const serializedGroup = serializeDashboardPreviewGroup(relation, group, optionRows, lang);
      if (!product._publicGroups) product._publicGroups = [];
      product._publicGroups.push(serializedGroup);
    });

    productsById.forEach((product) => {
      const category = resolvePublicProductCategory(product, categoriesById, categoriesByKey);
      if (!category || String(product.categoryId) !== String(category._id)) return;
      product._publicCategoryKey = category.key;
      const categoryId = String(category._id);
      if (!productsByCategory.has(categoryId)) productsByCategory.set(categoryId, []);
      const groupsForProduct = Array.isArray(product._publicGroups)
        ? product._publicGroups.sort((a, b) => a.sortOrder - b.sortOrder)
        : [];
      productsByCategory.get(categoryId).push(serializeDashboardPreviewProduct(product, lang, groupsForProduct, category._id));
    });

    const serializedCategories = categories
      .map((category) => {
        const rows = (productsByCategory.get(String(category._id)) || [])
          .sort(sortPublicProducts);
        return serializeDashboardPreviewCategory(category, lang, rows);
      })
      .filter((category) => showInactive || category.products.length > 0);

    return {
      contractVersion: "dashboard_menu_preview.v1",
      source: "one_time_order",
      fulfillmentMethod: "pickup",
      currency: SYSTEM_CURRENCY,
      vatIncluded: true,
      vatPercentage: VAT_PERCENTAGE,
      includeInactive: showInactive,
      warnings: [...(validation.warnings || []), ...(validation.errors || [])],
      categories: serializedCategories,
    };
  }

  function buildListQuery({ includeInactive = false, isActive, isVisible, isAvailable, q, published } = {}) {
    const query = {};
    if (isActive !== undefined && isActive !== null && String(isActive).trim() !== "") {
      query.isActive = normalizeBoolean(isActive, "isActive");
    } else if (!includeInactive) {
      query.isActive = true;
    }
    if (isVisible !== undefined && isVisible !== null && String(isVisible).trim() !== "") {
      query.isVisible = normalizeBoolean(isVisible, "isVisible");
    }
    if (isAvailable !== undefined && isAvailable !== null && String(isAvailable).trim() !== "") {
      query.isAvailable = normalizeBoolean(isAvailable, "isAvailable");
    }
    if (published !== undefined && published !== null && String(published).trim() !== "") {
      const showPublished = normalizeBoolean(published, "published");
      query.publishedAt = showPublished ? { $ne: null } : null;
    }
    if (q !== undefined && q !== null && String(q).trim()) {
      const escaped = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [{ key: regex }, { "name.ar": regex }, { "name.en": regex }];
    }
    return query;
  }

  function buildProductFilter(options = {}) {
    const {
      categoryId,
      availableFor,
      itemType,
      search,
    } = options;
    const query = buildListQuery({
      ...options,
      q: options.q || search,
    });

    if (categoryId !== undefined && categoryId !== null && String(categoryId).trim() !== "") {
      if (!mongoose.Types.ObjectId.isValid(String(categoryId))) {
        throw new MenuValidationError("Invalid categoryId", "INVALID_CATEGORY_ID", 400);
      }
      query.categoryId = new mongoose.Types.ObjectId(String(categoryId));
    }

    if (availableFor !== undefined && availableFor !== null && String(availableFor).trim() !== "") {
      const channel = String(availableFor).trim();
      if (!["one_time", "subscription"].includes(channel)) {
        throw new MenuValidationError("availableFor contains an unsupported channel");
      }
      query.availableFor = channel;
    }

    if (itemType !== undefined && itemType !== null && String(itemType).trim() !== "") {
      query.itemType = String(itemType).trim();
    }

    return query;
  }

  async function listModel(Model, options = {}, extraQuery = {}, serializer = serializeDoc) {
    const query = { ...buildListQuery(options), ...extraQuery };
    const pagination = parsePaginationOptions(options);
    const find = Model.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    if (!pagination) {
      const rows = await find;
      return rows.map(serializer);
    }

    const [rows, total] = await Promise.all([
      find.skip(pagination.skip).limit(pagination.limit),
      Model.countDocuments(query),
    ]);

    return {
      items: rows.map(serializer),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    };
  }

  function serializeDashboardPickerProduct(row) {
    return {
      id: String(row._id),
      key: row.key,
      name: row.name,
      category: row.categoryId ? row.categoryId.key : (row.category || ""),
      image: row.imageUrl || "",
      isActive: row.isActive !== false,
    };
  }

  async function listProducts(options = {}) {
    const query = buildProductFilter(options);
    if (options.view === "picker") {
      query.isActive = true;
    }
    
    const pagination = parsePaginationOptions(options);
    let find = MenuProduct.find(query).sort({ sortOrder: 1, createdAt: -1 });
    
    if (options.view === "picker") {
      find = find.populate("categoryId");
    }
    
    find = find.lean();
    const serializeFn = options.view === "picker" ? serializeDashboardPickerProduct : serializeDoc;

    if (!pagination) {
      const rows = await find;
      return rows.map(serializeFn);
    }

    const [rows, total] = await Promise.all([
      find.skip(pagination.skip).limit(pagination.limit),
      MenuProduct.countDocuments(query),
    ]);

    return {
      items: rows.map(serializeFn),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async function listOptions(options = {}) {
    return listModel(
      MenuOption,
      options,
      options && options.groupId ? { groupId: assertObjectId(options.groupId, "groupId") } : {},
      serializeDashboardOption
    );
  }

  async function listCategories(options = {}) {
    return listModel(MenuCategory, options);
  }

  async function listOptionGroups(options = {}) {
    return listModel(MenuOptionGroup, options);
  }

  async function getModel(Model, id, extraQuery = {}) {
    assertObjectId(id);
    const row = await Model.findOne({ _id: id, ...extraQuery }).lean();
    if (!row) throw new MenuNotFoundError();
    return serializeDoc(row);
  }

  function serializeAdminProductSummary(product) {
    const payload = serializeDoc(product);
    payload.isCustomizable = inferProductCustomizable(product);
    return payload;
  }

  function serializeCategoryDetailV3(category, products) {
    const categoryPayload = serializeDoc(category);
    const categoryProducts = (products || []).filter((product) => (
      String(product.categoryId) === String(category._id)
    ));
    return {
      contractVersion: "dashboard_category_detail.v3",
      category: categoryPayload,
      products: categoryProducts.map(serializeAdminProductSummary),
      assignment: {
        relationOwner: "product.categoryId",
        bulkAssignmentEndpoint: `/api/dashboard/menu/categories/${categoryPayload.id}/products`,
      },
      actions: {
        canBulkAssignProducts: true,
        canReorderProducts: true,
      },
    };
  }

  function assertDashboardContractVersion(options = {}) {
    const requested = String(options.contractVersion || "").trim().toLowerCase();
    if (!requested || requested === "v3" || requested === "v4") return;
    throw new MenuValidationError(
      "Dashboard menu contract versions v1 and v2 are no longer supported. Use dashboard v3 or v4.",
      "DASHBOARD_CONTRACT_VERSION_UNSUPPORTED",
      410,
      { supportedContractVersions: ["v3", "v4"] }
    );
  }

  async function getCategoryDetail(id, options = {}) {
    assertDashboardContractVersion(options);
    assertObjectId(id);
    const category = await MenuCategory.findById(id).lean();
    if (!category) throw new MenuNotFoundError();

    const productQuery = {
      categoryId: id,
      ...buildListQuery(options),
    };
    const products = await MenuProduct.find(productQuery)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return serializeCategoryDetailV3(category, products);
  }

  async function getProductDetail(id) {
    assertObjectId(id);
    const product = await MenuProduct.findById(id).lean();
    if (!product) throw new MenuNotFoundError("Product not found");

    const [category, activeGroupCount] = await Promise.all([
      product.categoryId ? MenuCategory.findById(product.categoryId).lean() : null,
      ProductOptionGroup.countDocuments({ productId: id, isActive: true }),
    ]);

    const payload = serializeDoc(product);
    payload.isCustomizable = inferProductCustomizable(product, activeGroupCount > 0 ? [{}] : []);

    return {
      contractVersion: "dashboard_product_detail.v3",
      product: payload,
      category: category ? serializeDoc(category) : null,
      groupSummary: {
        linkedGroupCount: activeGroupCount,
        composerEndpoint: `/api/dashboard/menu/products/${id}/composer`,
        linkEndpoint: `/api/dashboard/menu/products/${id}/option-groups`,
      },
    };
  }

  async function getOptionGroupDetail(id, options = {}) {
    assertDashboardContractVersion(options);
    assertObjectId(id);
    const group = await MenuOptionGroup.findById(id).lean();
    if (!group) throw new MenuNotFoundError();
    const [optionsRows, linkedProductIds] = await Promise.all([
      MenuOption.find({
        groupId: id,
        ...buildListQuery(options),
      }).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      ProductOptionGroup.distinct("productId", { groupId: id, isActive: true }),
    ]);

    return {
      contractVersion: "dashboard_option_group_detail.v3",
      optionGroup: serializeDoc(group),
      options: optionsRows.map(serializeDashboardOption),
      usage: {
        linkedProductsCount: linkedProductIds.length,
      },
      actions: {
        canAddOptions: true,
        canReorderOptions: true,
      },
    };
  }

  async function getOptionDetail(id, options = {}) {
    assertDashboardContractVersion(options);
    assertObjectId(id);
    const option = await MenuOption.findById(id).lean();
    if (!option) throw new MenuNotFoundError();
    const [group, linkedProductIds] = await Promise.all([
      option.groupId ? MenuOptionGroup.findById(option.groupId).lean() : null,
      ProductGroupOption.distinct("productId", { optionId: id, isActive: true }),
    ]);

    return {
      contractVersion: "dashboard_option_detail.v3",
      option: serializeDashboardOption(option),
      optionGroup: group ? serializeDoc(group) : null,
      usage: {
        linkedProductsCount: linkedProductIds.length,
      },
    };
  }

  return {
    serializeDashboardOption,
    getDashboardMenuPreview,
    buildListQuery,
    buildProductFilter,
    listModel,
    serializeDashboardPickerProduct,
    listProducts,
    listOptions,
    listCategories,
    listOptionGroups,
    getModel,
    serializeAdminProductSummary,
    serializeCategoryDetailV3,
    assertDashboardContractVersion,
    getCategoryDetail,
    getProductDetail,
    getOptionGroupDetail,
    getOptionDetail,
  };
}

module.exports = {
  createMenuCatalogAdminService,
};
