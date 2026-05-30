import Papa from 'papaparse';

export const parseCsv = (csvString: string, columnMapping: Record<string, string>) => {
  const { data } = Papa.parse(csvString, { header: true, skipEmptyLines: true });
  // Map columns
  return (data as any[]).map(row => {
    const mapped: any = {};
    for (const [csvCol, field] of Object.entries(columnMapping)) {
      mapped[field] = row[csvCol];
    }
    mapped.rawCsvJson = row;
    return mapped;
  });
};
