const crypto = require("crypto");
const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

admin.initializeApp();

const SERVICE_ACCOUNT_JSON = defineSecret("SERVICE_ACCOUNT_JSON");
const SPREADSHEET_ID = defineSecret("SPREADSHEET_ID");
const SHEET_NAME = defineSecret("SHEET_NAME");
const FIXED_RECIPIENT = defineSecret("FIXED_RECIPIENT");
const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const SMTP_SECURE = defineSecret("SMTP_SECURE");
// Sheet columns (keep Report ID as hidden column for upsert/de-dupe)
const SHEET_HEADERS = ["Date", "Subject", "Category", "Location", "Report Narrative", "Report ID"];
const DEFAULT_FIXED_RECIPIENT = "Jakasaniyaparthiv@gmail.com";

/** Public report link: read one report by ID without portal login. */
exports.getPublicReport = onRequest(
  { region: "asia-south1", cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const reportId = String(req.query.reportId || req.query.report || "").trim();
    if (!reportId) {
      res.status(400).json({ ok: false, error: "missing_report_id" });
      return;
    }

    try {
      const snap = await admin.firestore().collection("reports").doc(reportId).get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.status(200).json({ ok: true, id: snap.id, report: snap.data() });
    } catch (err) {
      logger.error("getPublicReport failed", { reportId, err });
      res.status(500).json({ ok: false, error: "server_error" });
    }
  }
);

exports.syncReportToSheetAndMail = onDocumentWritten(
  {
    document: "reports/{reportId}",
    region: "asia-south1",
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [
      SERVICE_ACCOUNT_JSON,
      SPREADSHEET_ID,
      SHEET_NAME,
      FIXED_RECIPIENT,
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_SECURE,
    ],
  },
  async (event) => {
    const reportId = event.params.reportId;
    const beforeSnap = event.data.before;
    const afterSnap = event.data.after;

    if (!afterSnap.exists) {
      logger.info("Skipping delete event", { reportId });
      return;
    }

    const isCreate = !beforeSnap.exists;
    const report = afterSnap.data();
    const reportHash = createReportHash(report);

    const dedupeRef = admin.firestore().collection("_automation_mail_log").doc(reportId);
    const dedupeSnap = await dedupeRef.get();
    const lastHash = dedupeSnap.exists ? dedupeSnap.data().lastHash : null;
    if (lastHash === reportHash) {
      logger.info("Skipping duplicate event based on hash", { reportId });
      return;
    }

    const sheetConfig = {
      spreadsheetId: SPREADSHEET_ID.value(),
      sheetName: SHEET_NAME.value(),
      serviceAccountJson: SERVICE_ACCOUNT_JSON.value(),
    };

    const rowData = mapReportToSheetRow(reportId, report);
    await upsertSheetRow(sheetConfig, rowData);

    if (isCreate) {
      const pdfHtml = buildReportHtml(report);
      const pdfBuffer = await renderPdfBuffer(pdfHtml);

      await sendEmailWithAttachment({
        recipient: FIXED_RECIPIENT.value() || DEFAULT_FIXED_RECIPIENT,
        smtpHost: SMTP_HOST.value(),
        smtpPort: SMTP_PORT.value(),
        smtpUser: SMTP_USER.value(),
        smtpPass: SMTP_PASS.value(),
        smtpSecure: SMTP_SECURE.value(),
        reportId,
        report,
        pdfBuffer,
      });
    } else {
      logger.info("Mail skipped for report update", { reportId });
    }

    await dedupeRef.set(
      {
        lastHash: reportHash,
        lastProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("Report sync completed", { reportId, mailSent: isCreate });
  }
);

function createReportHash(report) {
  const source = JSON.stringify({
    date: report.date || "",
    location: report.location || "",
    categories: report.categories || {},
    htmlBody: report.htmlBody || "",
    occasion: report.occasion || "",
    subject: report.subject || "",
  });
  return crypto.createHash("sha256").update(source).digest("hex");
}

function mapReportToSheetRow(reportId, report) {
  return [
    report.date || "",
    report.subject || "",
    flattenCategories(report.categories),
    report.location || "",
    htmlToPlainText(report.htmlBody),
    reportId,
  ];
}

function flattenCategories(categories) {
  if (!categories || typeof categories !== "object") return "";
  return Object.entries(categories)
    .map(([main, subs]) => {
      const subText = Array.isArray(subs) ? subs.join(", ") : "";
      return `${main}: ${subText}`.trim();
    })
    .join(" | ");
}

function htmlToPlainText(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function upsertSheetRow(config, rowValues) {
  const sheets = await getSheetsClient(config.serviceAccountJson);
  const range = `${config.sheetName}!A:F`;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });

  const values = existing.data.values || [];
  if (values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${config.sheetName}!A1:F1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [SHEET_HEADERS],
      },
    });
  }

  const dataRows = values.slice(1);
  const targetReportId = rowValues[5];
  const existingIndex = dataRows.findIndex((r) => (r[5] || "") === targetReportId);

  if (existingIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${config.sheetName}!A:F`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
    return;
  }

  const rowNumber = existingIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A${rowNumber}:F${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [rowValues] },
  });
}

async function getSheetsClient(serviceAccountJson) {
  // Lazy-load to avoid deploy analysis timeouts
  const { google } = require("googleapis");
  const creds = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr || !dateStr.includes("-")) return dateStr || "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function buildReportHtml(data) {
  let catHtml = "";
  if (data.categories) {
    for (const [main, subs] of Object.entries(data.categories)) {
      const subList = Array.isArray(subs) ? subs.join(", ") : "";
      catHtml += `<div style="margin-bottom:2px; font-size:12px;"><b>${escapeHtml(main)}:</b> ${escapeHtml(subList)}</div>`;
    }
  }

  const formattedDate = formatDateToDDMMYYYY(data.date || "");

  return `
  <div style="font-family: 'Hind Vadodara', Arial, sans-serif; padding: 0; color: #000000; background-color: #ffffff; font-size: 14px; width: 96%; margin: 0 auto; box-sizing: border-box;">
      <style>
          table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
          td, th { border: 1px solid #000; padding: 5px; vertical-align: top; color: #000; }
          .seamless-body {
              border: 2px solid #000;
              border-top: none;
              padding: 10px 15px;
              text-align: justify;
              line-height: 1.5;
              min-height: 50px;
              background-color: #ffffff;
              color: #000000;
              box-sizing: border-box;
          }
      </style>
      <table>
          <tbody>
              <tr><td colspan="2" style="border: 2px solid #000; padding: 10px; text-align: center;"><h2 style="font-size: 20px; color: #000; margin: 0; text-transform: uppercase;">SMVS SAMARPAN KARYALYA</h2><p style="font-size: 11px; color: #000; margin: 0;">Video Post Production Data Report</p></td></tr>
              <tr><td style="width: 50%;"><b>તારીખ:</b> ${escapeHtml(formattedDate)}</td><td style="width: 50%;"><b>વાર:</b> ${escapeHtml(data.day || "")}</td></tr>
              <tr><td><b>સમય:</b> ${escapeHtml(data.startTime || "")} થી ${escapeHtml(data.endTime || "")}</td><td><b>ગ્રેડ:</b> ${escapeHtml(data.grade || "")}</td></tr>
              <tr><td><b>પ્રસંગ:</b> ${escapeHtml(data.occasion || "")}</td><td><b>સ્થળ:</b> ${escapeHtml(data.location || "")}</td></tr>
              <tr><td colspan="2"><b>દિવ્યવાણી:</b> ${escapeHtml(data.divyavani || "")}</td></tr>
              <tr><td colspan="2"><b>સભાનો વિષય:</b><br/>${escapeHtml(data.subject || "")}</td></tr>
              <tr><td colspan="2"><b>કેટેગરી:</b><br/>${catHtml}</td></tr>
              <tr><td colspan="2" style="font-weight: bold; background-color: #f0f0f0;">કથાવાર્તા અહેવાલ</td></tr>
          </tbody>
      </table>
      <div class="seamless-body">${data.htmlBody || ""}</div>
  </div>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function renderPdfBuffer(htmlContent) {
  const puppeteer = require("puppeteer-core");
  const chromium = require("@sparticuz/chromium");

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });
  } finally {
    await browser.close();
  }
}

