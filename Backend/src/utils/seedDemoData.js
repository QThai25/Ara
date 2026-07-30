import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Category } from "../models/Category.js";
import { Costume } from "../models/Costume.js";
import { Brand } from "../models/Brand.js";
import { Occasion } from "../models/Occasion.js";
import { Style } from "../models/Style.js";
import { brandToSlug } from "../services/brand.service.js";

const brandSeedNames = [
  "21SIX", "2Fleurs", "Aesthete.stu", "AGUJA", "ALDO", "AMELIE", "Amy Store", "Bandage Dress",
  "BELLE PHUONG THAO", "Beloved", "BYDI", "Calista De Minh Thanh", "Chloe Design", "CICI",
  "DANG HOANG", "Darling Diva", "Das La Vie", "DATT", "DING DANG", "DO LONG", "EMCHIC",
  "HA CUC", "Huy Tran", "JIRENE", "JOSEPHINE", "KAMOSET", "LALIN", "LAM KHUE", "LEGER",
  "LIBRE", "PHAN HUY", "PHUNG MINH LONG", "RITARA", "THANH TRAN", "VAS", "Xita"
];

const occasionSeeds = [
  { name: "Dự tiệc", slug: "party", icon: "party", sortOrder: 1 },
  { name: "Du lịch", slug: "travel", icon: "travel", sortOrder: 2 },
  { name: "Dạ hội", slug: "gala", icon: "gala", sortOrder: 3 },
  { name: "Công sở", slug: "office", icon: "office", sortOrder: 4 },
  { name: "Lễ hội", slug: "festival", icon: "festival", sortOrder: 5 },
  { name: "Hẹn hò dạo phố", slug: "date-walk", icon: "date-walk", sortOrder: 6 },
  { name: "Thư giãn", slug: "relax", icon: "relax", sortOrder: 7 },
  { name: "Bãi biển", slug: "beach", icon: "beach", sortOrder: 8 },
  { name: "Thuê theo set", slug: "set", icon: "set", sortOrder: 9 }
];

const styleSeeds = [
  { name: "Truyền thống", slug: "traditional", icon: "traditional", sortOrder: 1 },
  { name: "Công chúa", slug: "princess", icon: "princess", sortOrder: 2 },
  { name: "Vintage - Bohemian", slug: "vintage-bohemian", icon: "vintage-bohemian", sortOrder: 3 },
  { name: "Cá tính", slug: "personality", icon: "personality", sortOrder: 4 },
  { name: "Năng động", slug: "dynamic", icon: "dynamic", sortOrder: 5 },
  { name: "Casual", slug: "casual", icon: "casual", sortOrder: 6 },
  { name: "Gợi cảm", slug: "sexy", icon: "sexy", sortOrder: 7 },
  { name: "Thanh lịch", slug: "elegant", icon: "elegant", sortOrder: 8 }
];

export async function seedDefaultFilterOptions() {
  await Promise.all([
    ...occasionSeeds.map((item) => Occasion.updateOne({ slug: item.slug }, { $setOnInsert: { ...item, status: "active", isVisible: true } }, { upsert: true })),
    ...styleSeeds.map((item) => Style.updateOne({ slug: item.slug }, { $setOnInsert: { ...item, status: "active", isVisible: true } }, { upsert: true }))
  ]);
}

const categoryDefaultRules = {
  "ao-dai": { occasions: ["festival", "party"], styles: ["traditional", "elegant"] },
  "da-hoi": { occasions: ["gala", "party"], styles: ["elegant", "sexy"] },
  "co-trang": { occasions: ["festival", "set"], styles: ["traditional", "princess"] }
};

