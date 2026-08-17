import XLSX from 'xlsx';

/**
 * Generate XLSX or CSV buffer
 * @param {Array} data 
 * @param {'xlsx' | 'csv'} type 
 * @returns {Buffer | string}
 */
export const generateFile = (data, type = 'xlsx') => {
  if (!data || data.length === 0) {
    data = [{ message: 'No data found' }];
  }

  // JSON se Sheet banao
  const worksheet = XLSX.utils.json_to_sheet(data);
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