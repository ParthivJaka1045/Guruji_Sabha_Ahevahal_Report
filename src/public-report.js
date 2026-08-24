import "../css/style.css";

const firebaseConfig = {
    apiKey: "AIzaSyDB_GvwLwqBJuZxYob0b5Vh-L-nFn4YdIs",
    authDomain: "smvs-report-app.firebaseapp.com",
    projectId: "smvs-report-app",
    storageBucket: "smvs-report-app.firebasestorage.app",
    messagingSenderId: "780579541622",
    appId: "1:780579541622:web:fa9843949311131e13c557"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// Fallback if Firestore rules are not deployed (optional Cloud Function)
const PUBLIC_REPORT_API_URL =
    "https://asia-south1-smvs-report-app.cloudfunctions.net/getPublicReport";

let publicReportData = null;

window.goToLogin = function () {
    window.location.href = "/";
};

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get("id") || params.get("report");

    if (!reportId) {
        openUnavailableModal();
        return;
    }

    setLoader(true);
    try {
        publicReportData = await loadPublicReport(reportId);
        fillCardData(publicReportData);
        bindActions();
    } catch (error) {
        if (error?.code === "not_found") {
            openUnavailableModal("Report is not available. Please contact admin to get report.");
        } else {
            openUnavailableModal("Report is not available. Please contact admin to get report.");
        }
    } finally {
        setLoader(false);
    }
});

async function loadPublicReport(reportId) {
    try {
        const doc = await db.collection("reports").doc(reportId).get();
        if (!doc.exists) {
            const err = new Error("not found");
            err.code = "not_found";
            throw err;
        }
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        const code = error?.code || "";
        if (!code.includes("permission-denied")) throw error;
        return fetchPublicReportFromApi(reportId);
    }
}

async function fetchPublicReportFromApi(reportId) {
    const url = `${PUBLIC_REPORT_API_URL}?reportId=${encodeURIComponent(reportId)}`;
    const res = await fetch(url);
    const body = await res.json().catch(() => null);
    if (res.status === 404 || body?.error === "not_found") {
        const err = new Error("not found");
        err.code = "not_found";
        throw err;
    }
    if (!res.ok || !body?.ok || !body.report) {
        const err = new Error("unavailable");
        err.code = "unavailable";
        throw err;
    }
    return { id: body.id || reportId, ...body.report };
}

function fillCardData(report) {
    document.getElementById("publicDateValue").textContent = formatDateDisplay(report.date);
    document.getElementById("publicLocationValue").textContent = report.location || "-";
    document.getElementById("publicSubjectValue").textContent = report.subject || "-";
    document.getElementById("publicPreviewBtn").disabled = false;
    document.getElementById("publicDownloadBtn").disabled = false;
}

function bindActions() {
    const previewBtn = document.getElementById("publicPreviewBtn");
    const downloadBtn = document.getElementById("publicDownloadBtn");

    previewBtn.addEventListener("click", () => {
        if (!publicReportData) return;
        document.getElementById("previewContent").innerHTML = getCleanPreviewHTML(publicReportData);
        const modal = new bootstrap.Modal(document.getElementById("previewModal"));
        modal.show();
    });

    downloadBtn.addEventListener("click", async () => {
        if (!publicReportData) return;
        setLoader(true);
        try {
            await downloadPdf(publicReportData, buildPdfFileName(publicReportData));
        } finally {
            setLoader(false);
        }
    });
}

function openUnavailableModal(message) {
    const textEl = document.getElementById("reportUnavailableText");
    if (textEl && message) textEl.textContent = message;
    const modal = new bootstrap.Modal(document.getElementById("reportUnavailableModal"));
    modal.show();
}

function setLoader(show) {
    const loader = document.getElementById("loader");
    if (!loader) return;
    loader.classList.toggle("d-none", !show);
}

function buildPdfFileName(report) {
    const d = new Date(report.date);
    const dayStr = String(d.getDate()).padStart(2, "0");
    const monthStr = d.toLocaleString("en-US", { month: "short" });
    const yearStr = d.getFullYear();
    return `${dayStr} ${monthStr}_${yearStr}_${report.occasion || "Occasion"}_${report.location || "Location"}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return "-";
    const parts = String(dateStr).split("-");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
}

async function downloadPdf(data, fileName) {
    const content = getCleanPreviewHTML(data);
    const opt = {
        margin: 0.3,
        filename: `${fileName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
    };
    await html2pdf().set(opt).from(content).save();
}

function getCleanPreviewHTML(data) {
    let catHtml = "";
    if (data.categories) {
        for (const [main, subs] of Object.entries(data.categories)) {
            const subList = Array.isArray(subs) ? subs.join(", ") : "";
            catHtml += `<div style="margin-bottom:2px; font-size:12px;"><b>${main}:</b> ${subList}</div>`;
        }
    }

    const dateParts = String(data.date || "").split("-");
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : (data.date || "");

    return `
    <div style="font-family: 'Hind Vadodara', sans-serif; padding: 0; color: #000000 !important; background-color: #ffffff !important; font-size: 14px; width: 96%; margin: 0 auto; box-sizing: border-box;">
        <style>
            table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
            td, th { border: 1px solid #000; padding: 5px; vertical-align: top; color: #000 !important; }
            .seamless-body {
                border: 2px solid #000;
                border-top: none;
                padding: 10px 15px;
                text-align: justify;
                line-height: 1.5;
                min-height: 50px;
                background-color: #ffffff !important;
                color: #000000 !important;
                box-sizing: border-box;
            }
            .seamless-body * { color: #000000 !important; }
        </style>
        <table>
            <tbody>
                <tr><td colspan="2" style="border: 2px solid #000; padding: 10px; text-align: center;"><h2 style="font-size: 20px; color: #000; margin: 0; text-transform: uppercase;">SMVS SAMARPAN KARYALYA</h2><p style="font-size: 11px; color: #000; margin: 0;">Video Post Production Data Report</p></td></tr>
                <tr><td style="width: 50%;"><b>તારીખ:</b> ${formattedDate}</td><td style="width: 50%;"><b>વાર:</b> ${data.day || ""}</td></tr>
                <tr><td><b>સમય:</b> ${data.startTime || ""} થી ${data.endTime || ""}</td><td><b>ગ્રેડ:</b> ${data.grade || ""}</td></tr>
                <tr><td><b>પ્રસંગ:</b> ${data.occasion || ""}</td><td><b>સ્થળ:</b> ${data.location || ""}</td></tr>
                <tr><td colspan="2"><b>દિવ્યવાણી:</b> ${data.divyavani || ""}</td></tr>
                <tr><td colspan="2"><b>સભાનો વિષય:</b><br/>${data.subject || ""}</td></tr>
                <tr><td colspan="2"><b>કેટેગરી:</b><br/>${catHtml}</td></tr>
                <tr><td colspan="2" style="font-weight: bold; background-color: #f0f0f0 !important; color: #000 !important;">કથાવાર્તા અહેવાલ</td></tr>
            </tbody>
        </table>
        <div class="seamless-body">${data.htmlBody || ""}</div>
    </div>`;
}
