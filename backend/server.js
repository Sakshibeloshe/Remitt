const express = require("express");
const cors = require("cors");
const path = require("path");
const { submitRemittance, queryParticipant, getAllTransactions } = require('./fabric-client');
const app = express();
const PORT = 3000;

// ===== Middlewares =====
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded
// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// 
// Serve the frontend on the root endpoint
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'))});

// GET /participant/:id -> Read from Blockchain World State
app.get("/participant/:id", async (req, res) => {
  try {
    const participantData = await queryParticipant(req.params.id);
    res.json(participantData);
  } catch (error) {
    res.status(404).json({ error: "Participant not found on blockchain" });
  }
});

// POST /transaction → create a new transaction
app.post("/transaction", async (req, res) => {
  const { sender, receiver, amount } = req.body;

  if (!sender || !receiver || !amount) {
    return res.status(400).json({ error: "Missing sender, receiver or amount" });
  }

  const txnId = `txn_${Date.now()}`;
  const amountUSD = parseFloat(amount);
  const inrAmount = amountUSD * 92; // Real-world FX plugin could go here

  try {
    // ⛓️ Send it to the Blockchain!
    await submitRemittance(txnId, sender, receiver, amountUSD);

    res.json({ 
      txnId, 
      status: "Verified & Committed to Blockchain", 
      inrAmount 
    });
  } catch (error) {
    // If KYC fails, the blockchain throws an error and the transaction is BLOCKED
    console.error("Blockchain rejected transaction:", error.message);
    res.status(500).json({ error: "Blockchain Rejected: " + error.message });
  }
});

app.get("/ledger", async (req, res) => {
  try {
      const txns = await getAllTransactions();
      res.json(txns);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

app.get("/alerts", async (req, res) => {
    try {
        const txns = await getAllTransactions();
        const flagged = txns.filter(t => t.amlFlagged === true);
        res.json(flagged);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