export async function seedCategoryClassificationDefaults() {
  const [styles, occasions, categories] = await Promise.all([
    Style.find(),
    Occasion.find(),
    Category.find({
      $or: [
        { classificationDefaultsInitialized: { $ne: true } },
        { multiClassificationDefaultsInitialized: { $ne: true } }
      ]
    })
  ]);
  const styleBySlug = new Map(styles.map((item) => [item.slug, item]));
  const occasionBySlug = new Map(occasions.map((item) => [item.slug, item]));

  await Promise.all(categories.map((category) => {
    const rule = categoryDefaultRules[category.slug] || {
      occasions: [category.defaultOccasionSlug, "party"].filter(Boolean),
      styles: [category.defaultStyleSlug, "casual"].filter(Boolean)
    };
    const selectedStyles = [...new Set(rule.styles)].map((slug) => styleBySlug.get(slug)).filter(Boolean);
    const selectedOccasions = [...new Set(rule.occasions)].map((slug) => occasionBySlug.get(slug)).filter(Boolean);
    if (!category.defaultStyleIds?.length && selectedStyles.length) {
      category.defaultStyleIds = selectedStyles.map((item) => item._id);
      category.defaultStyleId = selectedStyles[0]._id;
      category.defaultStyleSlug = selectedStyles[0].slug;
      category.defaultStyleName = selectedStyles[0].name;
    }
    if (!category.defaultOccasionIds?.length && selectedOccasions.length) {
      category.defaultOccasionIds = selectedOccasions.map((item) => item._id);
      category.defaultOccasionId = selectedOccasions[0]._id;
      category.defaultOccasionSlug = selectedOccasions[0].slug;
      category.defaultOccasionName = selectedOccasions[0].name;
    }
    category.classificationDefaultsInitialized = true;
    category.multiClassificationDefaultsInitialized = true;
    return category.save();
  }));
}

export async function seedCostumeTaxonomy() {
  await seedDefaultFilterOptions();
  await seedCategoryClassificationDefaults();
}

async function seedBrands() {
  const existingBrands = await Brand.countDocuments();
  if (existingBrands === 0) {
    await Brand.create(brandSeedNames.map((name) => ({ name, slug: brandToSlug(name), status: "active" })));
  }
  return Brand.find({ slug: { $in: brandSeedNames.map(brandToSlug) } }).sort({ name: 1 });
}

async function attachBrandsToExistingCostumes(brands) {
  if (!brands.length) return;
  const costumes = await Costume.find({ $or: [{ brandSlug: "" }, { brandSlug: { $exists: false } }] }).limit(24);
  await Promise.all(costumes.map((costume, index) => {
    const brand = brands[index % brands.length];
    costume.brandId = brand._id;
    costume.brandName = brand.name;
    costume.brandSlug = brand.slug;
    return costume.save();
  }));
}

async function ensureBrandCoverage(brands) {
  const prioritySlugs = ["amelie", "do-long", "lam-khue"];
  const priorityBrands = prioritySlugs.map((slug) => brands.find((brand) => brand.slug === slug)).filter(Boolean);
  if (!priorityBrands.length) return;

  const costumes = await Costume.find().sort({ createdAt: -1 }).limit(priorityBrands.length);
  await Promise.all(priorityBrands.map(async (brand, index) => {
    const hasCostume = await Costume.exists({ brandSlug: brand.slug });
    const costume = costumes[index];
    if (hasCostume || !costume) return null;
    costume.brandId = brand._id;
    costume.brandName = brand.name;
    costume.brandSlug = brand.slug;
    return costume.save();
  }));
}

async function attachFilterOptionsToSampleCostumes() {
  const rules = [
    { name: /áo dài|ao dai|sen/i, occasion: "festival", style: "traditional" },
    { name: /dạ hội|da hoi|xanh ngọc|xanh ngoc/i, occasion: "gala", style: "elegant" },
    { name: /cổ trang|co trang|kim sa/i, occasion: "festival", style: "traditional" }
  ];

  await Promise.all(rules.map((rule) => Costume.updateMany(
    { name: rule.name, $or: [{ occasion: "" }, { occasion: { $exists: false } }, { style: "" }, { style: { $exists: false } }] },
    { $set: { occasion: rule.occasion, style: rule.style } }
  )));
}

