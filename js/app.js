// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyDB_GvwLwqBJuZxYob0b5Vh-L-nFn4YdIs",
    authDomain: "smvs-report-app.firebaseapp.com",
    projectId: "smvs-report-app",
    storageBucket: "smvs-report-app.firebasestorage.app",
    messagingSenderId: "780579541622",
    appId: "1:780579541622:web:fa9843949311131e13c557"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- 2. DATA ---
const categoriesData = {
    "SK": ["સંત સભા", "સંત શિબિર", "STK સભા", "STK શિબિર", "SKS", "છાત્રાલય", "SBS"],
    "AP": ["Pre-AYP", "AYP", "પ્રી-મુમુક્ષુ", "ABS", "AVP"],
    "Prakashan": ["ગુરુકુળ", "પ્રકાશન", "ચેનલ", "વેબસાઇટ", "સોશિયલ મીડિયા", "DC (SC...)", "પુસ્તક", "ક્લીપ", "Store"],
    "Satsang Samaj": ["બાળકો", "કિશોરો", "યુવકો", "વડીલો", "અંગત સભા", "અંગત શિબિર", "પ્રાતઃસભા", "VCD સભા", "ઉત્સવ"],
    "Talim": ["પૂ.સંતો", "સ્ટાફ (તાલીમ)", "અગ્રેસર (તાલીમ)", "સંચાલક (તાલીમ)", "કાર્યકર (તાલીમ)"],
    "Sevabhavi": ["સંચાલક (સેવાભાવી)", "કાર્યકર (સેવાભાવી)", "અગ્રેસર (સેવાભાવી)", "સ્ટાફ (સેવાભાવી)", "BN"]
};

let quill;
let currentReportId = null;
let allReports = [];

// --- 3. INIT ---
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        const loginView = document.getElementById('loginView');
        const mainApp = document.getElementById('mainApp');
        if (user) {
            loginView.classList.add('d-none');
            mainApp.classList.remove('d-none');
            initApp();
        } else {
            loginView.classList.remove('d-none');
            mainApp.classList.add('d-none');
        }
    });
});

function initApp() {
    initForm();
    if(!quill) {
        quill = new Quill('#editor-container', {
            theme: 'snow', placeholder: 'Report content here (અહીં લખો)...',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{'list': 'ordered'}, {'list': 'bullet'}], [{'align': []}], ['clean']] }
        });
    }
    renderCategories();
    document.getElementById('date').addEventListener('change', updateDay);
}

// LOGIN / LOGOUT
window.handleLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const btn = e.target.querySelector('button');
    btn.innerHTML = 'Verifying...';
    btn.disabled = true;
    errorDiv.classList.add('d-none');
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        errorDiv.textContent = "Invalid Credentials!";
        errorDiv.classList.remove('d-none');
        btn.innerHTML = 'Login Access';
        btn.disabled = false;
    }
};

window.logoutUser = function() {
    if(confirm("Logout?")) auth.signOut();
};

function initForm() {
    const today = new Date();
    document.getElementById('date').valueAsDate = today;
    updateDay();
    const now = new Date();
    document.getElementById('startTime').value = now.toTimeString().substring(0,5);
    now.setMinutes(now.getMinutes() + 90);
    document.getElementById('endTime').value = now.toTimeString().substring(0,5);
    toggleButtons('create');
}

function updateDay() {
    const d = new Date(document.getElementById('date').value);
    const days = ['Sunday (રવિવાર)', 'Monday (સોમવાર)', 'Tuesday (મંગળવાર)', 'Wednesday (બુધવાર)', 'Thursday (ગુરુવાર)', 'Friday (શુક્રવાર)', 'Saturday (શનિવાર)'];
    if(!isNaN(d)) document.getElementById('day').value = days[d.getDay()];
}

function toggleButtons(mode) {
    const createBtns = document.getElementById('createButtons');
    const updateBtns = document.getElementById('updateButtons');
    if (mode === 'edit') {
        createBtns.classList.add('d-none');
        updateBtns.classList.remove('d-none');
    } else {
        createBtns.classList.remove('d-none');
        updateBtns.classList.add('d-none');
    }
}

