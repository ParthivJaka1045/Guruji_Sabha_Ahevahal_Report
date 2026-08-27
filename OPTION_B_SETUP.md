## Option B Setup (EmailJS + Google Sheet via Apps Script)

This project is configured to avoid Cloud Functions billing by using:
- **EmailJS**: send auto mail (only on first-time report creation)
- **Google Apps Script Web App**: write/update the Google Sheet row (create + update)

### 1) Google Apps Script (Sheet Sync)

1. Open your Google Sheet → **Extensions → Apps Script**
2. Create a new file `Code.gs` and paste code from `apps-script/Code.gs`
3. Update these values inside the script:
   - `SHEET_ID`: your sheet id (from URL)
   - `SHEET_NAME`: the tab name (e.g. `Sheet1`)
   - `SCRIPT_TOKEN`: any random string (shared secret)
4. Deploy: **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (or “Anyone within domain”)
5. Copy the **Web app URL**

### 2) Frontend config

Edit `js/app.js` and set:
- `APPS_SCRIPT_WEBAPP_URL` = your Web App URL
- `APPS_SCRIPT_TOKEN` = same token as `SCRIPT_TOKEN` in Apps Script

### 3) EmailJS config

1. Create EmailJS service + template
2. Edit `js/app.js` and set:
   - `EMAILJS_PUBLIC_KEY`
   - `EMAILJS_SERVICE_ID`
   - `EMAILJS_TEMPLATE_ID`
3. Template params used by the app:
   - `to_email`
   - `report_id`
   - `date`
   - `location`
   - `subject`

### Behavior
- **Sheet**: on create + update, the same row is updated using hidden `Report ID` column.
- **Mail**: only on create (first time).

