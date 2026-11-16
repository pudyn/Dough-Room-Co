//go:build windows

package main

import (
	"fmt"
	"syscall"
	"unsafe"
)

var (
	winspool             = syscall.NewLazyDLL("winspool.drv")
	procOpenPrinterW     = winspool.NewProc("OpenPrinterW")
	procClosePrinter     = winspool.NewProc("ClosePrinter")
	procStartDocPrinterW = winspool.NewProc("StartDocPrinterW")
	procEndDocPrinter    = winspool.NewProc("EndDocPrinter")
	procStartPagePrinter = winspool.NewProc("StartPagePrinter")
	procWritePrinter     = winspool.NewProc("WritePrinter")
	procEndPagePrinter   = winspool.NewProc("EndPagePrinter")
	procEnumPrintersW    = winspool.NewProc("EnumPrintersW")
	procGetDefaultPrinterW = winspool.NewProc("GetDefaultPrinterW")
)

type docInfoW struct {
	DocName   *uint16
	OutputFile *uint16
	Datatype  *uint16
}

func toUTF16(s string) *uint16 {
	p, _ := syscall.UTF16PtrFromString(s)
	return p
}

// printRaw mengirim byte mentah (RAW datatype) ke printer via Windows spooler.
func printRaw(printerName string, data []byte) error {
	var hPrinter syscall.Handle
	r1, _, err := procOpenPrinterW.Call(
		uintptr(unsafe.Pointer(toUTF16(printerName))),
		uintptr(unsafe.Pointer(&hPrinter)),
		0,
	)
	if r1 == 0 {
		return fmt.Errorf("gagal buka printer %q: %v", printerName, err)
	}
	defer procClosePrinter.Call(uintptr(hPrinter))

	datatype, _ := syscall.UTF16PtrFromString("RAW")
	doc := docInfoW{
		DocName:   toUTF16("POS Receipt"),
		OutputFile: nil,
		Datatype:  datatype,
	}

	var jobID uint32
	r1, _, err = procStartDocPrinterW.Call(
		uintptr(hPrinter),
		1,
		uintptr(unsafe.Pointer(&doc)),
	)
	if r1 == 0 {
		return fmt.Errorf("gagal mulai job dokumen: %v", err)
	}
	jobID = uint32(r1)
	_ = jobID

	if r1, _, _ = procStartPagePrinter.Call(uintptr(hPrinter)); r1 == 0 {
		return fmt.Errorf("gagal mulai halaman")
	}
	defer procEndPagePrinter.Call(uintptr(hPrinter))

	var written uint32
	r1, _, err = procWritePrinter.Call(
		uintptr(hPrinter),
		uintptr(unsafe.Pointer(&data[0])),
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&written)),
	)
	if r1 == 0 {
		return fmt.Errorf("gagal kirim data ke printer: %v", err)
	}

	if r1, _, _ = procEndDocPrinter.Call(uintptr(hPrinter)); r1 == 0 {
		return fmt.Errorf("gagal akhiri job dokumen")
	}
	return nil
}

// listPrinters mengembalikan nama-nama printer lokal yang terpasang.
func listPrinters() []string {
	const (
		enumLocal       = 2 // PRINTER_ENUM_LOCAL
		enumConnections = 4 // PRINTER_ENUM_CONNECTIONS
		level           = 4 // PRINTER_INFO_4
	)
	var needed, returned uint32
	// Panggil pertama untuk ukuran buffer
	procEnumPrintersW.Call(enumLocal|enumConnections, 0, level, 0, 0,
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if needed == 0 {
		return nil
	}
	buf := make([]byte, needed)
	if r1, _, _ := procEnumPrintersW.Call(enumLocal|enumConnections, 0, level, uintptr(unsafe.Pointer(&buf[0])), uintptr(needed),
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned))); r1 == 0 {
		return nil
	}

	// PRINTER_INFO_4 { pPrinterName *uint16; pServerName *uint16; Attributes uint32 }
	type printerInfo4 struct {
		pPrinterName *uint16
		pServerName  *uint16
		Attributes   uint32
	}
	infos := unsafe.Slice((*printerInfo4)(unsafe.Pointer(&buf[0])), returned)
	names := make([]string, 0, returned)
	for _, info := range infos {
		if s := utf16InBuf(info.pPrinterName, buf); s != "" {
			names = append(names, s)
		}
	}
	return names
}

// utf16InBuf membaca string null-terminated yang berada di dalam buf.
func utf16InBuf(p *uint16, buf []byte) string {
	if p == nil {
		return ""
	}
	base := uintptr(unsafe.Pointer(&buf[0]))
	end := base + uintptr(len(buf))
	maxLen := int((end - uintptr(unsafe.Pointer(p))) / 2)
	if maxLen <= 0 {
		return ""
	}
	return syscall.UTF16ToString(unsafe.Slice(p, maxLen))
}

// defaultPrinterName mengembalikan nama printer default Windows ("" jika tidak ada).
func defaultPrinterName() string {
	var needed uint32
	procGetDefaultPrinterW.Call(0, uintptr(unsafe.Pointer(&needed)))
	if needed == 0 {
		return ""
	}
	buf := make([]uint16, needed)
	if r1, _, _ := procGetDefaultPrinterW.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&needed))); r1 == 0 {
		return ""
	}
	return syscall.UTF16ToString(buf)
}
