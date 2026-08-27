# Firebase Auto Sheet + Auto Mail Setup

## 1) Required secrets
Run these commands from project root:

```bash
firebase functions:secrets:set SERVICE_ACCOUNT_JSON
firebase functions:secrets:set SPREADSHEET_ID
firebase functions:secrets:set SHEET_NAME
firebase functions:secrets:set FIXED_RECIPIENT
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set SMTP_SECURE
```

Notes:
- `SERVICE_ACCOUNT_JSON` value should be full JSON string of Google service account.
- Share target Google Sheet with service account email as Editor.
- `SMTP_SECURE` should be `true` (usually port 465) or `false` (usually port 587).

## 2) Deploy function

```bash
firebase deploy --only functions
```

## 3) Verify flow
- Create a new report entry from app.
- Confirm Google Sheet gets new row in columns `Date`, `Subject`, `Category`, `Location`, `Report Narrative` (and `Report ID` used for de-dupe / can be hidden in the sheet).
- Update same report and confirm same row updates (not duplicate row).
- Confirm fixed recipient gets auto mail with PDF attachment only for new report entry.

## Notes (Google Sheet is private)
- Keep the sheet private. Just share it with the service account email (Editor access).
- Example service account email: `firebase-sheet-access@smvs-report-app.iam.gserviceaccount.com`

## Fixed recipient fallback
- If `FIXED_RECIPIENT` secret is not set, the function will default to `Jakasaniyaparthiv@gmail.com`.