function renderCategories() {
    const container = document.getElementById('categoryContainer');
    let html = '';
    for (const [main, subs] of Object.entries(categoriesData)) {
        const safeId = main.replace(/\s+/g, '_'); 
        html += `
        <div class="mb-2 p-2 rounded border" style="background-color: var(--bg-body);">
            <div class="d-flex align-items-center">
                <input class="form-check-input me-2" type="checkbox" id="main_${safeId}" value="${main}" onchange="toggleSub('${safeId}')">
                <label class="fw-bold mb-0" style="color: var(--primary); cursor:pointer;" for="main_${safeId}">${main}</label>
            </div>
            <div id="subs_${safeId}" class="d-none ms-3 mt-1 d-flex flex-wrap">
                ${subs.map((sub, index) => `
                    <div class="me-2 mb-1">
                        <input type="checkbox" class="sub-cat-${safeId}" value="${sub}" id="sub_${safeId}_${index}">
                        <label class="ms-1 small text-muted" for="sub_${safeId}_${index}">${sub}</label>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

window.toggleSub = function(safeId) {
    const mainCheck = document.getElementById(`main_${safeId}`);
    const subDiv = document.getElementById(`subs_${safeId}`);
    if (mainCheck.checked) {
        subDiv.classList.remove('d-none');
    } else {
        subDiv.classList.add('d-none');
        document.querySelectorAll(`.sub-cat-${safeId}`).forEach(el => el.checked = false);
    }
};

// --- 🔥 VALIDATION LOGIC (બધી ફિલ્ડ ચેક કરવા માટે) ---
function validateForm() {
    const date = document.getElementById('date').value;
    if (!date) return "Date is required! (તારીખ જરૂરી છે!)";

    const startTime = document.getElementById('startTime').value;
    if (!startTime) return "Start Time is required! (શરૂઆત સમય જરૂરી છે!)";

    const endTime = document.getElementById('endTime').value;
    if (!endTime) return "End Time is required! (પૂર્ણ સમય જરૂરી છે!)";

    const occasion = document.getElementById('occasion').value.trim();
    if (!occasion) return "Occasion is required! (પ્રસંગ જરૂરી છે!)";

    const location = document.getElementById('location').value.trim();
    if (!location) return "Location is required! (સ્થળ જરૂરી છે!)";

    const divyavani = document.getElementById('divyavani').value.trim();
    if (!divyavani) return "Divyavani is required! (દિવ્યવાણી જરૂરી છે!)";

    const subject = document.getElementById('subject').value.trim();
    if (!subject) return "Subject is required! (સભાનો વિષય જરૂરી છે!)";

    return null; // બધું બરાબર છે
}

// --- PREVIEW FUNCTION ---
window.previewReport = function(source, id = null) {
    let data;
    if (source === 'form') {
        const error = validateForm();
        if (error) return alert(error); // Preview માટે પણ વેલિડેશન
        data = getFormData();
    } else if (source === 'history' && id) {
        data = allReports.find(r => r.id === id);
    }

    if (!data) return alert("Error loading data");

    const htmlContent = getCleanPreviewHTML(data);
    document.getElementById('previewContent').innerHTML = htmlContent;
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    modal.show();
};

// --- SAVE & GENERATE ---
window.saveAndGenerate = async function(type, action) {
    // 🛑 VALIDATION CHECK HERE
    const error = validateForm();
    if (error) return alert(error);

    document.getElementById('loader').classList.remove('d-none');

    try {
        const formData = getFormData();
        if (!currentReportId) {
            const docRef = await db.collection('reports').add(formData);
            currentReportId = docRef.id;
        } else {
            await db.collection('reports').doc(currentReportId).update(formData);
        }
        
        // --- 🚀 CHANGE: FILENAME FORMAT (09 Feb_2026_Prasang_Location) ---
        const d = new Date(formData.date);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = d.toLocaleString('en-US', { month: 'short' });
        const yearStr = d.getFullYear();
        const fname = `${dayStr} ${monthStr}_${yearStr}_${formData.occasion}_${formData.location}`;

        if (type === 'pdf') await handlePDF(formData, fname, action);
        else handleWord(formData, fname, action);
        
        if (action === 'download') alert("Saved & Downloaded! 🎉");
        
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        setTimeout(() => document.getElementById('loader').classList.add('d-none'), 1000);
    }
};

window.updateDataOnly = async function() {
    if (!currentReportId) return alert("No Report Selected!");
    
    // 🛑 VALIDATION CHECK HERE TOO
    const error = validateForm();
    if (error) return alert(error);

    document.getElementById('loader').classList.remove('d-none');
    try {
        const formData = getFormData();
        await db.collection('reports').doc(currentReportId).update(formData);
        alert("Data Updated! ✅");
        showHistory();
    } catch(e) {
        alert("Error: " + e.message);
    } finally {
        document.getElementById('loader').classList.add('d-none');
    }
};

function getFormData() {
    return {
        date: document.getElementById('date').value,
        day: document.getElementById('day').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        grade: document.querySelector('input[name="grade"]:checked').value,
        occasion: document.getElementById('occasion').value,
        location: document.getElementById('location').value,
        divyavani: document.getElementById('divyavani').value,
        subject: document.getElementById('subject').value,
        htmlBody: quill.root.innerHTML,
        categories: getCats(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function getCats() {
    let res = {};
    document.querySelectorAll('input[id^="main_"]:checked').forEach(mainBox => {
        const originalName = mainBox.value;
        const safeId = originalName.replace(/\s+/g, '_');
        const subCheckboxes = document.querySelectorAll(`.sub-cat-${safeId}:checked`);
        let selectedSubs = [];
        if (subCheckboxes.length > 0) {
            subCheckboxes.forEach(sub => selectedSubs.push(sub.value));
        } else {
            selectedSubs = categoriesData[originalName];
        }
        res[originalName] = selectedSubs;
    });
    return res;
}

window.showHistory = async function() {
    document.getElementById('dashboardView').classList.add('d-none');
    document.getElementById('formView').classList.add('d-none');
    document.getElementById('historyView').classList.remove('d-none');
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div><p class="text-muted mt-2">Loading...</p></div>';

    try {
        const snap = await db.collection('reports').orderBy('timestamp', 'desc').limit(50).get();
        if (snap.empty) {
            list.innerHTML = '<p class="text-center text-muted">No reports found.</p>';
            allReports = [];
            return;
        }
        allReports = [];
        snap.forEach(doc => {
            allReports.push({ id: doc.id, ...doc.data() });
        });
        renderHistory(allReports);
    } catch (e) {
        list.innerHTML = `<p class="text-danger text-center">Error: ${e.message}</p>`;
    }
};

function renderHistory(reports) {
    const list = document.getElementById('historyList');
    if (reports.length === 0) {
        list.innerHTML = '<p class="text-center text-muted mt-4">No results.</p>';
        return;
    }

    let html = '';
    reports.forEach(r => {
        const dateObj = new Date(r.date);
        const dateDisplay = `${String(dateObj.getDate()).padStart(2,'0')}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${dateObj.getFullYear()}`;
        
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

function normalizeText(text) {
    if (!text) return "";
    text = text.toLowerCase();
    const map = { 'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh', 'ચ': 'ch', 'છ': 'chh', 'જ': 'j', 'ઝ': 'z', 'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh', 'ણ': 'n', 'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n', 'પ': 'p', 'ફ': 'f', 'બ': 'b', 'ભ': 'bh', 'મ': 'm', 'ય': 'y', 'ર': 'r', 'લ': 'l', 'વ': 'v', 'શ': 'sh', 'ષ': 'sh', 'સ': 's', 'હ': 'h', 'ળ': 'l', 'ક્ષ': 'x', 'જ્ઞ': 'gn', 'ા': 'a', 'િ': 'i', 'ી': 'ee', 'ુ': 'u', 'ૂ': 'oo', 'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au', 'ં': 'n', 'ઃ': 'h' };
    let englishStr = "";
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        englishStr += map[char] || char; 
    }
    return englishStr.replace(/[aeiou]/g, ''); 
}

window.filterReports = function() {
    const fDate = document.getElementById('filterDate').value;
    const fOccasionRaw = document.getElementById('filterOccasion').value.toLowerCase();
    const fLocationRaw = document.getElementById('filterLocation').value.toLowerCase();
    const fOccasionSmart = normalizeText(fOccasionRaw);
    const fLocationSmart = normalizeText(fLocationRaw);

    const filtered = allReports.filter(r => {
        const dateMatch = fDate ? r.date === fDate : true;
        const rOccasion = (r.occasion || "").toLowerCase();
        const occasionMatch = rOccasion.includes(fOccasionRaw) || normalizeText(rOccasion).includes(fOccasionSmart);
        const rLocation = (r.location || "").toLowerCase();
        const locationMatch = rLocation.includes(fLocationRaw) || normalizeText(rLocation).includes(fLocationSmart);
        return dateMatch && occasionMatch && locationMatch;
    });
    renderHistory(filtered);
};

window.editReport = function(id) {
    const report = allReports.find(r => r.id === id);
    if (!report) return;
    currentReportId = id; 
    document.getElementById('date').value = report.date;
    document.getElementById('day').value = report.day;
    document.getElementById('startTime').value = report.startTime;
    document.getElementById('endTime').value = report.endTime;
    document.getElementById('occasion').value = report.occasion;
    document.getElementById('location').value = report.location;
    document.getElementById('divyavani').value = report.divyavani;
    document.getElementById('subject').value = report.subject;
    const gradeRadio = document.querySelector(`input[name="grade"][value="${report.grade}"]`);
    if(gradeRadio) gradeRadio.checked = true;
    quill.root.innerHTML = report.htmlBody;
    renderCategories();
    setTimeout(() => {
        if(report.categories) {
            for (const [main, subs] of Object.entries(report.categories)) {
                const safeId = main.replace(/\s+/g, '_');
                const mainCheck = document.getElementById(`main_${safeId}`);
                if(mainCheck) {
                    mainCheck.click(); 
                    subs.forEach(sub => {
                        const subChecks = document.querySelectorAll(`.sub-cat-${safeId}`);
                        subChecks.forEach(chk => { if(chk.value === sub) chk.checked = true; });
                    });
                }
            }
        }
    }, 100);
    document.getElementById('historyView').classList.add('d-none');
    document.getElementById('formView').classList.remove('d-none');
    toggleButtons('edit');
    window.scrollTo(0,0);
};

window.deleteReport = async function(id) {
    if(!confirm("Delete?")) return;
    document.getElementById('loader').classList.remove('d-none');
    try {
        await db.collection('reports').doc(id).delete();
        allReports = allReports.filter(r => r.id !== id);
        renderHistory(allReports);
    } catch(e) {
        alert("Error: " + e.message);
    } finally {
        document.getElementById('loader').classList.add('d-none');
    }
};

window.downloadFromHistory = function(id, type, action) {
    const report = allReports.find(r => r.id === id);
    if (!report) return;
    document.getElementById('loader').classList.remove('d-none');
    
    // --- 🚀 CHANGE: FILENAME FORMAT (09 Feb_2026_Prasang_Location) ---
    const d = new Date(report.date);
    const dayStr = String(d.getDate()).padStart(2, '0');
    const monthStr = d.toLocaleString('en-US', { month: 'short' });
    const yearStr = d.getFullYear();
    const fname = `${dayStr} ${monthStr}_${yearStr}_${report.occasion}_${report.location}`;

    if(type === 'pdf') {
        handlePDF(report, fname, action).then(() => document.getElementById('loader').classList.add('d-none'));
    } else {
        handleWord(report, fname, action);
        document.getElementById('loader').classList.add('d-none');
    }
};

// HANDLERS
async function handlePDF(data, fileName, action) {
    const content = getCleanPreviewHTML(data); 
    const opt = { margin: 0.3, filename: fileName + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
    const worker = html2pdf().set(opt).from(content);
    if (action === 'download') await worker.save();
    else if (action === 'share') {
        const pdfBlob = await worker.output('blob');
        await shareFile(pdfBlob, fileName + '.pdf', 'application/pdf');
    }
}

function handleWord(data, fileName, action) {
    const htmlContent = getWordContent(data);
    const converted = htmlDocx.asBlob(htmlContent, {
        orientation: 'portrait',
        margins: { top: 720, bottom: 720, left: 720, right: 720 }
    });
    if (action === 'download') saveAs(converted, fileName + '.docx');
    else if (action === 'share') shareFile(converted, fileName + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

async function shareFile(blob, filename, mimeType) {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'SMVS Report', text: filename });
        } catch (err) { console.log('Share failed:', err); }
    } else {
        alert("Downloading (Share not supported)");
        saveAs(blob, filename);
    }
}

function getCleanPreviewHTML(data) {
    let catHtml = '';
    if(data.categories) for (const [main, subs] of Object.entries(data.categories)) catHtml += `<div style="margin-bottom:2px; font-size:12px;"><b>${main}:</b> ${subs.join(', ')}</div>`;
    
    // --- 🚀 CHANGE: INTERNAL DATE FORMAT DD-MM-YYYY ---
    const dateParts = data.date.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

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
                <tr><td style="width: 50%;"><b>તારીખ:</b> ${formattedDate}</td><td style="width: 50%;"><b>વાર:</b> ${data.day}</td></tr>
                <tr><td><b>સમય:</b> ${data.startTime} થી ${data.endTime}</td><td><b>ગ્રેડ:</b> ${data.grade}</td></tr>
                <tr><td><b>પ્રસંગ:</b> ${data.occasion}</td><td><b>સ્થળ:</b> ${data.location}</td></tr>
                <tr><td colspan="2"><b>દિવ્યવાણી:</b> ${data.divyavani}</td></tr>
                <tr><td colspan="2"><b>સભાનો વિષય:</b><br/>${data.subject}</td></tr>
                <tr><td colspan="2"><b>કેટેગરી:</b><br/>${catHtml}</td></tr>
                <tr><td colspan="2" style="font-weight: bold; background-color: #f0f0f0 !important; color: #000 !important;">કથાવાર્તા અહેવાલ</td></tr>
            </tbody>
        </table>
        <div class="seamless-body">${data.htmlBody}</div>
    </div>`;
}

function getWordContent(data) {
    let catHtml = '';
    if(data.categories) for (const [main, subs] of Object.entries(data.categories)) catHtml += `<p style="margin:0;"><b>${main}:</b> ${subs.join(', ')}</p>`;
    
    // --- 🚀 CHANGE: INTERNAL DATE FORMAT DD-MM-YYYY ---
    const dateParts = data.date.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    return `<!DOCTYPE html><html><head><meta charset='utf-8'><style>body { font-family: Arial, sans-serif; } table { border-collapse: collapse; width: 100%; border: 1px solid black; } td { border: 1px solid black; padding: 5px; vertical-align: top; } h2, p { margin: 0; }</style></head><body><table border="1" cellspacing="0" cellpadding="5" width="100%"><tr><td colspan="2" align="center" style="border-bottom: 2px solid black; padding: 10px;"><h2 style="font-size: 18pt; color:#d35400;">SMVS SAMARPAN KARYALYA</h2><p style="font-size: 10pt;">Video Post Production Data Report</p></td></tr><tr><td width="50%"><b>Date:</b> ${formattedDate}</td><td width="50%"><b>Day:</b> ${data.day}</td></tr><tr><td><b>Time:</b> ${data.startTime} - ${data.endTime}</td><td><b>Grade:</b> ${data.grade}</td></tr><tr><td><b>Occasion:</b> ${data.occasion}</td><td><b>Location:</b> ${data.location}</td></tr><tr><td colspan="2"><b>Divyavani:</b> ${data.divyavani}</td></tr><tr><td colspan="2"><b>Subject:</b><br/>${data.subject}</td></tr><tr><td colspan="2"><b>Categories:</b><br/>${catHtml}</td></tr><tr><td colspan="2" style="background-color:#f0f0f0;"><b>Report Body:</b></td></tr><tr><td colspan="2" style="padding: 10px;">${data.htmlBody}</td></tr></table></body></html>`;
}

window.resetForm = function(force = false) {
    if(force && !confirm("Clear Form?")) return;
    document.getElementById('reportForm').reset();
    quill.setContents([]);
    currentReportId = null;
    initForm();
    renderCategories();
    toggleButtons('create');
    window.scrollTo(0,0);
};

window.showForm = () => { document.getElementById('dashboardView').classList.add('d-none'); document.getElementById('formView').classList.remove('d-none'); toggleButtons('create'); };
window.showDashboard = () => { document.getElementById('formView').classList.add('d-none'); document.getElementById('historyView').classList.add('d-none'); document.getElementById('dashboardView').classList.remove('d-none'); };