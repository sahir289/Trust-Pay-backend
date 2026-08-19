import PDFDocument from 'pdfkit';

/**
 * Common function to generate PDF in Table format
 * Auto: A4 landscape → agar columns bahut zyada hon to A3 landscape
 */
export function generatePDFBuffer(data = [], options = {}) {
  const {
    title = 'Report',
    columns = [],
  } = options;

  return new Promise((resolve, reject) => {
    // ---------- Decide page size ----------
    // A4 landscape usable width ~ 782pt (with margin 30)
    // A3 landscape usable width ~ 1132pt
    const totalDefinedWidth = columns.reduce(
      (sum, col) => sum + (col.width || 80),
      0,
    );

    // Agar columns ka total width A4 se zyada hai → A3 landscape
    const useA3 = totalDefinedWidth > 900 || columns.length > 12;

    const doc = new PDFDocument({
      margin: 20, // thoda kam margin = zyada space
      size: useA3 ? 'A3' : 'A4',
      layout: 'landscape', // hamesha landscape
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    const rowHeight = 16;
    const headerHeight = 20;
    let currentY = doc.page.margins.top;

    // ---------- Scale columns to fit page exactly ----------
    const scaledColumns = columns.map((col) => {
      const originalWidth = col.width || 80;
      const scaledWidth =
        totalDefinedWidth > 0
          ? (originalWidth / totalDefinedWidth) * pageWidth
          : pageWidth / Math.max(columns.length, 1);

      return {
        ...col,
        width: Math.floor(scaledWidth),
      };
    });

    // Rounding leftover → last column
    const scaledTotal = scaledColumns.reduce((s, c) => s + c.width, 0);
    if (scaledColumns.length > 0 && scaledTotal !== pageWidth) {
      scaledColumns[scaledColumns.length - 1].width += pageWidth - scaledTotal;
    }

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

    const drawHeader = () => {
      let x = startX;

      doc.rect(startX, currentY, pageWidth, headerHeight).fill('#1f2937');

      scaledColumns.forEach((col) => {
        doc
          .fillColor('#ffffff')
          .fontSize(useA3 ? 8 : 7)
          .font('Helvetica-Bold')
          .text(col.header, x + 2, currentY + 5, {
            width: col.width - 4,
            align: col.align || 'left',
            lineBreak: false,
            ellipsis: true,
          });
        x += col.width;
      });

      currentY += headerHeight;
    };

    const drawRow = (row, isEven) => {
      let x = startX;

      if (isEven) {
        doc.rect(startX, currentY, pageWidth, rowHeight).fill('#f3f4f6');
      }

      scaledColumns.forEach((col) => {
        let value = row[col.key];

        if (col.key && col.key.includes('.')) {
          value = col.key.split('.').reduce((obj, k) => obj?.[k], row);
        }

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
          .fontSize(useA3 ? 7 : 6.5)
          .font('Helvetica')
          .text(value, x + 2, currentY + 4, {
            width: col.width - 4,
            align: col.align || 'left',
            lineBreak: false,
            ellipsis: true,
          });

        x += col.width;
      });

      currentY += rowHeight;
    };

    const checkPageBreak = () => {
      if (currentY + rowHeight > doc.page.height - 30) {
        doc.addPage();
        currentY = doc.page.margins.top;
        drawHeader();
      }
    };

    // ====================== DRAW ======================

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(title, { align: 'center' });

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text(
        `Generated on: ${formatDate(new Date())}${useA3 ? '  |  Page: A3 Landscape' : '  |  Page: A4 Landscape'}`,
        { align: 'center' },
      );

    doc.moveDown(0.6);
    currentY = doc.y;

    drawHeader();

    data.forEach((row, index) => {
      checkPageBreak();
      drawRow(row, index % 2 === 0);
    });

    currentY += 10;
    doc
      .fontSize(9)
      .fillColor('#374151')
      .text(`Total Records: ${data.length}`, startX, currentY);

    doc.end();
  });
}