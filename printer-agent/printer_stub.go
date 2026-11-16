//go:build !windows

package main

import "fmt"

func printRaw(printerName string, data []byte) error {
	return fmt.Errorf("print agent hanya mendukung Windows")
}

func listPrinters() []string { return nil }

func defaultPrinterName() string { return "" }