async function sendEmailWithAttachment(params) {
  // Lazy-load to avoid deploy analysis timeouts
  const nodemailer = require("nodemailer");
  const smtpSecure = String(params.smtpSecure || "false").toLowerCase() === "true";
  const transporter = nodemailer.createTransport({
    host: params.smtpHost,
    port: Number(params.smtpPort || 587),
    secure: smtpSecure,
    auth: {
      user: params.smtpUser,
      pass: params.smtpPass,
    },
  });

  const subject = `SMVS Report Auto Mail - ${params.report.date || ""} - ${params.report.location || ""}`;
  const mailHtml = `
    <p>Auto generated report attached.</p>
    <p><b>Report ID:</b> ${escapeHtml(params.reportId)}</p>
    <p><b>Date:</b> ${escapeHtml(params.report.date || "")}</p>
    <p><b>Location:</b> ${escapeHtml(params.report.location || "")}</p>
  `;

  await transporter.sendMail({
    from: params.smtpUser,
    to: params.recipient,
    subject,
    html: mailHtml,
    attachments: [
      {
        filename: buildFileName(params.report) + ".pdf",
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

function buildFileName(report) {
  const date = report.date ? new Date(report.date) : new Date();
  const dayStr = String(date.getDate()).padStart(2, "0");
  const monthStr = date.toLocaleString("en-US", { month: "short" });
  const yearStr = date.getFullYear();
  const occasion = (report.occasion || "Occasion").replace(/[\\/:*?"<>|]/g, "_");
  const location = (report.location || "Location").replace(/[\\/:*?"<>|]/g, "_");
  return `${dayStr} ${monthStr}_${yearStr}_${occasion}_${location}`;
}
