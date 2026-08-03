export const views = {
  home: "home",
  login: "login",
  register: "register",
  forgotPassword: "forgotPassword",
  catalog: "catalog",
  detail: "detail",
  cart: "cart",
  wishlist: "wishlist",
  policy: "policy",
  contact: "contact",
  offers: "offers",
  orders: "orders"
  ,rentalOrderSuccess: "rentalOrderSuccess"
  ,rentalOrderLookup: "rentalOrderLookup"
  ,publicRentalOrderResult: "publicRentalOrderResult"
  ,terms: "terms"
  ,privacy: "privacy"
  ,account: "account"
};

export function viewFromPath(pathname) {
  if (pathname === "/") return { view: views.home };
  if (pathname === "/costumes") return { view: views.catalog };
  if (pathname.startsWith("/costumes/")) return { view: views.detail, costumeId: pathname.split("/")[2] };
  if (pathname === "/login") return { view: views.login };
  if (pathname === "/register") return { view: views.register };
  if (pathname === "/forgot-password") return { view: views.forgotPassword };
  if (pathname === "/rental-cart") return { view: views.cart };
  if (pathname === "/wishlist") return { view: views.wishlist };
  if (pathname === "/rental-policy") return { view: views.policy };
  if (pathname === "/terms") return { view: views.terms };
  if (pathname === "/privacy") return { view: views.privacy };
  if (pathname === "/contact") return { view: views.contact };
  if (pathname === "/offers") return { view: views.offers };
  if (pathname === "/account") return { view: views.account };
  if (pathname === "/my-rentals") return { view: views.orders };
  if (pathname.startsWith("/my-rentals/")) return { view: views.orders, orderId: pathname.split("/")[2] };
  if (pathname === "/my-payments") return { view: views.orders };
  if (pathname.startsWith("/my-payments/")) return { view: views.orders };
  if (pathname.startsWith("/rental-orders/success/")) return { view: views.rentalOrderSuccess };
  if (pathname === "/rental-orders/lookup") return { view: views.rentalOrderLookup };
  if (pathname === "/rental-orders/lookup/result") return { view: views.publicRentalOrderResult };
  return { view: views.home };
}

export const paths = {
  home: "/",
  catalog: "/costumes",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  cart: "/rental-cart",
  wishlist: "/wishlist",
  policy: "/rental-policy",
  terms: "/terms",
  privacy: "/privacy",
  contact: "/contact",
  offers: "/offers",
  account: "/account",
  orders: "/my-rentals",
  orderDetail: (id) => `/my-rentals/${id}`,
  payments: "/my-payments",
  paymentDetail: (id) => `/my-payments/${id}`,
  detail: (id) => `/costumes/${id}`
  ,rentalOrderSuccess: code => `/rental-orders/success/${encodeURIComponent(code)}`
  ,rentalOrderLookup: "/rental-orders/lookup"
  ,publicRentalOrderResult: "/rental-orders/lookup/result"
};
