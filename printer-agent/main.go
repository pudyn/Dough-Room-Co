// Print Agent — menerima byte ESC/POS dari Web POS dan mencetaknya RAW
// ke printer Windows (termasuk printer Bluetooth yang sudah di-pair).
//
// Endpoint:
//   GET  /status   → cek agent hidup + daftar printer
//   POST /print    → {"data": "<base64 ESC/POS>", "printer": "<nama opsional>"}
//
// Default listen 127.0.0.1:17123 (lokal saja). Untuk POS dari HP di jaringan
// yang sama, set variabel PRINTER_AGENT_BIND=0.0.0.0:17123 lalu dari HP
// arahkan ke http://<IP-PC>:17123 (frontend: localStorage "printer_agent_url").
package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

const defaultAddr = "127.0.0.1:17123"

type printRequest struct {
	Data    string `json:"data"`    // base64 dari byte ESC/POS
	Printer string `json:"printer"` // nama printer Windows (opsional, kosong = default)
}

type statusResponse struct {
	OK       bool     `json:"ok"`
	Printer  string   `json:"printer"`
	Printers []string `json:"printers"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /status", handleStatus)
	mux.HandleFunc("POST /print", handlePrint)

	addr := os.Getenv("PRINTER_AGENT_BIND")
	if addr == "" {
		addr = defaultAddr
	}

	fmt.Printf("printer-agent listening di http://%s\n", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statusResponse{
		OK:       true,
		Printer:  defaultPrinterName(),
		Printers: listPrinters(),
	})
}

func handlePrint(w http.ResponseWriter, r *http.Request) {
	var req printRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Data == "" {
		httpError(w, http.StatusBadRequest, "body harus JSON {data: base64}")
		return
	}

	raw, err := base64.StdEncoding.DecodeString(req.Data)
	if err != nil {
		httpError(w, http.StatusBadRequest, "data bukan base64 valid: "+err.Error())
		return
	}

	printerName := req.Printer
	if printerName == "" {
		printerName = defaultPrinterName()
	}
	if printerName == "" {
		httpError(w, http.StatusUnprocessableEntity, "tidak ada printer default; pair/install printer dulu atau kirim field 'printer'")
		return
	}

	if err := printRaw(printerName, raw); err != nil {
		log.Printf("print gagal (%s): %v", printerName, err)
		httpError(w, http.StatusInternalServerError, "gagal mencetak: "+err.Error())
		return
	}

	log.Printf("tercetak %d byte ke %q", len(raw), printerName)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "printer": printerName, "bytes": len(raw)})
}

func httpError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": msg})
}
