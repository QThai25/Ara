import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Thiếu biến môi trường MONGODB_URI. Hãy tạo file Backend/.env từ Backend/.env.example.");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  mongoose.connection.$araTransactionsSupported = Boolean(hello.setName || hello.msg === "isdbgrid");
  console.log("Da ket noi MongoDB");
}
