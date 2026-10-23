import express from "express";
import profiles from "./routes/profiles.js";
import posts from "./routes/posts.js";
import { connectDB } from "./db.js";
import { connectModels } from "./models/index.js";

const app = express();

// Connect each URL to its route file.
app.get("/", (req, res) => {
  res.json({ message: "BroncoCircle API is running" });
});
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/profiles", profiles);
app.use("/api/posts", posts);

const port = process.env.PORT || 3000;
try {
  await connectDB();
  connectModels();
} catch {
  console.error("MongoDB connection failed. Check MONGODB_URI and database access.");
  process.exit(1);
}

app.listen(port, (error) => {
  if (error) {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} is already in use. Stop the other server with Ctrl+C, then try again.`
        : `Server failed to start: ${error.message}`,
    );
    process.exit(1);
  }
  console.log(`Server running at http://localhost:${port}`);
});
