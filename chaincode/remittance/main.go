package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing remittance
type SmartContract struct {
	contractapi.Contract
}

// Participant represents a user (sender/receiver) with KYC status
type Participant struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Bank      string  `json:"bank"`
	Balance   float64 `json:"balance"`
	KYCStatus bool    `json:"kycStatus"` // True means KYC is verified
}

// RemittanceTransaction represents a cross-border payment
type RemittanceTransaction struct {
	TxID       string  `json:"txId"`
	SenderID   string  `json:"senderId"`
	ReceiverID string  `json:"receiverId"`
	AmountUSD  float64 `json:"amountUSD"`
	Status     string  `json:"status"`
	AMLFlagged bool    `json:"amlFlagged"` // Anti-Money Laundering flag
}

// InitLedger initializes the ledger with some test data
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	participants := []Participant{
		{ID: "alice_01", Name: "Alice", Bank: "US_Bank", Balance: 50000.0, KYCStatus: true},
		{ID: "bob_02", Name: "Bob", Bank: "India_Bank", Balance: 1000.0, KYCStatus: true},
		{ID: "charlie_03", Name: "Charlie", Bank: "US_Bank", Balance: 15000.0, KYCStatus: false}, // KYC Pending
	}

	for _, p := range participants {
		pJSON, err := json.Marshal(p)
		if err != nil {
			return err
		}
		// PutState saves the data to the World State
		err = ctx.GetStub().PutState(p.ID, pJSON)
		if err != nil {
			return fmt.Errorf("failed to put state for %s: %v", p.ID, err)
		}
	}
	return nil
}

// ProcessRemittance is the main function invoked by your Node.js backend
func (s *SmartContract) ProcessRemittance(ctx contractapi.TransactionContextInterface, txId string, senderId string, receiverId string, amountUSD float64) error {

	// 1. Fetch Sender from ledger
	senderJSON, err := ctx.GetStub().GetState(senderId)
	if err != nil || senderJSON == nil {
		return fmt.Errorf("sender %s does not exist", senderId)
	}
	var sender Participant
	json.Unmarshal(senderJSON, &sender)

	// 2. Fetch Receiver from ledger
	receiverJSON, err := ctx.GetStub().GetState(receiverId)
	if err != nil || receiverJSON == nil {
		return fmt.Errorf("receiver %s does not exist", receiverId)
	}
	var receiver Participant
	json.Unmarshal(receiverJSON, &receiver)

	// --- 🛡️ RULE 1: KYC ENFORCEMENT ---
	if !sender.KYCStatus || !receiver.KYCStatus {
		return fmt.Errorf("KYC validation failed: both participants must be KYC verified")
	}

	// --- 🛡️ RULE 2: AML ENFORCEMENT ---
	amlFlagged := false
	status := "COMPLETED"

	if amountUSD > 10000 {
		amlFlagged = true
		status = "AML_HELD" // Flags it for the Regulator Dashboard
	} else {
		// Only deduct/add balance if not held by AML
		if sender.Balance < amountUSD {
			return fmt.Errorf("insufficient funds")
		}
		sender.Balance -= amountUSD
		receiver.Balance += amountUSD // (In a real app, apply FX rate here)

		// Update balances in World State
		updatedSenderJSON, _ := json.Marshal(sender)
		ctx.GetStub().PutState(senderId, updatedSenderJSON)

		updatedReceiverJSON, _ := json.Marshal(receiver)
		ctx.GetStub().PutState(receiverId, updatedReceiverJSON)
	}

	// 3. Record the Transaction Receipt
	remittanceTx := RemittanceTransaction{
		TxID:       txId,
		SenderID:   senderId,
		ReceiverID: receiverId,
		AmountUSD:  amountUSD,
		Status:     status,
		AMLFlagged: amlFlagged,
	}

	txJSON, err := json.Marshal(remittanceTx)
	if err != nil {
		return err
	}

	// Save transaction history
	return ctx.GetStub().PutState(txId, txJSON)
}

// QueryParticipant returns the participant details (balance, KYC status) from the ledger
func (s *SmartContract) QueryParticipant(ctx contractapi.TransactionContextInterface, id string) (*Participant, error) {
	pJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if pJSON == nil {
		return nil, fmt.Errorf("the participant %s does not exist", id)
	}

	var participant Participant
	err = json.Unmarshal(pJSON, &participant)
	if err != nil {
		return nil, err
	}

	return &participant, nil
}

// QueryTransaction returns a specific transaction record from the ledger
func (s *SmartContract) QueryTransaction(ctx contractapi.TransactionContextInterface, txId string) (*RemittanceTransaction, error) {
	txJSON, err := ctx.GetStub().GetState(txId)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if txJSON == nil {
		return nil, fmt.Errorf("the transaction %s does not exist", txId)
	}

	var transaction RemittanceTransaction
	err = json.Unmarshal(txJSON, &transaction)
	if err != nil {
		return nil, err
	}

	return &transaction, nil
}

// GetAllTransactions returns all transactions found in world state
func (s *SmartContract) GetAllTransactions(ctx contractapi.TransactionContextInterface) ([]*RemittanceTransaction, error) {
    // A basic query returning all keys will get participants too, 
    // so a real world app uses CouchDB index or composit keys.
    // For demo: range query (this is a simplified approach)
    resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
    if err != nil {
        return nil, err
    }
    defer resultsIterator.Close()

    var transactions []*RemittanceTransaction
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }

        var transaction RemittanceTransaction
        err = json.Unmarshal(queryResponse.Value, &transaction)
        // Filter out participants by checking if TxID exists
        if err == nil && transaction.TxID != "" {
            transactions = append(transactions, &transaction)
        }
    }

    return transactions, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating remittance chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting remittance chaincode: %v", err)
	}
}
