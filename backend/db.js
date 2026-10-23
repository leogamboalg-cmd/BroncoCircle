import { MongoClient } from "mongodb";
import "dotenv/config";

export let db;

export async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.log("MongoDB skipped: set MONGODB_URI in backend/.env to connect.");
    return;
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    db = client.db("MiniHacks");
    await db.command({ ping: 1 });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    await client.close();
    throw error;
  }
}
