import * as XLSX from 'xlsx';

export const convertToCSV = <T extends Record<string, any>>(
    data: T[],
    headers?: Record<string, string>
  ) => {
    if (!data || !data.length) return '';
  
    // Get all unique keys from the data
    const allKeys = Object.keys(data[0]);
    
    // Create header row based on provided headers or use the keys directly
    const headerRow = allKeys
      .map(key => (headers && headers[key]) ? headers[key] : key)
      .join(',');
    
    // Create data rows
    const csvRows = data.map(row => {
      return allKeys
        .map(key => {
          const value = row[key];
          // Handle special cases (objects, nulls, etc.)
          if (value === null || value === undefined) return '';
          
          // Format special values based on key name or type
          if (key === 'status') {
            // Format status for better readability in CSV
            if (value === 'online') return '"Online"';
            if (value === 'offline') return '"Offline"';
            if (value === 'break') return '"Pausa"';
            return `"${value}"`;
          }
          
          if (key === 'agreementValue' && typeof value === 'number') {
            // Format currency values nicely for the CSV
            return `"${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value)}"`;
          }
          
          if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
          // Escape quotes and commas in string values
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return value;
        })
        .join(',');
    });
  
    // Combine header and data rows
    return [headerRow, ...csvRows].join('\n');
  };
  
  /**
   * Creates a stylized HTML table that can be opened in Excel with formatting
   * @param data Array of objects to convert to HTML table
   * @param headers Optional custom headers map (key: column name in data, value: display name in CSV)
   * @returns HTML string that can be opened in Excel
   */

  export const exportToXLSX = <T extends Record<string, any>>(
    data: T[],
    fileName: string,
    headers?: Record<string, string>
  ) => {
    if (!data.length) return;
  
    const allKeys = Object.keys(data[0]);
  
    // Renomeia colunas se headers forem passados
    const formattedData = data.map(row => {
      const newRow: Record<string, any> = {};
      allKeys.forEach(key => {
        const columnName = headers?.[key] || key;
        newRow[columnName] = row[key];
      });
      return newRow;
    });
  
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Operadores');
  
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

export const exportMatrixToXLSX = (
  rows: Array<Array<string | number>>,
  fileName: string,
  options?: {
    sheetName?: string;
    columnWidths?: number[];
    merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
    rowHeights?: number[];
    cellStyles?: Array<{
      fromRow: number;
      fromCol: number;
      toRow?: number;
      toCol?: number;
      style: Record<string, any>;
    }>;
    autoFilter?: {
      fromRow: number;
      fromCol: number;
      toRow: number;
      toCol: number;
    };
  }
) => {
  if (!rows.length) return;

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

    if (options?.columnWidths?.length) {
      worksheet["!cols"] = options.columnWidths.map((wch) => ({ wch }));
    }

  if (options?.merges?.length) {
    worksheet["!merges"] = options.merges;
  }

  if (options?.rowHeights?.length) {
    worksheet["!rows"] = options.rowHeights.map((hpt) => ({ hpt }));
  }

  if (options?.cellStyles?.length) {
    options.cellStyles.forEach((styleRange) => {
      const toRow = styleRange.toRow ?? styleRange.fromRow;
      const toCol = styleRange.toCol ?? styleRange.fromCol;

      for (let row = styleRange.fromRow; row <= toRow; row += 1) {
        for (let col = styleRange.fromCol; col <= toCol; col += 1) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellRef]) continue;
          worksheet[cellRef].s = {
            ...(worksheet[cellRef].s || {}),
            ...styleRange.style,
          };
        }
      }
    });
  }

  if (options?.autoFilter) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: options.autoFilter.fromRow, c: options.autoFilter.fromCol },
        e: { r: options.autoFilter.toRow, c: options.autoFilter.toCol },
      }),
    };
  }

  const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      options?.sheetName || "Monitorias"
    );

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };


  export const convertToStylizedHTML = <T extends Record<string, any>>(
    data: T[],
    headers?: Record<string, string>
  ) => {
    if (!data || !data.length) return '';
  
    // Get all unique keys from the data
    const allKeys = Object.keys(data[0]);
    
    // Create the CSS styles for the table
    const styles = `
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        th { background-color: #6E59A5; color: white; font-weight: bold; text-align: left; padding: 8px; }
        td { border: 1px solid #ddd; padding: 8px; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .status-online { color: green; font-weight: bold; }
        .status-offline { color: #888; }
        .status-break { color: orange; }
        .currency { text-align: right; }
        .number { text-align: right; }
        .performance-high { background-color: #d4edda; color: #155724; }
        .performance-medium { background-color: #fff3cd; color: #856404; }
        .performance-low { background-color: #f8d7da; color: #721c24; }
      </style>
    `;
    
    // Create the header row HTML
    const headerHTML = `
      <tr>
        ${allKeys.map(key => {
          const headerName = (headers && headers[key]) ? headers[key] : key;
          return `<th>${headerName}</th>`;
        }).join('')}
      </tr>
    `;
    
    // Create the data rows HTML
    const rowsHTML = data.map(row => {
      const cells = allKeys.map(key => {
        const value = row[key];
        
        // Skip null or undefined values
        if (value === null || value === undefined) return '<td></td>';
        
        // Add special formatting based on column and value
        if (key === 'status') {
          let displayValue;
          let statusClass;
          
          if (value === 'online') {
            displayValue = 'Online';
            statusClass = 'status-online';
          } else if (value === 'offline') {
            displayValue = 'Offline';
            statusClass = 'status-offline';
          } else if (value === 'break') {
            displayValue = 'Pausa';
            statusClass = 'status-break';
          } else {
            displayValue = value;
            statusClass = '';
          }
          
          return `<td class="${statusClass}">${displayValue}</td>`;
        }
        
        if (key === 'agreementValue') {
          const formattedValue = typeof value === 'number' 
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
            : value;
          return `<td class="currency">${formattedValue}</td>`;
        }
        
        if (key === 'agreementCount' || key === 'clientsContacted' || key === 'pendingPayments') {
          return `<td class="number">${value}</td>`;
        }
        
        if (key === 'performanceRating') {
          let performanceClass = '';
          
          if (typeof value === 'number') {
            if (value >= 90) performanceClass = 'performance-high';
            else if (value >= 75) performanceClass = 'performance-medium';
            else performanceClass = 'performance-low';
          }
          
          return `<td class="${performanceClass} number">${value}%</td>`;
        }
        
        return `<td>${value}</td>`;
      });
      
      return `<tr>${cells.join('')}</tr>`;
    }).join('');
    
    // Build the complete HTML table
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Monitoramento de Operadores</title>
        ${styles}
      </head>
      <body>
        <h1>Monitoramento de Operadores</h1>
        <p>Exportado em: ${new Date().toLocaleString('pt-BR')}</p>
        <table>
          <thead>
            ${headerHTML}
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    return html;
  };
  
  /**
   * Triggers a download of a file with the specified content
   * @param content Content to download
   * @param fileName Name of the file to download
   * @param mimeType MIME type of the file
   */
  export const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };
  
