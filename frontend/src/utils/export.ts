export const exportToCSV = (data: any[], headers: { label: string; key: string }[], filename: string) => {
  const headerLabels = headers.map(h => h.label).join(',');
  const rows = data.map(item => {
    return headers.map(h => {
      const value = h.key.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : '', item);
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      return `"${stringValue.replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headerLabels, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};