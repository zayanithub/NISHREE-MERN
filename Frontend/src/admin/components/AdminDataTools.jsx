import { useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsv } from '../../utils/exportCsv';
import { downloadXlsx } from '../../utils/exportXlsx';

export default function AdminDataTools({ filename, columns, rows = [], loadRows, disabled = false }) {
  const [exporting, setExporting] = useState(false);
  const printPage = () => {
    const cleanup = () => document.body.classList.remove('admin-printing');
    document.body.classList.add('admin-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    try { window.print(); }
    finally {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    }
  };
  const exportRows = async (format) => {
    setExporting(true);
    try {
      const currentRows = loadRows ? await loadRows() : rows;
      if (format === 'csv') downloadCsv(`${filename}.csv`, columns, currentRows);
      else downloadXlsx(`${filename}.xlsx`, filename, columns, currentRows);
    } catch (error) {
      toast.error(error.response?.data?.message || 'The filtered data could not be exported.');
    } finally { setExporting(false); }
  };

  return <div className="admin-export-actions" aria-label="Export and print">
    <button className="admin-button-secondary" type="button" disabled={disabled || exporting} onClick={() => void exportRows('xlsx')}><FileSpreadsheet size={15} /> {exporting ? 'Preparing…' : 'Excel'}</button>
    <button className="admin-button-secondary" type="button" disabled={disabled || exporting} onClick={() => void exportRows('csv')}><Download size={15} /> {exporting ? 'Preparing…' : 'CSV'}</button>
    <button className="admin-button-secondary" type="button" onClick={printPage}><Printer size={15} /> Print</button>
  </div>;
}
