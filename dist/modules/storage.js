const RECORDS_KEY = 'aquacheck.records.v2';

export function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
