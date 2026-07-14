import mongoose from "mongoose";
import { ApiError } from "./ApiError.js";

let transactionsSupported;

function transactionUnavailable(error) {
  const message = String(error?.message || "");
  return message.includes("Transaction numbers are only allowed")
    || message.includes("Transaction support is not available")
    || error?.code === 20;
}

export async function runFinancialTransaction(operation, work) {
  if (mongoose.connection.$araTransactionsSupported === false) {
    transactionsSupported = false;
    return work(null);
  }
  if (transactionsSupported === false) return work(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    transactionsSupported = true;
    return result;
  } catch (error) {
    if (!transactionUnavailable(error)) throw error;

    if (process.env.NODE_ENV === "production") {
      throw new ApiError(
        503,
        `Không thể ${operation} vì MongoDB production chưa hỗ trợ transaction. Vui lòng cấu hình replica set.`
      );
    }

    console.warn(`[financial-transaction] ${operation}: MongoDB local không hỗ trợ transaction; đang dùng fallback chỉ dành cho development/test.`);
    transactionsSupported = false;
    return work(null);
  } finally {
    await session.endSession();
  }
}