export async function seedDemoData() {
  await seedCostumeTaxonomy();
  if (process.env.SEED_DEMO_DATA !== "true") return;
  const brands = await seedBrands();
  const brandBySlug = new Map(brands.map((brand) => [brand.slug, brand]));
  await attachBrandsToExistingCostumes(brands);
  await ensureBrandCoverage(brands);
  await attachFilterOptionsToSampleCostumes();

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) return;

  const demoAdminPassword = String(process.env.SEED_DEMO_ADMIN_PASSWORD || "");
  const demoCustomerPassword = String(process.env.SEED_DEMO_CUSTOMER_PASSWORD || "");
  if (demoAdminPassword.length < 8 || demoCustomerPassword.length < 8) {
    throw new Error("SEED_DEMO_ADMIN_PASSWORD and SEED_DEMO_CUSTOMER_PASSWORD must each contain at least 8 characters.");
  }
  const [adminPassword, customerPassword] = await Promise.all([
    bcrypt.hash(demoAdminPassword, 10),
    bcrypt.hash(demoCustomerPassword, 10)
  ]);
  await User.create([
    { name: "Chủ tiệm Ara", email: "admin@ara.vn", phone: "0900000000", password: adminPassword, role: "owner" },
    { name: "Khách mẫu", email: "khach@ara.vn", phone: "0911111111", password: customerPassword, role: "customer" }
  ]);

  const categories = await Category.create([
    { name: "Áo dài", slug: "ao-dai", description: "Áo dài cưới, lễ, chụp ảnh" },
    { name: "Dạ hội", slug: "da-hoi", description: "Váy tiệc và trang phục sự kiện" },
    { name: "Cổ trang", slug: "co-trang", description: "Trang phục biểu diễn và concept" }
  ]);

  const amelie = brandBySlug.get("amelie") || brands[0];
  const doLong = brandBySlug.get("do-long") || brands[1] || amelie;
  const lamKhue = brandBySlug.get("lam-khue") || brands[2] || amelie;

  await Costume.create([
    {
      name: "Áo dài lụa sen trắng",
      description: "Áo dài lụa mềm, họa tiết sen thêu tay, phù hợp lễ ăn hỏi và chụp ảnh.",
      categoryId: categories[0]._id,
      brandId: lamKhue._id,
      brandName: lamKhue.name,
      brandSlug: lamKhue.slug,
      size: "M",
      color: "Trắng",
      occasion: "festival",
      style: "traditional",
      rentalPricePerDay: 280000,
      depositAmount: 700000,
      status: "available",
      images: ["https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80"],
      skuCode: "AD-SEN-M",
      accessories: "Mấn trắng, khăn voan",
      conditionNote: "Mới 90%, không lỗi"
    },
    {
      name: "Váy dạ hội xanh ngọc",
      description: "Váy form A nhẹ, đính đá phần vai, dễ di chuyển trong tiệc tối.",
      categoryId: categories[1]._id,
      brandId: amelie._id,
      brandName: amelie.name,
      brandSlug: amelie.slug,
      size: "S",
      color: "Xanh ngọc",
      occasion: "gala",
      style: "elegant",
      rentalPricePerDay: 420000,
      depositAmount: 1000000,
      status: "available",
      images: ["https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80"],
      skuCode: "DH-XN-S",
      accessories: "Túi cầm tay bạc",
      conditionNote: "Đã vệ sinh"
    },
    {
      name: "Bộ cổ trang đỏ kim sa",
      description: "Set cổ trang nổi bật cho quay video, kèm đai lưng và phụ kiện tóc.",
      categoryId: categories[2]._id,
      brandId: doLong._id,
      brandName: doLong.name,
      brandSlug: doLong.slug,
      size: "L",
      color: "Đỏ",
      occasion: "festival",
      style: "traditional",
      rentalPricePerDay: 360000,
      depositAmount: 900000,
      status: "washing",
      images: ["https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=1200&q=80"],
      skuCode: "CT-DO-L",
      accessories: "Đai lưng, trâm tóc",
      conditionNote: "Đang giặt sau đơn gần nhất"
    }
  ]);
  await seedCategoryClassificationDefaults();
}
