import { Crown, Flower2, Gem, Gift, Heart, Luggage, Martini, Palmtree, PartyPopper, Ribbon, Shirt, Sparkles, Star, Sun, TentTree, Umbrella, WandSparkles } from "lucide-react";

export const slugAliases = {
  party: "du-tiec",
  travel: "du-lich",
  gala: "da-hoi",
  office: "cong-so",
  festival: "le-hoi",
  "date-walk": "hen-ho-dao-pho",
  relax: "thu-gian",
  beach: "bai-bien",
  set: "thue-theo-set",
  traditional: "truyen-thong",
  princess: "cong-chua",
  personality: "ca-tinh",
  dynamic: "nang-dong",
  sexy: "goi-cam",
  elegant: "thanh-lich"
};

export const reverseSlugAliases = Object.fromEntries(Object.entries(slugAliases).map(([legacy, modern]) => [modern, legacy]));

export function canonicalSlug(value = "") {
  return slugAliases[value] || value;
}

export const filterIconMap = {
  "du-tiec": Martini,
  party: Martini,
  "du-lich": Luggage,
  travel: Luggage,
  "da-hoi": Sparkles,
  gala: Sparkles,
  "cong-so": Gem,
  office: Gem,
  "le-hoi": PartyPopper,
  festival: PartyPopper,
  "hen-ho-dao-pho": Heart,
  "date-walk": Heart,
  "thu-gian": Sun,
  relax: Sun,
  "bai-bien": Palmtree,
  beach: Palmtree,
  "thue-theo-set": Ribbon,
  set: Ribbon,
  "truyen-thong": Flower2,
  traditional: Flower2,
  "cong-chua": Crown,
  princess: Crown,
  "vintage-bohemian": TentTree,
  "ca-tinh": WandSparkles,
  personality: WandSparkles,
  "nang-dong": Star,
  dynamic: Star,
  casual: Umbrella,
  "goi-cam": Sparkles,
  sexy: Sparkles,
  "thanh-lich": Gem,
  elegant: Gem
};

export const defaultFilterIcon = Sparkles;

export const fallbackImages = [
  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=85"
];

export const benefits = [
  {
    icon: Shirt,
    title: "Tủ đồ Ara",
    description: "Hơn 1000 sản phẩm cao cấp, đa dạng phong cách",
    to: "/costumes"
  },
  {
    icon: Sparkles,
    title: "Bộ sưu tập mới",
    description: "Luôn cập nhật những bộ sưu tập thịnh hành",
    to: "/costumes?sort=newest"
  },
  {
    icon: Gift,
    title: "Ưu đãi",
    description: "Hưởng nhiều ưu đãi hấp dẫn khi thuê tại Ara",
    to: "/offers"
  }
];

export const occasions = [
  { icon: Martini, label: "Dự tiệc", name: "Dự tiệc", type: "occasion", value: "du-tiec", slug: "du-tiec" },
  { icon: Luggage, label: "Du lịch", name: "Du lịch", type: "occasion", value: "du-lich", slug: "du-lich" },
  { icon: Sparkles, label: "Dạ hội", name: "Dạ hội", type: "occasion", value: "da-hoi", slug: "da-hoi" },
  { icon: Gem, label: "Công sở", name: "Công sở", type: "occasion", value: "cong-so", slug: "cong-so" },
  { icon: PartyPopper, label: "Lễ hội", name: "Lễ hội", type: "occasion", value: "le-hoi", slug: "le-hoi" },
  { icon: Heart, label: "Hẹn hò dạo phố", name: "Hẹn hò dạo phố", type: "occasion", value: "hen-ho-dao-pho", slug: "hen-ho-dao-pho" },
  { icon: Sun, label: "Thư giãn", name: "Thư giãn", type: "occasion", value: "thu-gian", slug: "thu-gian" },
  { icon: Palmtree, label: "Bãi biển", name: "Bãi biển", type: "occasion", value: "bai-bien", slug: "bai-bien" },
  { icon: Ribbon, label: "Thuê theo set", name: "Thuê theo set", type: "occasion", value: "thue-theo-set", slug: "thue-theo-set" }
];

export const styles = [
  { icon: Flower2, label: "Truyền thống", name: "Truyền thống", type: "style", value: "truyen-thong", slug: "truyen-thong" },
  { icon: Crown, label: "Công chúa", name: "Công chúa", type: "style", value: "cong-chua", slug: "cong-chua" },
  { icon: TentTree, label: "Vintage - Bohemian", name: "Vintage - Bohemian", type: "style", value: "vintage-bohemian", slug: "vintage-bohemian" },
  { icon: WandSparkles, label: "Cá tính", name: "Cá tính", type: "style", value: "ca-tinh", slug: "ca-tinh" },
  { icon: Star, label: "Năng động", name: "Năng động", type: "style", value: "nang-dong", slug: "nang-dong" },
  { icon: Umbrella, label: "Casual", name: "Casual", type: "style", value: "casual", slug: "casual" },
  { icon: Sparkles, label: "Gợi cảm", name: "Gợi cảm", type: "style", value: "goi-cam", slug: "goi-cam" },
  { icon: Gem, label: "Thanh lịch", name: "Thanh lịch", type: "style", value: "thanh-lich", slug: "thanh-lich" }
];

export const occasionLabelBySlug = Object.fromEntries(occasions.flatMap((item) => [[item.slug, item.label], [reverseSlugAliases[item.slug], item.label]].filter(([key]) => key)));
export const styleLabelBySlug = Object.fromEntries(styles.flatMap((item) => [[item.slug, item.label], [reverseSlugAliases[item.slug], item.label]].filter(([key]) => key)));

export function productMaterial(costume) {
  if (costume.material) return `Chất liệu: ${costume.material}`;
  const text = `${costume.description || ""} ${costume.conditionNote || ""}`.toLowerCase();
  if (text.includes("lụa")) return "Chất liệu: lụa mềm";
  if (text.includes("đá")) return "Chất liệu: đính đá";
  if (text.includes("voan")) return "Chất liệu: voan nhẹ";
  return "Chất liệu: cao cấp";
}

export function memberPrice(costume) {
  return Math.max(0, Math.round((costume.memberPrice || costume.rentalPricePerDay || 0) * (costume.memberPrice ? 1 : 0.9)));
}
