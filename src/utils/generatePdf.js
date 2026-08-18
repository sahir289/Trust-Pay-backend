import PDFDocument from 'pdfkit';

/**
 * Common function to generate PDF in Table format
 */
export function generatePDFBuffer(data = [], options = {}) {
  const {
    title = 'Report',
    columns = [],
  } = options;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'landscape',
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    const rowHeight = 18;
    const headerHeight = 22;
    let currentY = doc.page.margins.top;

    // ---------- Helpers ----------
    const formatCurrency = (value) => {
      if (value === null || value === undefined || value === '') return '-';
      const num = Number(value);
      if (isNaN(num)) return value;
      return 'Rs. ' + num.toLocaleString('en-IN');
    };

    const formatDate = (value) => {
      if (!value) return '-';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);

        return date.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      } catch (err) {
        console.error('Error formatting date:', err);
        return String(value);
      }
    };

    // ---------- Draw Header ----------
    const drawHeader = () => {
      let x = startX;

      // Background
      doc.rect(startX, currentY, pageWidth, headerHeight).fill('#1f2937');

      columns.forEach((col) => {
        doc
          .fillColor('#ffffff')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(col.header, x + 3, currentY + 6, {
            width: col.width - 6,
            align: col.align || 'left',
            lineBreak: false,
          });
        x += col.width;
      });

      currentY += headerHeight;
    };

    // ---------- Draw Single Row ----------
    const drawRow = (row, isEven) => {
      let x = startX;

      // Alternate background
      if (isEven) {
        doc.rect(startX, currentY, pageWidth, rowHeight).fill('#f3f4f6');
      }

      columns.forEach((col) => {
        let value = row[col.key];

        // Nested key support
        if (col.key && col.key.includes('.')) {
          value = col.key.split('.').reduce((obj, k) => obj?.[k], row);
        }

        // Format value
        if (col.format === 'currency') {
          value = formatCurrency(value);
        } else if (col.format === 'date') {
          value = formatDate(value);
        } else if (value === null || value === undefined) {
          value = '-';
        } else {
          value = String(value);
        }

        doc
          .fillColor('#111827')
          .fontSize(7)
          .font('Helvetica')
          .text(value, x + 3, currentY + 5, {
            width: col.width - 6,
            align: col.align || 'left',
            lineBreak: false,        // Important - wrapping band karo
            ellipsis: true,
          });

        x += col.width;
      });

      currentY += rowHeight;
    };

    // ---------- Check if we need new page ----------
    const checkPageBreak = () => {
      // Agar next row + thoda space nahi bachta
      if (currentY + rowHeight > doc.page.height - 40) {
        doc.addPage();
        currentY = doc.page.margins.top;
        drawHeader(); // har naye page pe header
      }
    };

    // ====================== START DRAWING ======================

    // Title
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(title, { align: 'center' });

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text(`Generated on: ${formatDate(new Date())}`, { align: 'center' });

    doc.moveDown(0.8);
    currentY = doc.y;

    // First header
    drawHeader();

    // Rows
    data.forEach((row, index) => {
      checkPageBreak();          // page break check pehle
      drawRow(row, index % 2 === 0);
    });

    // Total records
    currentY += 10;
    doc
      .fontSize(9)
      .fillColor('#374151')
      .text(`Total Records: ${data.length}`, startX, currentY);

    doc.end();
  });
}