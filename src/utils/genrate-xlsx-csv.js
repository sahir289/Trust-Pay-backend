import XLSX from 'xlsx';

/**
 * Generate XLSX or CSV buffer
 * @param {Array} data 
 * @param {'xlsx' | 'csv'} type 
 * @param {Array} columns - Optional. Format: [{ header: 'Name', key: 'name' }, ...]
 * @returns {Buffer | string}
 */
export const generateFile = (data, type = 'xlsx', columns = null) => {
  if (!data || data.length === 0) {
    data = [{ message: 'No data found' }];
  }

  let worksheet;

  if (columns && Array.isArray(columns) && columns.length > 0) {
    // ---------- Custom columns support ----------
    const headers = columns.map((col) => col.header);
    const keys = columns.map((col) => col.key);

    const orderedData = data.map((row) => {
      const newRow = {};
      keys.forEach((key, index) => {
        newRow[headers[index]] = row[key] ?? '';
      });
      return newRow;
    });

    worksheet = XLSX.utils.json_to_sheet(orderedData, { header: headers });
  } else {
    worksheet = XLSX.utils.json_to_sheet(data);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  if (type === 'csv') {
    // CSV string return karega
    return XLSX.utils.sheet_to_csv(worksheet);
  }

  // XLSX buffer return karega
  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });
};