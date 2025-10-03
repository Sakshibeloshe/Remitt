// backend/ledger.js
const { v4: uuidv4 } = require("uuid");

let blocks = [];
let blockCount = 0;

function addTransaction(from, to, amount, currency) {
  const txId = uuidv4();
  blockCount++;

  const transaction = {
    block: blockCount,
    txId,
    from,
    to,
    amount,
    currency,
    timestamp: new Date().toISOString(),
  };

  blocks.push(transaction);
  return transaction;
}

function getLedger() {
  return blocks;
}

function getTransaction(txId) {
  return blocks.find(tx => tx.txId === txId);
}

function getAlerts() {
  return blocks.filter(tx => tx.amount > 10000); // Suspicious threshold
}

module.exports = { addTransaction, getLedger, getTransaction, getAlerts };
