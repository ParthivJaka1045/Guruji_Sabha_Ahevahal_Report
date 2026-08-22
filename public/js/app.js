// ============================================
// SMVS Report Portal — Complete Client Application
// 100% Exact Original UI & Theme + Full SQLite Architecture
// ============================================

let currentUser = null;
let quill = null;
let currentReportId = null;
let allReports = [];
let locationTree = [];
let categoriesData = {};
let previewModal = null;
let currentAdminTab = "locations";

// --- 1. INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    previewModal = new bootstrap.Modal(document.getElementById("previewModal"));
    initQuill();
    await checkAuth();
});

function initQuill() {
    quill = new Quill("#editor-container", {
        theme: "snow",
        placeholder: "Report content here (અહીં લખો)...",
        modules: {
            toolbar: [
                ["bold", "italic", "underline"],
                [{ list: "ordered" }, { list: "bullet" }],
                [{ align: [] }],
                ["clean"]
            ]
        }
    });

    quill.on("text-change", () => {
        scheduleDraftSave();
    });
}

// Helper for all authenticated API calls (cookie + localStorage bearer)
window.authFetch = function(url, options = {}) {
    options.headers = options.headers || {};
    const token = localStorage.getItem("smvs_auth_token");
    if (token) {
        if (options.headers instanceof Headers) {
            options.headers.set("Authorization", "Bearer " + token);
        } else {
            options.headers["Authorization"] = "Bearer " + token;
        }
    }
    return fetch(url, options);
};

// --- 2. AUTHENTICATION ---
async function checkAuth() {
    showLoader("AUTHENTICATING...");
    try {
        const res = await authFetch("/api/auth/me");
        const data = await res.json();
        if (data.ok && data.user) {
            currentUser = data.user;
            await onLoginSuccess();
        } else {
            showLoginView();
        }
    } catch (e) {
        showLoginView();
    } finally {
        hideLoader();
    }
}

window.handleLogin = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const loginBtn = document.getElementById("loginBtn");
    const errorDiv = document.getElementById("loginError");
    const emailOrUsername = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    errorDiv.classList.add("d-none");
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailOrUsername, password })
        });
        const data = await res.json();

        if (data.ok && data.user) {
            if (data.token) {
                localStorage.setItem("smvs_auth_token", data.token);
            }
            currentUser = data.user;
            await onLoginSuccess();
        } else {
            errorDiv.textContent = data.error || "Invalid Credentials!";
            errorDiv.classList.remove("d-none");
        }
    } catch (err) {
        errorDiv.textContent = "Server connection error.";
        errorDiv.classList.remove("d-none");
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-2"></i>Login Access';
    }
    return false;
};

