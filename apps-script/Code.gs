/**
 * SMVS Report Portal - Sheet Sync (Apps Script Web App)
 *
 * Deploy as Web App:
 * - Execute as: Me
 * - Who has access: Anyone (or Anyone within domain)
 *
 * Security note:
 * - Add a simple shared secret token (SCRIPT_TOKEN) and validate it.
 */

const SHEET_ID = '15TeQCxMguBtsyI3LZktafe0hm-KFvPptGy-Wri6-LDE';
const SHEET_NAME = 'Sheet1';
const SCRIPT_TOKEN = 'Smvs@2026#SheetSync!';

// Columns: Date, Subject, Category, Location, Report Narrative, Report ID (hidden ok)
const HEADERS = ['Date', 'Subject', 'Category', 'Location', 'Report Narrative', 'Report ID'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');

    if (!body || body.token !== SCRIPT_TOKEN) {
      return json_({ ok: false, error: 'Unauthorized' }, 401);
    }

    const reportId = String(body.reportId || '').trim();
    if (!reportId) return json_({ ok: false, error: 'Missing reportId' }, 400);

    // Category and Report Narrative support
    const categoryText = String(body.category || body.categories || '').trim();
    const narrativeText = String(body.reportNarrative || body.body || '').trim();

    const row = [
      String(body.date || ''),
      String(body.subject || ''),
      categoryText,
      String(body.location || ''),
      narrativeText,
      reportId,
    ];

    const sheet = openSheet_();
    ensureHeaders_(sheet);
    upsertByReportId_(sheet, reportId, row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function openSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const matches = HEADERS.every((h, i) => String(firstRow[i] || '') === h);
  if (!matches) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function upsertByReportId_(sheet, reportId, rowValues) {
  const lastRow = sheet.getLastRow();
  const idCol = HEADERS.length; // last col

  if (lastRow < 2) {
    sheet.appendRow(rowValues);
    return;
  }

  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat().map(String);
  const idx = ids.findIndex((v) => v === reportId);

  if (idx === -1) {
    sheet.appendRow(rowValues);
    return;
  }

  const targetRow = idx + 2;
  sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([rowValues]);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
