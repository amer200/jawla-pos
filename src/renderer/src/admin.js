window.printBarcodeLabel = (code, name) => {
    const printWindow = window.open('', '_blank', 'width=300,height=200');
    printWindow.document.write(`
        <html>
            <head><title>Print Label</title></head>
            <body style="text-align:center; font-family: sans-serif; padding: 10px;">
                <div style="font-size: 12px; font-weight: bold;">${name}</div>
                <svg id="print-svg"></svg>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <script>
                    JsBarcode("#print-svg", "${code}", {
                        format: "CODE128",
                        width: 1.5,
                        height: 40
                    });
                    setTimeout(() => { window.print(); window.close(); }, 500);
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};