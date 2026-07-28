import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: { smoke: { executor: "ramping-vus", stages: [{ duration: "20s", target: 5 }, { duration: "40s", target: 20 }, { duration: "20s", target: 0 }] } },
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<750"] }
};

const base = __ENV.API_BASE_URL || "http://127.0.0.1:4000/api";

export default function () {
  const health = http.get(`${base.replace(/\/api\/?$/, "")}/health`);
  check(health, { "health is ready": (response) => response.status === 200 });
  const products = http.get(`${base}/costumes`);
  check(products, { "product list succeeds": (response) => response.status === 200 });
  sleep(1);
}
