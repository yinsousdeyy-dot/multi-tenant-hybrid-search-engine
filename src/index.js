// – glue everything together

import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import documentsRouter from "./routes/documents.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/documents", documentsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Hybrid search API listening on http://localhost:${PORT}`);
});
