const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ===== Middlewares =====
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded

// ===== In-memory Ledger (demo only) =====
let transactions = [];

// ===== Routes =====

// Root check
app.get("/", (req, res) => {
  res.send("✅ Remittance Backend is running! Use /transaction, /ledger, /alerts");
});

// POST /transaction → create a new transaction
app.post("/transaction", (req, res) => {
  console.log("📩 Incoming request body:", req.body); // Debug log

  const { sender, receiver, amount } = req.body;

  if (!sender || !receiver || !amount) {
    return res.status(400).json({ error: "Missing sender, receiver or amount" });
  }

  const txnId = `txn_${Date.now()}`;
  const inrAmount = amount * 82; // USD → INR mock conversion

  const txn = {
    id: txnId,
    sender,
    receiver,
    usd: amount,
    inr: inrAmount,
    status: "confirmed",
    timestamp: new Date().toISOString(),
  };

  transactions.push(txn);

  res.json({ txnId, status: txn.status, inrAmount });
});

// GET /ledger → return all transactions
app.get("/ledger", (req, res) => {
  res.json(transactions);
});

// GET /alerts → suspicious transactions (> $10,000)
app.get("/alerts", (req, res) => {
  const flagged = transactions.filter(t => t.usd > 10000);
  res.json(flagged);
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
