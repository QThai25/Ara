import { api, UPLOAD_TIMEOUT_MS } from "./api.js";

const base = "/admin/refund-transactions";
export const listRefundTransactions = (params, config = {}) => api.get(base, { ...config, params });
export const searchRefundTransactions = (params) => api.get(`${base}/search`, { params });
export const getRefundTransactionContext = (params) => api.get(`${base}/context`, { params });
export const createRefundTransaction = (body) => api.post(base, body);
export const getRefundTransaction = (id) => api.get(`${base}/${id}`);
export const startRefundTransaction = (id) => api.patch(`${base}/${id}/start`);
export const completeRefundTransaction = (id, body) => api.patch(`${base}/${id}/complete`, body);
export const failRefundTransaction = (id, body) => api.patch(`${base}/${id}/fail`, body);
export const retryRefundTransaction = (id) => api.patch(`${base}/${id}/retry`);
export const cancelRefundTransaction = (id, body) => api.patch(`${base}/${id}/cancel`, body);
export const requestRefundTransactionInformation = (id) => api.post(`${base}/${id}/request-information`);
export const recordRefundTransactionContact = (id, body) => api.patch(`${base}/${id}/contact`, body);
export const uploadRefundTransactionProof = (id, file) => {
  const body = new FormData();
  body.append("image", file);
  return api.post(`${base}/${id}/proofs`, body, { timeout: UPLOAD_TIMEOUT_MS });
};