async function logoutUser() {
    if (!confirm("Logout?")) return;
    try {
        await authFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("smvs_auth_token");
    currentUser = null;
    showLoginView();
}

function showLoginView() {
    document.getElementById("mainApp").classList.add("d-none");
    document.getElementById("loginView").classList.remove("d-none");
}

function updateDashboardUI() {
    const repCount = (allReports || []).length;
    const statReps = document.getElementById("dashStatReports");
    const statCenters = document.getElementById("dashStatCenters");
    const statCats = document.getElementById("dashStatCategories");
    const histCount = document.getElementById("historyCount");

    let totalCenters = 0;
    (locationTree || []).forEach(c => {
        (c.zones || []).forEach(z => {
            totalCenters += (z.centers || []).length;
        });
    });

    const totalCats = Object.keys(categoriesData || {}).length;

    if (statReps) statReps.textContent = repCount;
    if (histCount) histCount.textContent = repCount;
    if (statCenters) statCenters.textContent = totalCenters || 52;
    if (statCats) statCats.textContent = totalCats || 6;

    const adminCard = document.getElementById("dashboardAdminCard");
    const newRepCard = document.getElementById("dashCardNewReport");
    const histCard = document.getElementById("dashCardHistory");

    if (currentUser?.role === "admin") {
        if (adminCard) adminCard.classList.remove("d-none");
        if (newRepCard) newRepCard.className = "col-12 col-md-6 col-lg-4";
        if (histCard) histCard.className = "col-12 col-md-6 col-lg-4";
    } else {
        if (adminCard) adminCard.classList.add("d-none");
        if (newRepCard) newRepCard.className = "col-12 col-md-6";
        if (histCard) histCard.className = "col-12 col-md-6";
    }
}

async function onLoginSuccess() {
    document.getElementById("loginView").classList.add("d-none");
    document.getElementById("mainApp").classList.remove("d-none");

    const badge = document.getElementById("userBadge");
    if (badge) {
        badge.textContent = `@${currentUser.username} (${currentUser.role})`;
    }

    const adminNavBtn = document.getElementById("adminNavBtn");
    if (currentUser.role === "admin") {
        if (adminNavBtn) adminNavBtn.classList.remove("d-none");
    } else {
        if (adminNavBtn) adminNavBtn.classList.add("d-none");
    }

    await loadInitialData();
    showDashboard();

    // Auto-resume draft if any exists on startup
    setTimeout(() => {
        const hasDraft = loadDraftIfAny();
        if (hasDraft) {
            document.getElementById("dashboardView").classList.add("d-none");
            document.getElementById("formView").classList.remove("d-none");
            toggleButtons("create");
            currentReportId = null;

            const toast = document.createElement("div");
            toast.className = "position-fixed bottom-0 end-0 p-3";
            toast.style.zIndex = "1055";
            toast.innerHTML = `
                <div class="toast show align-items-center text-white bg-warning border-0" role="alert" aria-live="assertive" aria-atomic="true">
                  <div class="d-flex text-dark fw-bold" style="background: var(--bg-card-solid); border: 1px solid var(--primary); border-radius: var(--radius); padding: 8px 14px;">
                    <div class="toast-body" style="color: var(--text-main) !important;">
                      <i class="fa-solid fa-clock-rotate-left me-2" style="color: var(--primary);"></i> Unsaved draft auto-restored! (અધૂરો અહેવાલ મેળવી લીધો છે!)
                    </div>
                    <button type="button" class="btn-close btn-close-white ms-auto m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                  </div>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.classList.remove("show");
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        }
    }, 300);
}

// --- 3. DATA LOADING ---
async function loadInitialData() {
    await Promise.all([loadLocationsTree(), loadCategories(), fetchReports()]);
}

async function loadLocationsTree() {
    try {
        const res = await fetch("/api/locations/tree");
        const data = await res.json();
        if (data.ok) {
            locationTree = data.tree;
            populateCountryDropdowns();
        }
    } catch (e) {
        console.error("Failed to load locations:", e);
    }
}

async function loadCategories() {
    try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        if (data.ok) {
            categoriesData = data.categories;
            renderCategories();
        }
    } catch (e) {
        console.error("Failed to load categories:", e);
    }
}

async function fetchReports() {
    try {
        const res = await authFetch("/api/reports");
        const data = await res.json();
        if (data.ok) {
            allReports = data.reports;
            const countEl = document.getElementById("historyCount");
            if (countEl) countEl.textContent = `${allReports.length}`;
        }
    } catch (e) {
        console.error("Failed to fetch reports:", e);
    }
}

// --- 4. 3-TIER CASCADING SELECTORS ---
function populateCountryDropdowns() {
    const cSelect = document.getElementById("countrySelect");
    const fCountry = document.getElementById("filterCountry");

    if (cSelect) {
        cSelect.innerHTML = '<option value="" disabled selected>Select Country</option>';
        locationTree.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `${c.name} ${c.code ? '(' + c.code + ')' : ''}`;
            cSelect.appendChild(opt);
        });

        // Default to India if available
        const india = locationTree.find(c => c.name.toLowerCase() === "india");
        if (india) {
            cSelect.value = india.id;
            handleCountryChange();
        }
    }

    if (fCountry) {
        fCountry.innerHTML = '<option value="">All Countries</option>';
        locationTree.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            fCountry.appendChild(opt);
        });
    }
}

function handleCountryChange() {
    const cSelect = document.getElementById("countrySelect");
    const zSelect = document.getElementById("zoneSelect");
    const cntSelect = document.getElementById("centerSelect");

    const countryId = parseInt(cSelect.value);
    const country = locationTree.find(c => c.id === countryId);

    zSelect.innerHTML = '<option value="" disabled selected>Select Zone</option>';
    cntSelect.innerHTML = '<option value="" disabled selected>Select Center</option>';
    cntSelect.disabled = true;

    if (country && country.zones && country.zones.length > 0) {
        zSelect.disabled = false;
        country.zones.forEach(z => {
            const opt = document.createElement("option");
            opt.value = z.id;
            opt.textContent = z.name;
            zSelect.appendChild(opt);
        });
    } else {
        zSelect.disabled = true;
    }
    scheduleDraftSave();
}

function handleZoneChange() {
    const cSelect = document.getElementById("countrySelect");
    const zSelect = document.getElementById("zoneSelect");
    const cntSelect = document.getElementById("centerSelect");

    const countryId = parseInt(cSelect.value);
    const zoneId = parseInt(zSelect.value);

    const country = locationTree.find(c => c.id === countryId);
    const zone = country?.zones.find(z => z.id === zoneId);

    cntSelect.innerHTML = '<option value="" disabled selected>Select Center</option>';

    if (zone && zone.centers && zone.centers.length > 0) {
        cntSelect.disabled = false;
        zone.centers.forEach(cnt => {
            const opt = document.createElement("option");
            opt.value = cnt.id;
            opt.textContent = cnt.name;
            cntSelect.appendChild(opt);
        });
    } else {
        cntSelect.disabled = true;
    }
    scheduleDraftSave();
}

function handleCenterChange() {
    const cntSelect = document.getElementById("centerSelect");
    const locInput = document.getElementById("location");
    const selectedText = cntSelect.options[cntSelect.selectedIndex]?.textContent;

    if (selectedText && selectedText !== "Select Center") {
        locInput.value = selectedText;
    }
    scheduleDraftSave();
}

// Filter Dropdowns
function handleFilterCountryChange() {
    const fCountry = document.getElementById("filterCountry");
    const fZone = document.getElementById("filterZone");
    const fCenter = document.getElementById("filterCenter");

    const countryId = parseInt(fCountry.value);
    const country = locationTree.find(c => c.id === countryId);

    fZone.innerHTML = '<option value="">All Zones</option>';
    fCenter.innerHTML = '<option value="">All Centers</option>';
    fCenter.disabled = true;

    if (country && country.zones && country.zones.length > 0) {
        fZone.disabled = false;
        country.zones.forEach(z => {
            const opt = document.createElement("option");
            opt.value = z.id;
            opt.textContent = z.name;
            fZone.appendChild(opt);
        });
    } else {
        fZone.disabled = true;
    }
    filterReports();
}

function handleFilterZoneChange() {
    const fCountry = document.getElementById("filterCountry");
    const fZone = document.getElementById("filterZone");
    const fCenter = document.getElementById("filterCenter");

    const countryId = parseInt(fCountry.value);
    const zoneId = parseInt(fZone.value);

    const country = locationTree.find(c => c.id === countryId);
    const zone = country?.zones.find(z => z.id === zoneId);

    fCenter.innerHTML = '<option value="">All Centers</option>';

    if (zone && zone.centers && zone.centers.length > 0) {
        fCenter.disabled = false;
        zone.centers.forEach(cnt => {
            const opt = document.createElement("option");
            opt.value = cnt.id;
            opt.textContent = cnt.name;
            fCenter.appendChild(opt);
        });
    } else {
        fCenter.disabled = true;
    }
    filterReports();
}

// --- 5. EXACT ORIGINAL CATEGORIES RENDERER ---
function renderCategories() {
    const container = document.getElementById("categoryContainer");
    if (!container) return;
    let html = "";
    for (const [main, subs] of Object.entries(categoriesData)) {
        const safeId = main.replace(/\s+/g, "_");
        html += `
        <div class="mb-2 p-2 rounded border" style="background-color: var(--bg-body);">
            <div class="d-flex align-items-center">
                <input class="form-check-input me-2" type="checkbox" id="main_${safeId}" value="${main}" onchange="toggleSub('${safeId}')">
                <label class="fw-bold mb-0" style="color: var(--primary); cursor:pointer;" for="main_${safeId}">${main}</label>
            </div>
            <div id="subs_${safeId}" class="d-none ms-3 mt-1 d-flex flex-wrap">
                ${subs.map((sub, index) => `
                    <div class="me-2 mb-1">
                        <input type="checkbox" class="sub-cat-${safeId}" value="${sub}" id="sub_${safeId}_${index}" onchange="scheduleDraftSave()">
                        <label class="ms-1 small text-muted" for="sub_${safeId}_${index}">${sub}</label>
                    </div>
                `).join("")}
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

window.toggleSub = function(safeId) {
    const mainCheck = document.getElementById(`main_${safeId}`);
    const subDiv = document.getElementById(`subs_${safeId}`);
    if (mainCheck.checked) {
        subDiv.classList.remove("d-none");
    } else {
        subDiv.classList.add("d-none");
        document.querySelectorAll(`.sub-cat-${safeId}`).forEach(el => el.checked = false);
    }
    scheduleDraftSave();
};

function getSelectedCategories() {
    const selected = {};
    for (const main of Object.keys(categoriesData)) {
        const safeId = main.replace(/\s+/g, "_");
        const mainCheck = document.getElementById(`main_${safeId}`);
        if (mainCheck && mainCheck.checked) {
            const subs = [];
            document.querySelectorAll(`.sub-cat-${safeId}:checked`).forEach(chk => subs.push(chk.value));
            selected[main] = subs;
        }
    }
    return selected;
}

// --- 6. DATE & FORM AUTO-FILL ---
function updateDay() {
    const dateInput = document.getElementById("date");
    const dayInput = document.getElementById("day");
    if (!dateInput.value) return;

    const days = [
        "Sunday (રવિવાર)",
        "Monday (સોમવાર)",
        "Tuesday (મંગળવાર)",
        "Wednesday (બુધવાર)",
        "Thursday (ગુરુવાર)",
        "Friday (શુક્રવાર)",
        "Saturday (શનિવાર)"
    ];
    const d = new Date(dateInput.value);
    if (!isNaN(d)) dayInput.value = days[d.getDay()];
    scheduleDraftSave();
}

function initForm() {
    const today = new Date();
    document.getElementById("date").valueAsDate = today;
    updateDay();

    const now = new Date();
    document.getElementById("startTime").value = now.toTimeString().substring(0, 5);
    now.setMinutes(now.getMinutes() + 90);
    document.getElementById("endTime").value = now.toTimeString().substring(0, 5);

    toggleButtons("create");
}

// --- 7. DRAFT SAVE & RESTORE ---
let draftTimer = null;
function scheduleDraftSave() {
    if (!currentUser || currentReportId) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
        try {
            const data = getFormData();
            localStorage.setItem(`smvs_report_draft:${currentUser.id}`, JSON.stringify({
                savedAt: new Date().toISOString(),
                data
            }));
        } catch (e) {}
    }, 800);
}

function clearDraft() {
    if (!currentUser) return;
    localStorage.removeItem(`smvs_report_draft:${currentUser.id}`);
}

function loadDraftIfAny() {
    if (!currentUser || currentReportId) return false;
    const raw = localStorage.getItem(`smvs_report_draft:${currentUser.id}`);
    if (!raw) return false;
    try {
        const payload = JSON.parse(raw);
        if (payload?.data) {
            applyDataToForm(payload.data);
            return true;
        }
    } catch (e) {}
    return false;
}

function getFormData() {
    const cSelect = document.getElementById("countrySelect");
    const zSelect = document.getElementById("zoneSelect");
    const cntSelect = document.getElementById("centerSelect");

    const countryId = parseInt(cSelect.value) || null;
    const countryName = cSelect.options[cSelect.selectedIndex]?.textContent || "";
    const zoneId = parseInt(zSelect.value) || null;
    const zoneName = zSelect.options[zSelect.selectedIndex]?.textContent || "";
    const centerId = parseInt(cntSelect.value) || null;
    const centerName = cntSelect.options[cntSelect.selectedIndex]?.textContent || "";

    return {
        date: document.getElementById("date").value,
        day: document.getElementById("day").value,
        startTime: document.getElementById("startTime").value,
        endTime: document.getElementById("endTime").value,
        grade: document.querySelector('input[name="grade"]:checked')?.value || "A",
        occasion: document.getElementById("occasion").value.trim(),
        countryId,
        countryName,
        zoneId,
        zone: zoneName !== "Select Zone" ? zoneName : "",
        centerId,
        center: centerName !== "Select Center" ? centerName : "",
        location: document.getElementById("location").value.trim(),
        divyavani: document.getElementById("divyavani").value.trim(),
        subject: document.getElementById("subject").value.trim(),
        htmlBody: quill ? quill.root.innerHTML : "",
        categories: getSelectedCategories()
    };
}

function applyDataToForm(data) {
    if (!data) return;
    if (data.date) document.getElementById("date").value = data.date;
    if (data.day) document.getElementById("day").value = data.day;
    if (data.startTime) document.getElementById("startTime").value = data.startTime;
    if (data.endTime) document.getElementById("endTime").value = data.endTime;
    if (data.occasion) document.getElementById("occasion").value = data.occasion;
    if (data.location) document.getElementById("location").value = data.location;
    if (data.divyavani) document.getElementById("divyavani").value = data.divyavani;
    if (data.subject) document.getElementById("subject").value = data.subject;

    const gradeVal = data.grade || "A";
    const gradeRadio = document.querySelector(`input[name="grade"][value="${gradeVal}"]`);
    if (gradeRadio) gradeRadio.checked = true;

    if (quill && data.htmlBody) quill.root.innerHTML = data.htmlBody;

    // Restore hierarchy
    if (data.countryId) {
        document.getElementById("countrySelect").value = data.countryId;
        handleCountryChange();
    }
    if (data.zoneId || data.zone) {
        setTimeout(() => {
            const zSelect = document.getElementById("zoneSelect");
            if (data.zoneId) zSelect.value = data.zoneId;
            else {
                for (let i = 0; i < zSelect.options.length; i++) {
                    if (zSelect.options[i].textContent.toLowerCase() === (data.zone || "").toLowerCase()) {
                        zSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            handleZoneChange();

            if (data.centerId || data.center) {
                setTimeout(() => {
                    const cntSelect = document.getElementById("centerSelect");
                    if (data.centerId) cntSelect.value = data.centerId;
                    else {
                        for (let i = 0; i < cntSelect.options.length; i++) {
                            if (cntSelect.options[i].textContent.toLowerCase() === (data.center || "").toLowerCase()) {
                                cntSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                }, 50);
            }
        }, 50);
    }

    // Restore categories
    renderCategories();
    setTimeout(() => {
        if (data.categories) {
            for (const [main, subs] of Object.entries(data.categories)) {
                const safeId = main.replace(/\s+/g, "_");
                const mainCheck = document.getElementById(`main_${safeId}`);
                if (!mainCheck) continue;
                if (!mainCheck.checked) mainCheck.click();

                const subChecks = document.querySelectorAll(`.sub-cat-${safeId}`);
                subChecks.forEach((chk) => {
                    chk.checked = Array.isArray(subs) ? subs.includes(chk.value) : false;
                });
            }
        }
    }, 80);

    updateDay();
}

// --- 8. SAVE, UPDATE & EXPORT ---
function validateForm() {
    const data = getFormData();
    if (!data.date) return "Date is required! (તારીખ જરૂરી છે!)";
    if (!data.startTime) return "Start Time is required! (શરૂઆત સમય જરૂરી છે!)";
    if (!data.endTime) return "End Time is required! (પૂર્ણ સમય જરૂરી છે!)";
    if (!data.occasion) return "Occasion is required! (પ્રસંગ જરૂરી છે!)";
    if (!data.location) return "Location is required! (સ્થળ જરૂરી છે!)";
    if (!data.htmlBody || data.htmlBody === "<p><br></p>") return "Report body is required! (અહેવાલ લખાણ જરૂરી છે!)";
    return null;
}

async function saveAndGenerate(type, action) {
    const errMsg = validateForm();
    if (errMsg) {
        alert(errMsg);
        return;
    }

    showLoader("SAVING & EXPORTING...");
    const data = getFormData();

    try {
        let reportId = currentReportId;
        if (!reportId) {
            const res = await authFetch("/api/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const resData = await res.json();
            if (!resData.ok) throw new Error(resData.error);
            reportId = resData.id;
            clearDraft();
        }

        const d = new Date(data.date);
        const dayStr = String(d.getDate()).padStart(2, "0");
        const monthStr = d.toLocaleString("en-US", { month: "short" });
        const yearStr = d.getFullYear();
        const fname = `${dayStr} ${monthStr}_${yearStr}_${data.occasion}_${data.location}`;

        if (type === "pdf") {
            await handlePDF(data, fname, action);
        } else {
            handleWord(data, fname, action);
        }

        await fetchReports();
        alert("Report Saved Successfully! 🎉");
        showDashboard();
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        hideLoader();
    }
}

async function updateDataOnly() {
    const errMsg = validateForm();
    if (errMsg) {
        alert(errMsg);
        return;
    }

    showLoader("UPDATING REPORT...");
    const data = getFormData();

    try {
        const res = await authFetch(`/api/reports/${currentReportId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (!resData.ok) throw new Error(resData.error);

        await fetchReports();
        alert("Report Updated Successfully! ✅");
        showHistory();
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        hideLoader();
    }
}

// --- 9. EXACT ORIGINAL PDF & WORD GENERATION ---
function getCleanPreviewHTML(data, isForDownload = false) {
    let catHtml = "";
    if (data.categories) {
        for (const [main, subs] of Object.entries(data.categories)) {
            if (subs && subs.length > 0) {
                catHtml += `<div style="margin-bottom:2px; font-size:12px;"><b>${main}:</b> ${subs.join(", ")}</div>`;
            }
        }
    }

    const dateParts = (data.date || "").split("-");
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : data.date;

    const zoneCenterRow = (!isForDownload && data.zone && data.center) ? `
        <tr><td><b>ઝોન:</b> ${data.zone}</td><td><b>સેન્ટર:</b> ${data.center}</td></tr>
    ` : "";

    return `
    <div style="font-family: 'Hind Vadodara', 'Noto Sans Gujarati', sans-serif; padding: 0; color: #000000 !important; background-color: #ffffff !important; font-size: 14px; width: 96%; margin: 0 auto; box-sizing: border-box;">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700&display=swap');
            * { font-family: 'Hind Vadodara', 'Noto Sans Gujarati', sans-serif !important; }
            table { width: 100%; border-collapse: collapse; border: 2px solid #000; background-color: #ffffff !important; }
            td, th { border: 1px solid #000; padding: 6px 8px; vertical-align: top; color: #000000 !important; font-size: 13.5px; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
            .report-narrative-cell {
                border: 2px solid #000 !important;
                border-top: none !important;
                padding: 12px 16px !important;
                text-align: justify;
                line-height: 1.85 !important;
                letter-spacing: 0.15px;
                font-size: 14px;
                background-color: #ffffff !important;
                color: #000000 !important;
            }
            .report-narrative-cell * { 
                color: #000000 !important;
                line-height: 1.85 !important;
            }
            .report-narrative-cell p, .report-narrative-cell li, .report-narrative-cell div {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin-bottom: 8px;
            }
            .report-narrative-cell ul, .report-narrative-cell ol {
                margin-top: 4px;
                margin-bottom: 8px;
                padding-left: 22px;
            }
        </style>
        <table>
            <tbody>
                <tr><td colspan="2" style="border: 2px solid #000; padding: 10px; text-align: center;"><h2 style="font-size: 20px; color: #000000; margin: 0; text-transform: uppercase; font-weight: 700;">SMVS SAMARPAN KARYALYA</h2><p style="font-size: 11px; color: #000000; margin: 0;">Video Post Production Data Report</p></td></tr>
                <tr><td style="width: 50%;"><b>તારીખ:</b> ${formattedDate}</td><td style="width: 50%;"><b>વાર:</b> ${data.day}</td></tr>
                <tr><td><b>સમય:</b> ${data.startTime} થી ${data.endTime}</td><td><b>ગ્રેડ:</b> ${data.grade}</td></tr>
                ${zoneCenterRow}
                <tr><td><b>પ્રસંગ:</b> ${data.occasion}</td><td><b>સ્થળ:</b> ${data.location}</td></tr>
                <tr><td colspan="2"><b>દિવ્યવાણી:</b> ${data.divyavani}</td></tr>
                <tr><td colspan="2"><b>સભાનો વિષય:</b><br/>${data.subject}</td></tr>
                <tr><td colspan="2"><b>કેટેગરી:</b><br/>${catHtml}</td></tr>
                <tr><td colspan="2" style="font-weight: bold; background-color: #f0f0f0 !important; color: #000000 !important;">કથાવાર્તા અહેવાલ</td></tr>
                <tr>
                    <td colspan="2" class="report-narrative-cell">
                        ${data.htmlBody || ""}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>`;
}

function getWordContent(data) {
    let catHtml = "";
    if (data.categories) {
        for (const [main, subs] of Object.entries(data.categories)) {
            if (subs && subs.length > 0) {
                catHtml += `<p style="margin:0;"><b>${main}:</b> ${subs.join(", ")}</p>`;
            }
        }
    }

    const dateParts = (data.date || "").split("-");
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : data.date;

    return `<!DOCTYPE html><html><head><meta charset='utf-8'><style>body { font-family: Arial, sans-serif; } table { border-collapse: collapse; width: 100%; border: 1px solid black; } td { border: 1px solid black; padding: 5px; vertical-align: top; } h2, p { margin: 0; }</style></head><body><table border="1" cellspacing="0" cellpadding="5" width="100%"><tr><td colspan="2" align="center" style="border-bottom: 2px solid black; padding: 10px;"><h2 style="font-size: 18pt; color:#d35400;">SMVS SAMARPAN KARYALYA</h2><p style="font-size: 10pt;">Video Post Production Data Report</p></td></tr><tr><td width="50%"><b>Date:</b> ${formattedDate}</td><td width="50%"><b>Day:</b> ${data.day}</td></tr><tr><td><b>Time:</b> ${data.startTime} - ${data.endTime}</td><td><b>Grade:</b> ${data.grade}</td></tr><tr><td><b>Occasion:</b> ${data.occasion}</td><td><b>Location:</b> ${data.location}</td></tr><tr><td colspan="2"><b>Divyavani:</b> ${data.divyavani}</td></tr><tr><td colspan="2"><b>Subject:</b><br/>${data.subject}</td></tr><tr><td colspan="2"><b>Categories:</b><br/>${catHtml}</td></tr><tr><td colspan="2" style="background-color:#f0f0f0;"><b>Report Body:</b></td></tr><tr><td colspan="2" style="padding: 10px;">${data.htmlBody}</td></tr></table></body></html>`;
}

async function handlePDF(data, fileName, action) {
    if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
    }
    const content = getCleanPreviewHTML(data, true);
    const opt = {
        margin: 0.3,
        filename: fileName + ".pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            scrollY: 0,
            backgroundColor: "#ffffff",
            letterRendering: false
        },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: {
            mode: ["avoid-all", "css", "legacy"],
            avoid: ["tr", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6"]
        }
    };
    const worker = html2pdf().set(opt).from(content);
    if (action === "download") {
        await worker.save();
    } else if (action === "share") {
        const pdfBlob = await worker.output("blob");
        await shareFile(pdfBlob, fileName + ".pdf", "application/pdf");
    }
}

function handleWord(data, fileName, action) {
    const htmlContent = getWordContent(data);
    const converted = htmlDocx.asBlob(htmlContent, {
        orientation: "portrait",
        margins: { top: 720, bottom: 720, left: 720, right: 720 }
    });
    if (action === "download") saveAs(converted, fileName + ".docx");
    else if (action === "share") {
        shareFile(converted, fileName + ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }
}

async function shareFile(blob, filename, mimeType) {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: "SMVS Report", text: filename });
        } catch (err) {}
    } else {
        alert("Downloading (Share not supported on this browser)");
        saveAs(blob, filename);
    }
}

// --- 10. PREVIEW REPORT ---
window.previewReport = function(source, id = null) {
    let data;
    if (source === "form") {
        data = getFormData();
    } else {
        data = allReports.find(r => String(r.id) === String(id));
    }
    if (!data) return;
    document.getElementById("previewContent").innerHTML = getCleanPreviewHTML(data, false);
    previewModal.show();
};

// --- 11. EXACT ORIGINAL HISTORY VIEW & FILTER ---
window.showHistory = function() {
    document.getElementById("dashboardView").classList.add("d-none");
    document.getElementById("formView").classList.add("d-none");
    document.getElementById("adminView").classList.add("d-none");
    document.getElementById("historyView").classList.remove("d-none");
    renderHistory(allReports);
};

window.filterReports = function() {
    const fDate = document.getElementById("filterDate").value;
    const fCountry = parseInt(document.getElementById("filterCountry").value) || null;
    const fZone = parseInt(document.getElementById("filterZone").value) || null;
    const fCenter = parseInt(document.getElementById("filterCenter").value) || null;

    const fOccasionRaw = document.getElementById("filterOccasion").value.toLowerCase().trim();
    const fLocationRaw = document.getElementById("filterLocation").value.toLowerCase().trim();
    const fOccasionSmart = normalizeText(fOccasionRaw);
    const fLocationSmart = normalizeText(fLocationRaw);

    const filtered = allReports.filter(r => {
        const dateMatch = fDate ? r.date === fDate : true;
        const countryMatch = fCountry ? r.countryId === fCountry : true;
        const zoneMatch = fZone ? r.zoneId === fZone : true;
        const centerMatch = fCenter ? r.centerId === fCenter : true;

        const rOcc = (r.occasion || "").toLowerCase();
        const occasionMatch = !fOccasionRaw || rOcc.includes(fOccasionRaw) || normalizeText(rOcc).includes(fOccasionSmart);

        const rLoc = (r.location || "").toLowerCase();
        const locationMatch = !fLocationRaw || rLoc.includes(fLocationRaw) || normalizeText(rLoc).includes(fLocationSmart);

        return dateMatch && countryMatch && zoneMatch && centerMatch && occasionMatch && locationMatch;
    });

    renderHistory(filtered);
};

function renderHistory(reports) {
    const list = document.getElementById("historyList");
    if (!list) return;

    if (reports.length === 0) {
        list.innerHTML = '<p class="text-center text-muted mt-4">No results.</p>';
        return;
    }

    let html = "";
    reports.forEach(r => {
        const dateObj = new Date(r.date);
        const dateDisplay = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;

        html += `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card h-100 btn-card">
                <div class="card-header d-flex justify-content-between align-items-center py-3">
                    <div>
                        <h6 class="mb-0 fw-bold" style="color: var(--primary);">${r.location}</h6>
                        <small class="text-muted">${dateDisplay} | ${r.day}</small>
                    </div>
                    <span class="badge bg-secondary">${r.grade}</span>
                </div>
                <div class="card-body">
                    <p class="mb-1 text-muted"><strong>Occasion:</strong> ${r.occasion}</p>
                    <p class="small text-muted text-truncate">${r.subject || "No Subject"}</p>
                </div>
                <div class="card-footer border-0 py-3" style="background-color: var(--bg-body);">
                    <div class="d-flex justify-content-between mb-2">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-danger" onclick="downloadFromHistory('${r.id}', 'pdf', 'download')"><i class="fa-solid fa-download"></i> PDF</button>
                            <button class="btn btn-outline-danger" onclick="downloadFromHistory('${r.id}', 'pdf', 'share')"><i class="fa-solid fa-share-nodes"></i></button>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="downloadFromHistory('${r.id}', 'word', 'download')"><i class="fa-solid fa-download"></i> Word</button>
                            <button class="btn btn-outline-primary" onclick="downloadFromHistory('${r.id}', 'word', 'share')"><i class="fa-solid fa-share-nodes"></i></button>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <button class="btn btn-outline-warning btn-sm" onclick="previewReport('history', '${r.id}')" title="Preview"><i class="fa-solid fa-eye"></i> Preview</button>
                        <div>
                            <button class="btn btn-outline-secondary btn-sm me-1" onclick="editReport('${r.id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="deleteReport('${r.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

window.downloadFromHistory = function(id, type, action) {
    const report = allReports.find(r => String(r.id) === String(id));
    if (!report) return;

    const d = new Date(report.date);
    const dayStr = String(d.getDate()).padStart(2, "0");
    const monthStr = d.toLocaleString("en-US", { month: "short" });
    const yearStr = d.getFullYear();
    const fname = `${dayStr} ${monthStr}_${yearStr}_${report.occasion}_${report.location}`;

    showLoader("PROCESSING...");
    if (type === "pdf") {
        handlePDF(report, fname, action).finally(hideLoader);
    } else {
        handleWord(report, fname, action);
        hideLoader();
    }
};

window.editReport = function(id) {
    const report = allReports.find(r => String(r.id) === String(id));
    if (!report) return;

    currentReportId = id;
    applyDataToForm(report);

    document.getElementById("dashboardView").classList.add("d-none");
    document.getElementById("historyView").classList.add("d-none");
    document.getElementById("adminView").classList.add("d-none");
    document.getElementById("formView").classList.remove("d-none");

    toggleButtons("edit");
    window.scrollTo(0, 0);
};

window.deleteReport = async function(id) {
    if (!confirm("Delete?")) return;
    showLoader("DELETING...");
    try {
        const res = await authFetch(`/api/reports/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        allReports = allReports.filter(r => String(r.id) !== String(id));
        renderHistory(allReports);
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        hideLoader();
    }
};

// --- 12. NAVIGATION & UI HELPERS ---
window.showDashboard = function() {
    document.getElementById("formView").classList.add("d-none");
    document.getElementById("historyView").classList.add("d-none");
    document.getElementById("adminView").classList.add("d-none");
    document.getElementById("dashboardView").classList.remove("d-none");
    updateDashboardUI();
};

window.showForm = function() {
    document.getElementById("dashboardView").classList.add("d-none");
    document.getElementById("historyView").classList.add("d-none");
    document.getElementById("adminView").classList.add("d-none");
    document.getElementById("formView").classList.remove("d-none");

    currentReportId = null;
    toggleButtons("create");

    if (!loadDraftIfAny()) {
        initForm();
    }
    window.scrollTo(0, 0);
};

function toggleButtons(mode) {
    const createBtns = document.getElementById("createButtons");
    const updateBtns = document.getElementById("updateButtons");
    if (mode === "edit") {
        createBtns.classList.add("d-none");
        updateBtns.classList.remove("d-none");
    } else {
        createBtns.classList.remove("d-none");
        updateBtns.classList.add("d-none");
    }
}

window.resetForm = function(force = false) {
    if (force && !confirm("Clear Form?")) return;
    clearDraft();
    document.getElementById("reportForm").reset();
    if (quill) quill.setContents([]);
    currentReportId = null;
    initForm();
    renderCategories();
    toggleButtons("create");
    window.scrollTo(0, 0);
};

function showLoader(text = "PROCESSING...") {
    const el = document.getElementById("loader");
    const txt = document.getElementById("loaderText");
    if (txt) txt.textContent = text;
    if (el) el.classList.remove("d-none");
}

function hideLoader() {
    const el = document.getElementById("loader");
    if (el) el.classList.add("d-none");
}

// --- 13. EXACT ORIGINAL GUJARATI-ENGLISH TRANSLITERATION ---
function normalizeText(text) {
    if (!text) return "";
    text = text.toLowerCase().trim();
    text = text.replace(/w/g, 'v');
    text = text.replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/sh/g, 's');

    const map = {
        'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh',
        'ચ': 'ch', 'છ': 'chh', 'જ': 'j', 'ઝ': 'z',
        'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh', 'ણ': 'n',
        'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n',
        'પ': 'p', 'ફ': 'f', 'બ': 'b', 'ભ': 'bh', 'મ': 'm',
        'ય': 'y', 'ર': 'r', 'લ': 'l', 'વ': 'v',
        'શ': 's', 'ષ': 's', 'સ': 's', 'હ': 'h', 'ળ': 'l',
        'ક્ષ': 'x', 'જ્ઞ': 'gn',
        'ા': 'a', 'િ': 'i', 'ી': 'i', 'ુ': 'u', 'ૂ': 'u',
        'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au', 'ં': 'n', 'ઃ': 'h'
    };

    let englishStr = "";
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        englishStr += map[char] || char;
    }

    return englishStr
        .replace(/w/g, 'v')
        .replace(/sh/g, 's')
        .replace(/[aeiou]/g, '');
}

// --- 14. ADMIN PANEL CONTROLLER (SELECTION-BASED MASTER DETAIL) ---
let adminSelectedCountryId = null;
let adminSelectedZoneId = null;
let adminSelectedCategoryId = null;

window.showAdminPanel = function() {
    if (currentUser?.role !== "admin") return;
    document.getElementById("dashboardView").classList.add("d-none");
    document.getElementById("formView").classList.add("d-none");
    document.getElementById("historyView").classList.add("d-none");
    document.getElementById("adminView").classList.remove("d-none");
    switchAdminTab("locations");
};

window.switchAdminTab = async function(tab) {
    currentAdminTab = tab;
    document.querySelectorAll("#adminView .btn-outline-primary").forEach(b => b.classList.remove("active"));
    const btnMap = {
        locations: "tabBtnLocations",
        categories: "tabBtnCategories",
        users: "tabBtnUsers"
    };
    const activeBtn = document.getElementById(btnMap[tab]);
    if (activeBtn) activeBtn.classList.add("active");

    const content = document.getElementById("adminTabContent");
    showLoader("LOADING...");

    try {
        if (tab === "locations") await renderAdminLocations(content);
        else if (tab === "categories") await renderAdminCategories(content);
        else if (tab === "users") await renderAdminUsers(content);
    } catch (e) {
        content.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    } finally {
        hideLoader();
    }
};

// Selection-Based Cascading Locations: Country -> Zone -> Center
async function renderAdminLocations(container) {
    const res = await fetch("/api/locations/tree");
    const data = await res.json();
    const tree = data.tree || [];

    if (tree.length > 0 && !adminSelectedCountryId) {
        adminSelectedCountryId = tree[0].id;
    }
    const currentCountry = tree.find(c => c.id === adminSelectedCountryId) || tree[0];

    const zones = currentCountry?.zones || [];
    if (zones.length > 0 && (!adminSelectedZoneId || !zones.some(z => z.id === adminSelectedZoneId))) {
        adminSelectedZoneId = zones[0].id;
    }
    const currentZone = zones.find(z => z.id === adminSelectedZoneId) || zones[0];
    const centers = currentZone?.centers || [];

    container.innerHTML = `
    <div class="row g-4">
        <!-- 1. Country Column -->
        <div class="col-12 col-md-4">
            <div class="card p-3 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0"><i class="fa-solid fa-earth-asia me-2"></i>1. Country (દેશ)</h6>
                    <span class="badge bg-secondary">${tree.length}</span>
                </div>
                <form onsubmit="addCountry(event)" class="mb-3">
                    <div class="input-group">
                        <input type="text" id="newCountryName" class="form-control" placeholder="Add Country..." required>
                        <button class="btn btn-primary" type="submit" title="Add Country"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </form>
                <div class="overflow-y-auto" style="max-height: 480px;">
                    ${tree.map(c => `
                        <div class="admin-list-item ${c.id === currentCountry?.id ? 'active' : ''}" onclick="selectAdminCountry(${c.id})">
                            <div>
                                <span class="fw-bold">${c.name}</span>
                                <small class="d-block text-muted">${c.zones.length} Zones</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" onclick="event.stopPropagation(); openAdminEdit('country', ${c.id}, '${c.name.replace(/'/g, "\\'")}', '${(c.code||'').replace(/'/g, "\\'")}');" title="Edit Country"><i class="fa-solid fa-pen-to-square fa-xs"></i></button>
                                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="event.stopPropagation(); deleteCountry(${c.id});" title="Delete Country"><i class="fa-solid fa-trash fa-xs"></i></button>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>

        <!-- 2. Zone Column (Based on Selected Country) -->
        <div class="col-12 col-md-4">
            <div class="card p-3 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0"><i class="fa-solid fa-map-location-dot me-2"></i>2. Zones in ${currentCountry ? currentCountry.name : ''}</h6>
                    <span class="badge bg-secondary">${zones.length}</span>
                </div>
                ${currentCountry ? `
                    <form onsubmit="addZone(event, ${currentCountry.id})" class="mb-3">
                        <div class="input-group">
                            <input type="text" id="newZoneName" class="form-control" placeholder="Add Zone in ${currentCountry.name}..." required>
                            <button class="btn btn-primary" type="submit" title="Add Zone"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </form>
                    <div class="overflow-y-auto" style="max-height: 480px;">
                        ${zones.length === 0 ? '<p class="text-muted small text-center py-3">No zones in this country yet.</p>' : ''}
                        ${zones.map(z => `
                            <div class="admin-list-item ${z.id === currentZone?.id ? 'active' : ''}" onclick="selectAdminZone(${z.id})">
                                <div>
                                    <span class="fw-bold">${z.name}</span>
                                    <small class="d-block text-muted">${z.centers.length} Centers</small>
                                </div>
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" onclick="event.stopPropagation(); openAdminEdit('zone', ${z.id}, '${z.name.replace(/'/g, "\\'")}', '', ${currentCountry.id});" title="Edit Zone"><i class="fa-solid fa-pen-to-square fa-xs"></i></button>
                                    <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="event.stopPropagation(); deleteZone(${z.id});" title="Delete Zone"><i class="fa-solid fa-trash fa-xs"></i></button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                ` : '<p class="text-muted small text-center py-4">Select a country first.</p>'}
            </div>
        </div>

        <!-- 3. Center Column (Based on Selected Zone) -->
        <div class="col-12 col-md-4">
            <div class="card p-3 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0"><i class="fa-solid fa-location-dot me-2"></i>3. Centers in ${currentZone ? currentZone.name : ''}</h6>
                    <span class="badge bg-secondary">${centers.length}</span>
                </div>
                ${currentZone ? `
                    <form onsubmit="addCenter(event, ${currentZone.id})" class="mb-3">
                        <div class="input-group">
                            <input type="text" id="newCenterName" class="form-control" placeholder="Add Center in ${currentZone.name}..." required>
                            <button class="btn btn-primary" type="submit" title="Add Center"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </form>
                    <div class="overflow-y-auto" style="max-height: 480px;">
                        ${centers.length === 0 ? '<p class="text-muted small text-center py-3">No centers in this zone yet.</p>' : ''}
                        ${centers.map(cnt => `
                            <div class="admin-list-item">
                                <span class="fw-bold">${cnt.name}</span>
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" onclick="openAdminEdit('center', ${cnt.id}, '${cnt.name.replace(/'/g, "\\'")}', '', ${currentZone.id});" title="Edit Center"><i class="fa-solid fa-pen-to-square fa-xs"></i></button>
                                    <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteCenter(${cnt.id});" title="Delete Center"><i class="fa-solid fa-trash fa-xs"></i></button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                ` : '<p class="text-muted small text-center py-4">Select a zone first.</p>'}
            </div>
        </div>
    </div>`;
}

window.selectAdminCountry = function(id) {
    adminSelectedCountryId = id;
    adminSelectedZoneId = null;
    switchAdminTab("locations");
};

window.selectAdminZone = function(id) {
    adminSelectedZoneId = id;
    switchAdminTab("locations");
};

window.addCountry = async function(e) {
    e.preventDefault();
    const name = document.getElementById("newCountryName").value.trim();
    if (!name) return;
    await authFetch("/api/admin/countries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await loadLocationsTree();
    switchAdminTab("locations");
};
window.deleteCountry = async function(id) {
    if (!confirm("Delete country?")) return;
    await authFetch(`/api/admin/countries/${id}`, { method: "DELETE" });
    if (adminSelectedCountryId === id) adminSelectedCountryId = null;
    await loadLocationsTree();
    switchAdminTab("locations");
};

window.addZone = async function(e, countryId) {
    e.preventDefault();
    const name = document.getElementById("newZoneName").value.trim();
    if (!countryId || !name) return;
    await authFetch("/api/admin/zones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryId, name }) });
    await loadLocationsTree();
    switchAdminTab("locations");
};
window.deleteZone = async function(id) {
    if (!confirm("Delete zone?")) return;
    await authFetch(`/api/admin/zones/${id}`, { method: "DELETE" });
    if (adminSelectedZoneId === id) adminSelectedZoneId = null;
    await loadLocationsTree();
    switchAdminTab("locations");
};

window.addCenter = async function(e, zoneId) {
    e.preventDefault();
    const name = document.getElementById("newCenterName").value.trim();
    if (!zoneId || !name) return;
    await authFetch("/api/admin/centers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zoneId, name }) });
    await loadLocationsTree();
    switchAdminTab("locations");
};
window.deleteCenter = async function(id) {
    if (!confirm("Delete center?")) return;
    await authFetch(`/api/admin/centers/${id}`, { method: "DELETE" });
    await loadLocationsTree();
    switchAdminTab("locations");
};

// Selection-Based Categories: Click Main Category on Left -> Shows Subcategories on Right
async function renderAdminCategories(container) {
    const res = await authFetch("/api/admin/categories");
    const data = await res.json();
    const cats = data.categories || [];
    const subs = data.subCategories || [];

    if (cats.length > 0 && !adminSelectedCategoryId) {
        adminSelectedCategoryId = cats[0].id;
    }
    const currentCat = cats.find(c => c.id === adminSelectedCategoryId) || cats[0];
    const catSubs = subs.filter(s => s.category_id === currentCat?.id);

    container.innerHTML = `
    <div class="row g-4">
        <!-- 1. Main Categories Column (Left) -->
        <div class="col-12 col-md-5">
            <div class="card p-3 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0"><i class="fa-solid fa-tags me-2"></i>Main Categories (મુખ્ય કેટેગરી)</h6>
                    <span class="badge bg-secondary">${cats.length}</span>
                </div>
                <form onsubmit="addCategory(event)" class="mb-3">
                    <div class="input-group">
                        <input type="text" id="newCatName" class="form-control" placeholder="Add New Category..." required>
                        <button class="btn btn-primary" type="submit" title="Add Category"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </form>
                <div class="overflow-y-auto" style="max-height: 480px;">
                    ${cats.map(c => {
                        const count = subs.filter(s => s.category_id === c.id).length;
                        return `
                        <div class="admin-list-item ${c.id === currentCat?.id ? 'active' : ''}" onclick="selectAdminCategory(${c.id})">
                            <div>
                                <span class="fw-bold">${c.name}</span>
                                <small class="d-block text-muted">${count} Subcategories</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" onclick="event.stopPropagation(); openAdminEdit('category', ${c.id}, '${c.name.replace(/'/g, "\\'")}');" title="Edit Category"><i class="fa-solid fa-pen-to-square fa-xs"></i></button>
                                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="event.stopPropagation(); deleteCategory(${c.id});" title="Delete Category"><i class="fa-solid fa-trash fa-xs"></i></button>
                            </div>
                        </div>`;
                    }).join("")}
                </div>
            </div>
        </div>

        <!-- 2. Subcategories Column (Right - Based on Selected Category) -->
        <div class="col-12 col-md-7">
            <div class="card p-3 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0">
                        <i class="fa-solid fa-list-check me-2"></i>Sub-Categories of <span class="text-warning">"${currentCat ? currentCat.name : ''}"</span>
                    </h6>
                    <span class="badge bg-secondary">${catSubs.length}</span>
                </div>
                ${currentCat ? `
                    <form onsubmit="addSubCategory(event, ${currentCat.id})" class="mb-3">
                        <div class="input-group">
                            <input type="text" id="newSubCatName" class="form-control" placeholder="Add Sub-Category in ${currentCat.name}..." required>
                            <button class="btn btn-primary" type="submit" title="Add Sub-Category"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </form>
                    <div class="overflow-y-auto" style="max-height: 480px;">
                        ${catSubs.length === 0 ? '<p class="text-muted small text-center py-4">No sub-categories in this category yet. Add one above!</p>' : ''}
                        ${catSubs.map(s => `
                            <div class="admin-list-item">
                                <span class="fw-bold">${s.name}</span>
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" onclick="openAdminEdit('subcategory', ${s.id}, '${s.name.replace(/'/g, "\\'")}', '', ${currentCat.id});" title="Edit Sub-Category"><i class="fa-solid fa-pen-to-square fa-xs"></i></button>
                                    <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteSubCategory(${s.id});" title="Delete Sub-Category"><i class="fa-solid fa-trash fa-xs"></i></button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                ` : '<p class="text-muted small text-center py-4">Select a category on the left first.</p>'}
            </div>
        </div>
    </div>`;
}

window.selectAdminCategory = function(id) {
    adminSelectedCategoryId = id;
    switchAdminTab("categories");
};

window.addCategory = async function(e) {
    e.preventDefault();
    const name = document.getElementById("newCatName").value.trim();
    if (!name) return;
    await authFetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await loadCategories();
    switchAdminTab("categories");
};
window.deleteCategory = async function(id) {
    if (!confirm("Delete category?")) return;
    await authFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (adminSelectedCategoryId === id) adminSelectedCategoryId = null;
    await loadCategories();
    switchAdminTab("categories");
};

window.addSubCategory = async function(e, categoryId) {
    e.preventDefault();
    const name = document.getElementById("newSubCatName").value.trim();
    if (!categoryId || !name) return;
    await authFetch("/api/admin/subcategories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId, name }) });
    await loadCategories();
    switchAdminTab("categories");
};
window.deleteSubCategory = async function(id) {
    if (!confirm("Delete sub-category?")) return;
    await authFetch(`/api/admin/subcategories/${id}`, { method: "DELETE" });
    await loadCategories();
    switchAdminTab("categories");
};

// Admin Users Tab
async function renderAdminUsers(container) {
    const res = await authFetch("/api/admin/users");
    const data = await res.json();
    const users = data.users || [];

    container.innerHTML = `
    <div class="row g-4">
        <div class="col-12 col-lg-4">
            <div class="card p-3">
                <h6 class="text-primary fw-bold mb-3"><i class="fa-solid fa-user-plus me-2"></i>Add New User</h6>
                <form onsubmit="addUser(event)">
                    <div class="mb-2">
                        <label class="form-label small">Username</label>
                        <input type="text" id="newUsername" class="form-control" placeholder="Username" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small">Email</label>
                        <input type="email" id="newUserEmail" class="form-control" placeholder="Email" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small">Full Name</label>
                        <input type="text" id="newUserFullName" class="form-control" placeholder="Full Name">
                    </div>
                    <div class="mb-2">
                        <label class="form-label small">Password</label>
                        <input type="password" id="newUserPass" class="form-control" placeholder="Password" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small">Role</label>
                        <select id="newUserRole" class="form-select">
                            <option value="user">User (Standard)</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 fw-bold"><i class="fa-solid fa-user-check me-1"></i> Create User</button>
                </form>
            </div>
        </div>

        <div class="col-12 col-lg-8">
            <div class="card p-3">
                <h6 class="text-primary fw-bold mb-3"><i class="fa-solid fa-users me-2"></i>Existing Users (${users.length})</h6>
                <div class="table-responsive">
                    <table class="table table-dark table-hover mb-0 align-middle">
                        <thead>
                            <tr class="text-muted small">
                                <th>ID</th>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td><code>#${u.id}</code></td>
                                    <td class="fw-bold">${u.fullName || u.username}</td>
                                    <td><small class="text-muted">${u.email}</small></td>
                                    <td><span class="${u.role === 'admin' ? 'badge bg-warning text-dark' : 'badge bg-secondary'}">${u.role}</span></td>
                                    <td><span class="badge ${u.isActive ? 'bg-success' : 'bg-danger'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td class="text-end text-nowrap">
                                        <button class="btn btn-sm btn-outline-warning me-1" onclick="openAdminEdit('user', ${u.id}, '${u.username}', '', null, '${(u.fullName||'').replace(/'/g, "\\'")}', '${u.email}', '${u.role}', ${u.isActive ? 1 : 0});" title="Edit User"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})" ${u.id === currentUser.id ? 'disabled' : ''} title="Delete User"><i class="fa-solid fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;
}

// Universal Admin Edit Modal Handler
let adminEditModalInstance = null;

window.openAdminEdit = function(type, id, name, code = "", parentId = null, fullName = "", email = "", role = "user", isActive = 1) {
    document.getElementById("adminEditType").value = type;
    document.getElementById("adminEditId").value = id;
    
    const titleEl = document.getElementById("adminEditModalTitle");
    const nameGroup = document.getElementById("adminEditNameGroup");
    const nameLabel = document.getElementById("adminEditNameLabel");
    const nameInput = document.getElementById("adminEditNameInput");
    const parentGroup = document.getElementById("adminEditParentGroup");
    const parentLabel = document.getElementById("adminEditParentLabel");
    const parentSelect = document.getElementById("adminEditParentSelect");
    const userFields = document.getElementById("adminEditUserFields");

    // Reset fields
    parentGroup.classList.add("d-none");
    userFields.classList.add("d-none");
    nameGroup.classList.remove("d-none");
    nameInput.value = name || "";

    if (type === "country") {
        titleEl.innerHTML = '<i class="fa-solid fa-earth-asia me-2 text-warning"></i>Edit Country';
        nameLabel.textContent = "Country Name";
    } else if (type === "zone") {
        titleEl.innerHTML = '<i class="fa-solid fa-map-location-dot me-2 text-warning"></i>Edit Zone';
        nameLabel.textContent = "Zone Name";
        parentGroup.classList.remove("d-none");
        parentLabel.textContent = "Parent Country";
        parentSelect.innerHTML = (locationTree || []).map(c => `<option value="${c.id}" ${c.id === parentId ? 'selected' : ''}>${c.name}</option>`).join("");
    } else if (type === "center") {
        titleEl.innerHTML = '<i class="fa-solid fa-location-dot me-2 text-warning"></i>Edit Center';
        nameLabel.textContent = "Center Name";
        parentGroup.classList.remove("d-none");
        parentLabel.textContent = "Parent Zone";
        
        let zoneOptions = "";
        (locationTree || []).forEach(c => {
            (c.zones || []).forEach(z => {
                zoneOptions += `<option value="${z.id}" ${z.id === parentId ? 'selected' : ''}>${z.name} (${c.name})</option>`;
            });
        });
        parentSelect.innerHTML = zoneOptions;
    } else if (type === "category") {
        titleEl.innerHTML = '<i class="fa-solid fa-tags me-2 text-warning"></i>Edit Category';
        nameLabel.textContent = "Category Name";
    } else if (type === "subcategory") {
        titleEl.innerHTML = '<i class="fa-solid fa-list-check me-2 text-warning"></i>Edit Sub-Category';
        nameLabel.textContent = "Sub-Category Name";
    } else if (type === "user") {
        titleEl.innerHTML = '<i class="fa-solid fa-user-pen me-2 text-warning"></i>Edit User';
        nameGroup.classList.add("d-none");
        userFields.classList.remove("d-none");
        document.getElementById("adminEditUserFullName").value = fullName;
        document.getElementById("adminEditUserEmail").value = email;
        document.getElementById("adminEditUserRole").value = role;
        document.getElementById("adminEditUserPassword").value = "";
        document.getElementById("adminEditUserActive").checked = Boolean(isActive);
    }

    if (!adminEditModalInstance) {
        adminEditModalInstance = new bootstrap.Modal(document.getElementById("adminEditModal"));
    }
    adminEditModalInstance.show();
};

window.submitAdminEdit = async function(e) {
    if (e) e.preventDefault();
    const type = document.getElementById("adminEditType").value;
    const id = document.getElementById("adminEditId").value;
    const name = document.getElementById("adminEditNameInput").value.trim();
    const parentId = parseInt(document.getElementById("adminEditParentSelect").value) || null;

    showLoader("SAVING CHANGES...");
    try {
        let url = "";
        let body = {};

        if (type === "country") {
            url = `/api/admin/countries/${id}`;
            body = { name };
        } else if (type === "zone") {
            url = `/api/admin/zones/${id}`;
            body = { name, countryId: parentId };
        } else if (type === "center") {
            url = `/api/admin/centers/${id}`;
            body = { name, zoneId: parentId };
        } else if (type === "category") {
            url = `/api/admin/categories/${id}`;
            body = { name };
        } else if (type === "subcategory") {
            url = `/api/admin/subcategories/${id}`;
            body = { name };
        } else if (type === "user") {
            url = `/api/admin/users/${id}`;
            body = {
                fullName: document.getElementById("adminEditUserFullName").value.trim(),
                email: document.getElementById("adminEditUserEmail").value.trim(),
                username: document.getElementById("adminEditNameInput").value.trim() || document.getElementById("adminEditUserEmail").value.split('@')[0],
                role: document.getElementById("adminEditUserRole").value,
                password: document.getElementById("adminEditUserPassword").value,
                isActive: document.getElementById("adminEditUserActive").checked
            };
        }

        const res = await authFetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Update failed");

        if (adminEditModalInstance) adminEditModalInstance.hide();

        if (type === "country" || type === "zone" || type === "center") {
            await loadLocationsTree();
            switchAdminTab("locations");
        } else if (type === "category" || type === "subcategory") {
            await loadCategories();
            switchAdminTab("categories");
        } else if (type === "user") {
            switchAdminTab("users");
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        hideLoader();
    }
};

window.addUser = async function(e) {
    e.preventDefault();
    const username = document.getElementById("newUsername").value.trim();
    const email = document.getElementById("newUserEmail").value.trim();
    const fullName = document.getElementById("newUserFullName").value.trim();
    const password = document.getElementById("newUserPass").value;
    const role = document.getElementById("newUserRole").value;

    await authFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, fullName, password, role })
    });
    switchAdminTab("users");
};
window.deleteUser = async function(id) {
    if (!confirm("Delete user?")) return;
    await authFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    switchAdminTab("users");
};

// Admin Trash & Restore Tab
async function renderAdminTrash(container) {
    const res = await authFetch("/api/admin/trash");
    const data = await res.json();
    const trash = data.trash || [];

    container.innerHTML = `
    <div class="card p-3">
        <h6 class="text-primary fw-bold mb-3"><i class="fa-solid fa-trash-can me-1"></i> Deleted Reports in Trash (${trash.length})</h6>
        ${trash.length === 0 ? '<p class="text-muted text-center py-4">Trash is empty. No deleted reports found.</p>' : `
            <div class="table-responsive">
                <table class="table table-dark table-hover mb-0">
                    <thead>
                        <tr class="text-muted small">
                            <th>Date</th>
                            <th>Location & Occasion</th>
                            <th>Zone/Center</th>
                            <th>Deleted By</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trash.map(r => `
                            <tr>
                                <td>${r.date}</td>
                                <td><b>${r.location}</b><br/><small class="text-muted">${r.occasion}</small></td>
                                <td>${r.zone} ${r.center ? '/ ' + r.center : ''}</td>
                                <td><small class="text-muted">${r.deletedByName || '-'}</small></td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-success me-1" onclick="restoreTrashReport(${r.id})"><i class="fa-solid fa-rotate-left me-1"></i>Restore</button>
                                    <button class="btn btn-sm btn-danger" onclick="purgeTrashReport(${r.id})"><i class="fa-solid fa-xmark me-1"></i>Purge</button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `}
    </div>`;
}

window.restoreTrashReport = async function(id) {
    await authFetch(`/api/admin/trash/restore/${id}`, { method: "POST" });
    await fetchReports();
    switchAdminTab("trash");
};
window.purgeTrashReport = async function(id) {
    if (!confirm("Permanently purge this report?")) return;
    await authFetch(`/api/admin/trash/purge/${id}`, { method: "DELETE" });
    switchAdminTab("trash");
};

// Admin Audit Logs Tab
async function renderAdminAudit(container) {
    const res = await authFetch("/api/admin/audit-logs");
    const data = await res.json();
    const logs = data.logs || [];

    container.innerHTML = `
    <div class="card p-3">
        <h6 class="text-primary fw-bold mb-3"><i class="fa-solid fa-list-check me-1"></i> Activity Audit Logs (Last 150)</h6>
        <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
            <table class="table table-dark table-hover small mb-0">
                <thead>
                    <tr class="text-muted">
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Entity</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(l => `
                        <tr>
                            <td><small class="text-muted">${new Date(l.created_at).toLocaleString()}</small></td>
                            <td><b>@${l.username}</b></td>
                            <td><span class="badge ${l.action.includes('DELETE') ? 'bg-danger' : l.action.includes('CREATE') ? 'bg-success' : 'bg-primary'}">${l.action}</span></td>
                            <td><code>${l.entity_type}</code></td>
                            <td><small class="text-muted font-monospace">${JSON.stringify(l.details)}</small></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    </div>`;
}


