// ============================================
// SMVS Report Portal — Firebase Production App
// Powered by Firestore Database & Custom User Management
// ============================================

// --- 1. FIREBASE CONFIG & INITIALIZATION ---
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

// --- 1.1 INTEGRATIONS CONFIG (Option B: Apps Script + EmailJS) ---
const APPS_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzdtJC9HbIKwYoyv3WsQkQojMHJI_ya3K46BvEmGagyGNBrp0TuvoxQZaIm47cuSlk/exec";
const APPS_SCRIPT_TOKEN = "Smvs@2026#SheetSync!";

const EMAILJS_PUBLIC_KEY = "RCTkUbi6HqVHM_A9s";
const EMAILJS_SERVICE_ID = "service_4zt00gn";
const EMAILJS_TEMPLATE_ID = "template_euujipn";
const EMAILJS_TO_EMAIL = "Jakasaniyaparthiv@gmail.com";
const APP_DOWNLOAD_BASE_URL = window.location.origin;

function initEmailJsIfConfigured() {
    try {
        if (window.emailjs && EMAILJS_PUBLIC_KEY) {
            emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        }
    } catch (_) {}
}

// --- 2. GLOBAL STATE & STATIC SEED DATA ---
let quill;
let currentReportId = null;
let allReports = [];
let currentUser = null;
let locationTree = [];
let categoriesData = {};
let previewModal = null;
let currentAdminTab = "locations";

let adminSelectedCountryId = null;
let adminSelectedZoneId = null;
let adminSelectedCategoryId = null;
let adminEditModalInstance = null;

// Initial static seed for locations (Country -> Zones -> Centers)
const defaultLocationTree = [
    {
        id: 100001,
        name: "India",
        code: "IN",
        zones: [
            { id: 200001, name: "Ahmedabad East", centers: [{ id: 300001, name: "Ghanshyamnagar" }, { id: 300002, name: "Isanpur" }, { id: 300003, name: "Naroda" }, { id: 300004, name: "Nikol" }, { id: 300005, name: "Vastral" }] },
            { id: 200002, name: "Ahmedabad West", centers: [{ id: 300006, name: "Bavla" }, { id: 300007, name: "Ghatlodiya" }, { id: 300008, name: "Gota" }, { id: 300009, name: "Sanand" }, { id: 300010, name: "Satellite" }, { id: 300011, name: "Vasna" }] },
            { id: 200003, name: "Anand", centers: [{ id: 300012, name: "Anand" }] },
            { id: 200004, name: "Bhavnagar", centers: [{ id: 300013, name: "Bhavnagar" }, { id: 300014, name: "Una" }] },
            { id: 200005, name: "Gandhinagar", centers: [{ id: 300015, name: "Chandkheda" }, { id: 300016, name: "Gandhinagar" }, { id: 300017, name: "Kalol" }, { id: 300018, name: "Swaminarayan Dham" }, { id: 300019, name: "Vijapur" }] },
            { id: 200006, name: "Godhar", centers: [{ id: 300020, name: "Godhar" }, { id: 300021, name: "Santrampur" }, { id: 300022, name: "Virpur" }] },
            { id: 200007, name: "Godhara", centers: [{ id: 300023, name: "Chhodaudepur" }, { id: 300024, name: "Dahod" }, { id: 300025, name: "Godhra" }, { id: 300026, name: "Zalod" }] },
            { id: 200008, name: "Himmatnagar", centers: [{ id: 300027, name: "Bayad" }, { id: 300028, name: "Himmatnagar" }, { id: 300029, name: "Malpur" }, { id: 300030, name: "Modasa" }] },
            { id: 200009, name: "Maharastra", centers: [{ id: 300031, name: "Kandivali" }, { id: 300032, name: "Navi Mumbai" }, { id: 300033, name: "Pune" }] },
            { id: 200010, name: "Mahesana", centers: [{ id: 300034, name: "Kadi" }, { id: 300035, name: "Mehsana" }, { id: 300036, name: "Palanpur" }, { id: 300037, name: "Patan" }, { id: 300038, name: "Unjha" }, { id: 300039, name: "Visnagar" }] },
            { id: 200011, name: "Morbi", centers: [{ id: 300040, name: "Bhuj" }, { id: 300041, name: "Morbi" }] },
            { id: 200012, name: "Rajkot", centers: [{ id: 300042, name: "Junagadh" }, { id: 300043, name: "Rajkot" }] },
            { id: 200013, name: "Surat", centers: [{ id: 300044, name: "Ankleshwar" }, { id: 300045, name: "Bharuch" }, { id: 300046, name: "Dabholi" }, { id: 300047, name: "Varachha" }] },
            { id: 200014, name: "Surendranagar", centers: [{ id: 300048, name: "Surendranagar" }, { id: 300049, name: "Viramgam" }] },
            { id: 200015, name: "Vadodara", centers: [{ id: 300050, name: "Halol" }, { id: 300051, name: "Vadodara" }, { id: 300052, name: "Waghodiya" }] }
        ]
    }
];

// Initial static seed for categories
const defaultCategoriesData = {
    "SK": ["સંત સભા", "સંત શિબિર", "STK સભા", "STK શિબિર", "SKS", "છાત્રાલય", "SBS"],
    "AP": ["Pre-AYP", "AYP", "પ્રી-મુમુક્ષુ", "ABS", "AVP"],
    "Prakashan": ["ગુરુકુળ", "પ્રકાશન", "ચેનલ", "વેબસાઇટ", "સોશિયલ મીડિયા", "DC (SC...)", "પુસ્તક", "ક્લીપ", "Store"],
    "Satsang Samaj": ["બાળકો", "કિશોરો", "યુવકો", "વડીલો", "અંગત સભા", "અંગત શિબિર", "પ્રાતઃસભા", "VCD સભા", "ઉત્સવ"],
    "Talim": ["પૂ.સંતો", "સ્ટાફ (તાલીમ)", "અગ્રેસર (તાલીમ)", "સંચાલક (તાલીમ)", "કાર્યકર (તાલીમ)"],
    "Sevabhavi": ["સંચાલક (સેવાભાવી)", "કાર્યકર (સેવાભાવી)", "અગ્રેસર (સેવાભાવી)", "સ્ટાફ (સેવાભાવી)", "BN"]
};

// --- 3. FIRESTORE SEED & LOAD FUNCTIONS ---
async function seedDefaultUsersIfNeeded() {
    try {
        const pskQuery = await db.collection("users").where("username", "==", "psk.assist@in.smvs.org").get();
        if (pskQuery.empty) {
            console.log("Seeding initial PSK Admin user to Firestore...");
            await db.collection("users").add({
                username: "psk.assist@in.smvs.org",
                email: "psk.assist@in.smvs.org",
                displayName: "PSK",
                role: "admin",
                password: "psk@2026",
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        const adminQuery = await db.collection("users").where("username", "==", "admin@smvs.org").get();
        if (adminQuery.empty) {
            await db.collection("users").add({
                username: "admin@smvs.org",
                email: "admin@smvs.org",
                displayName: "SMVS Administrator",
                role: "admin",
                password: "Admin@2026",
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (e) {
        console.warn("User seeding note:", e);
    }
}

async function loadLocationsTree() {
    try {
        const doc = await db.collection("locations_master").doc("tree").get();
        if (doc.exists && doc.data()?.tree?.length > 0) {
            locationTree = doc.data().tree;
        } else {
            console.log("Seeding default locations to Firestore...");
            await db.collection("locations_master").doc("tree").set({ tree: defaultLocationTree });
            locationTree = JSON.parse(JSON.stringify(defaultLocationTree));
        }
    } catch (err) {
        console.warn("Falling back to local static locations:", err);
        locationTree = JSON.parse(JSON.stringify(defaultLocationTree));
    }
    populateCountryDropdown();
}

async function loadCategories() {
    try {
        const doc = await db.collection("categories_master").doc("data").get();
        if (doc.exists && doc.data()?.categories) {
            categoriesData = doc.data().categories;
        } else {
            console.log("Seeding default categories to Firestore...");
            await db.collection("categories_master").doc("data").set({ categories: defaultCategoriesData });
            categoriesData = JSON.parse(JSON.stringify(defaultCategoriesData));
        }
    } catch (err) {
        console.warn("Falling back to local categories:", err);
        categoriesData = JSON.parse(JSON.stringify(defaultCategoriesData));
    }
    renderCategories();
}

async function saveLocationsTreeToFirestore() {
    try {
        await db.collection("locations_master").doc("tree").set({ tree: locationTree, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
        console.error("Error saving location tree:", e);
    }
}

async function saveCategoriesToFirestore() {
    try {
        await db.collection("categories_master").doc("data").set({ categories: categoriesData, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
        console.error("Error saving categories:", e);
    }
}

// --- 4. AUTHENTICATION VIA FIRESTORE 'users' COLLECTION ---
window.handleLogin = async function(e) {
    if (e) e.preventDefault();
    const userInput = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const loginBtn = document.getElementById("loginBtn");
    const errorDiv = document.getElementById("loginError");

    errorDiv.classList.add("d-none");
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

    try {
        console.log("Checking credentials in Firestore users collection for:", userInput);
        
        // Ensure initial user exists
        await seedDefaultUsersIfNeeded();

        // Check by username OR email
        let userDoc = null;
        let userData = null;

        const snap1 = await db.collection("users").where("username", "==", userInput).get();
        if (!snap1.empty) {
            userDoc = snap1.docs[0];
            userData = userDoc.data();
        } else {
            const snap2 = await db.collection("users").where("email", "==", userInput).get();
            if (!snap2.empty) {
                userDoc = snap2.docs[0];
                userData = userDoc.data();
            } else {
                // Case-insensitive fallback
                const allUsersSnap = await db.collection("users").get();
                allUsersSnap.forEach(doc => {
                    const d = doc.data();
                    if ((d.username && d.username.toLowerCase() === userInput.toLowerCase()) || 
                        (d.email && d.email.toLowerCase() === userInput.toLowerCase())) {
                        userDoc = doc;
                        userData = d;
                    }
                });
            }
        }

        if (!userData) {
            throw new Error("Username અથવા Email મળ્યો નથી! (User Not Found)");
        }

        if (userData.isActive === false) {
            throw new Error("આ એકાઉન્ટ સસ્પેન્ડ/ઇનએક્ટિવ છે. એડમિનનો સંપર્ક કરો.");
        }

        if (userData.password !== password) {
            throw new Error("પાસવર્ડ ખોટો છે! (Incorrect Password)");
        }

        currentUser = {
            id: userDoc.id,
            uid: userDoc.id,
            username: userData.username,
            email: userData.email || userData.username,
            displayName: userData.displayName || userData.fullName || userData.username,
            role: (userData.role || "user").toLowerCase()
        };

        // Save session in localStorage
        localStorage.setItem("smvs_active_user", JSON.stringify(currentUser));
        console.log("Login Success! Logged in as:", currentUser.displayName, "(" + currentUser.role + ")");

        onLoginSuccess();
    } catch (err) {
        console.error("Login failed:", err);
        errorDiv.textContent = err.message || "Invalid Username or Password!";
        errorDiv.classList.remove("d-none");
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-2"></i>Login Access';
    }
    return false;
};

window.logoutUser = function() {
    if (!confirm("Are you sure you want to Logout?")) return;
    localStorage.removeItem("smvs_active_user");
    currentUser = null;
    showLoginView();
};

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
    const drawerBadge = document.getElementById("drawerUserBadge");
    const adminDrawerBtn = document.getElementById("adminDrawerBtn");
    const adminNavBtn = document.getElementById("adminNavBtn");

    const badgeText = `${currentUser.displayName || currentUser.username} (${currentUser.role.toUpperCase()})`;
    if (badge) badge.textContent = badgeText;
    if (drawerBadge) drawerBadge.textContent = badgeText;

    if (currentUser.role === "admin") {
        if (adminNavBtn) adminNavBtn.classList.remove("d-none");
        if (adminDrawerBtn) {
            adminDrawerBtn.classList.remove("d-none");
            adminDrawerBtn.classList.add("d-flex");
        }
    } else {
        if (adminNavBtn) adminNavBtn.classList.add("d-none");
        if (adminDrawerBtn) {
            adminDrawerBtn.classList.add("d-none");
            adminDrawerBtn.classList.remove("d-flex");
        }
    }

    showLoader("LOADING PORTAL...");
    try {
        await Promise.all([loadLocationsTree(), loadCategories(), fetchReports()]);
    } finally {
        hideLoader();
    }

    showDashboard();

    // Auto-resume draft if any exists
    setTimeout(() => {
        const hasDraft = loadDraftIfAny();
        if (hasDraft) {
            document.getElementById("dashboardView").classList.add("d-none");
            document.getElementById("formView").classList.remove("d-none");
            toggleButtons("create");
            currentReportId = null;
        }
    }, 100);
}

// Auto-restore session from localStorage on startup
function checkSavedSession() {
    try {
        const saved = localStorage.getItem("smvs_active_user");
        if (saved) {
            currentUser = JSON.parse(saved);
            if (currentUser && currentUser.username) {
                onLoginSuccess();
                return;
            }
        }
    } catch (e) {}
    showLoginView();
}

// --- 5. LOCATION DROPDOWNS (3-TIER: COUNTRY -> ZONE -> CENTER) ---
function populateCountryDropdown() {
    const cSelect = document.getElementById("countrySelect");
    const fCountry = document.getElementById("filterCountry");

    if (cSelect) {
        cSelect.innerHTML = '<option value="" disabled selected>Select Country</option>';
        locationTree.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            cSelect.appendChild(opt);
        });
        if (locationTree.length > 0) {
            cSelect.value = locationTree[0].id;
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

window.handleCountryChange = function() {
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
};

window.handleZoneChange = function() {
    const cSelect = document.getElementById("countrySelect");
    const zSelect = document.getElementById("zoneSelect");
    const cntSelect = document.getElementById("centerSelect");

    const countryId = parseInt(cSelect.value);
    const zoneId = parseInt(zSelect.value);

    const country = locationTree.find(c => c.id === countryId);
    const zone = country?.zones?.find(z => z.id === zoneId);

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
};

window.handleCenterChange = function() {
    const cntSelect = document.getElementById("centerSelect");
    const locInput = document.getElementById("location");
    const selectedText = cntSelect.options[cntSelect.selectedIndex]?.textContent;

    if (selectedText && selectedText !== "Select Center") {
        locInput.value = selectedText;
    }
    scheduleDraftSave();
};

window.handleFilterCountryChange = function() {
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
};

window.handleFilterZoneChange = function() {
    const fCountry = document.getElementById("filterCountry");
    const fZone = document.getElementById("filterZone");
    const fCenter = document.getElementById("filterCenter");

    const countryId = parseInt(fCountry.value);
    const zoneId = parseInt(fZone.value);

    const country = locationTree.find(c => c.id === countryId);
    const zone = country?.zones?.find(z => z.id === zoneId);

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
};

// --- 6. CATEGORIES RENDERER ---
function renderCategories() {
    const container = document.getElementById("categoriesContainer");
    if (!container) return;
    container.innerHTML = "";

    for (const [main, subs] of Object.entries(categoriesData)) {
        const safeId = main.replace(/\s+/g, "_");
        const card = document.createElement("div");
        card.className = "category-group-card p-3 mb-2";
        card.innerHTML = `
            <div class="form-check">
                <input class="form-check-input main-cat-check" type="checkbox" id="main_${safeId}" value="${main}">
                <label class="form-check-label fw-bold text-primary cursor-pointer" for="main_${safeId}">${main}</label>
            </div>
            <div class="sub-categories mt-2 ps-3 d-none" id="subs_${safeId}">
                ${subs.map(sub => `
                    <div class="form-check mb-1">
                        <input class="form-check-input sub-cat-check sub-cat-${safeId}" type="checkbox" id="sub_${safeId}_${sub.replace(/\s+/g, "_")}" value="${sub}">
                        <label class="form-check-label text-muted small cursor-pointer" for="sub_${safeId}_${sub.replace(/\s+/g, "_")}">${sub}</label>
                    </div>
                `).join("")}
            </div>
        `;
        container.appendChild(card);

        const mainCheck = card.querySelector(`#main_${safeId}`);
        const subsDiv = card.querySelector(`#subs_${safeId}`);

        mainCheck.addEventListener("change", (e) => {
            if (e.target.checked) {
                subsDiv.classList.remove("d-none");
            } else {
                subsDiv.classList.add("d-none");
                subsDiv.querySelectorAll(".sub-cat-check").forEach(chk => (chk.checked = false));
            }
            scheduleDraftSave();
        });

        subsDiv.querySelectorAll(".sub-cat-check").forEach(chk => {
            chk.addEventListener("change", scheduleDraftSave);
        });
    }
}

function getSelectedCategories() {
    const selected = {};
    for (const main of Object.keys(categoriesData)) {
        const safeId = main.replace(/\s+/g, "_");
        const mainCheck = document.getElementById(`main_${safeId}`);
        if (mainCheck && mainCheck.checked) {
            selected[main] = [];
            const subChecks = document.querySelectorAll(`.sub-cat-${safeId}:checked`);
            subChecks.forEach(chk => selected[main].push(chk.value));
        }
    }
    return selected;
}

// --- 7. REPORT FORM HELPERS & DRAFT ---
window.updateDay = function() {
    const dateInput = document.getElementById("date");
    const dayInput = document.getElementById("day");
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
};

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

let draftTimer = null;
function scheduleDraftSave() {
    if (!currentUser || currentReportId) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
        try {
            const data = getFormData();
            localStorage.setItem(`smvs_report_draft:${currentUser.username}`, JSON.stringify({
                savedAt: new Date().toISOString(),
                data
            }));
        } catch (e) {}
    }, 800);
}

function clearDraft() {
    if (!currentUser) return;
    localStorage.removeItem(`smvs_report_draft:${currentUser.username}`);
}

function loadDraftIfAny() {
    if (!currentUser || currentReportId) return false;
    const raw = localStorage.getItem(`smvs_report_draft:${currentUser.username}`);
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
                subChecks.forEach(chk => {
                    chk.checked = Array.isArray(subs) ? subs.includes(chk.value) : false;
                });
            }
        }
    }, 80);

    updateDay();
}

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

// --- 8. CREATE, UPDATE & SYNC IN FIRESTORE ---
async function saveAndGenerate(type, action) {
    const errMsg = validateForm();
    if (errMsg) {
        alert(errMsg);
        return;
    }

    showLoader("SAVING REPORT TO FIRESTORE...");
    const data = getFormData();

    try {
        let reportId = currentReportId;
        const isNew = !reportId;

        const payload = {
            ...data,
            authorUsername: currentUser.username,
            authorDisplayName: currentUser.displayName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (isNew) {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection("reports").add(payload);
            reportId = docRef.id;
            clearDraft();
        } else {
            await db.collection("reports").doc(reportId).set(payload, { merge: true });
        }

        const d = new Date(data.date);
        const dayStr = String(d.getDate()).padStart(2, "0");
        const monthStr = d.toLocaleString("en-US", { month: "short" });
        const yearStr = d.getFullYear();
        const fname = `${dayStr} ${monthStr}_${yearStr}_${data.occasion}_${data.location}`;

        if (type === "pdf") {
            await generatePDFDocument(data, fname, action);
        } else {
            generateWordDocument(data, fname, action);
        }

        // Background sync to Google Sheet
        syncToGoogleSheet(reportId, data).catch(console.warn);

        // First-time creation email
        if (isNew) {
            sendEmailNotification(reportId, data).catch(console.warn);
        }

        await fetchReports();
        alert("Report Saved Successfully! 🎉");
        showDashboard();
    } catch (e) {
        alert("Error saving report: " + e.message);
    } finally {
        hideLoader();
    }
}

window.handlePDF = function(action) {
    return saveAndGenerate("pdf", action);
};

window.handleWord = function(action) {
    return saveAndGenerate("word", action);
};

window.updateReportData = async function() {
    const errMsg = validateForm();
    if (errMsg) {
        alert(errMsg);
        return;
    }
    if (!currentReportId) return;

    showLoader("UPDATING REPORT...");
    const data = getFormData();
    try {
        await db.collection("reports").doc(currentReportId).set({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        syncToGoogleSheet(currentReportId, data).catch(console.warn);
        await fetchReports();
        alert("Report Updated Successfully! 🎉");
        showDashboard();
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        hideLoader();
    }
};

// --- 9. APPS SCRIPT & EMAIL NOTIFICATIONS ---
async function syncToGoogleSheet(reportId, data) {
    if (!APPS_SCRIPT_WEBAPP_URL) return;
    try {
        let cats = data.categories || {};
        if (typeof cats === "string") {
            try { cats = JSON.parse(cats); } catch(e) { cats = {}; }
        }
        const catParts = [];
        for (const [k, v] of Object.entries(cats)) {
            const subStr = Array.isArray(v) ? v.join(", ") : String(v || "");
            if (subStr) catParts.push(`${k}: ${subStr}`);
            else catParts.push(k);
        }
        const catText = catParts.join(" | ") || "-";

        let plainBody = "";
        if (data.htmlBody) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = data.htmlBody;
            plainBody = (tempDiv.innerText || tempDiv.textContent || "").trim();
        }

        await fetch(APPS_SCRIPT_WEBAPP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token: APPS_SCRIPT_TOKEN,
                reportId,
                date: data.date,
                day: data.day,
                time: `${data.startTime} - ${data.endTime}`,
                grade: data.grade,
                occasion: data.occasion,
                country: data.countryName || "",
                zone: data.zone || "",
                center: data.center || "",
                location: data.location,
                divyavani: data.divyavani,
                subject: data.subject,
                category: catText,
                categories: catText,
                reportNarrative: plainBody,
                body: plainBody
            })
        });
    } catch (e) {
        console.warn("Sheet sync error:", e);
    }
}

async function sendEmailNotification(reportId, data) {
    if (!window.emailjs || !EMAILJS_PUBLIC_KEY) return;
    try {
        const downloadUrl = `${APP_DOWNLOAD_BASE_URL}/report.html?id=${reportId}`;
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: EMAILJS_TO_EMAIL,
            report_id: reportId,
            date: data.date,
            location: data.location,
            subject: data.subject,
            download_url: downloadUrl
        });
    } catch (e) {
        console.warn("Email error:", e);
    }
}

// --- 10. PDF & WORD GENERATORS (WORD-MATCHING PDF FORMAT) ---
function getCleanPreviewHTML(data, isForDownload = false) {
    if (!data) return "";

    const dateParts = String(data.date || "").split("-");
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : (data.date || "");

    const startTime = data.startTime || data.start_time || "";
    const endTime = data.endTime || data.end_time || "";
    const htmlBody = data.htmlBody || data.html_body || "";
    const subject = data.subject || "";
    const occasion = data.occasion || "";
    const location = data.location || "";
    const day = data.day || "";
    const grade = data.grade || "A";
    const divyavani = data.divyavani || "વ્હાલા ગુરુજી";

    let cats = data.categories || {};
    if (typeof cats === "string") {
        try { cats = JSON.parse(cats); } catch(e) { cats = {}; }
    }
    if (data.categories_json && typeof data.categories_json === "string") {
        try { cats = JSON.parse(data.categories_json); } catch(e) {}
    }

    let catHtml = "";
    if (cats && typeof cats === "object") {
        for (const [main, subs] of Object.entries(cats)) {
            const subList = Array.isArray(subs) ? subs.join(", ") : (subs || "");
            if (subList) {
                catHtml += `<div style="margin: 1px 0; font-size: 10pt;"><b>${main}:</b> ${subList}</div>`;
            }
        }
    }
    if (!catHtml) catHtml = '<div style="margin: 1px 0; font-size: 10pt;">-</div>';

    return `
    <div id="pdfRenderRoot" style="font-family: 'Hind Vadodara', Arial, sans-serif; font-weight: 500; padding: 0; margin: 0 auto; color: #000000 !important; background: #ffffff !important; font-size: 10.5pt; width: 680px; box-sizing: border-box;">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700&display=swap');
            #pdfRenderRoot, #pdfRenderRoot * {
                font-family: 'Hind Vadodara', Arial, sans-serif !important;
                box-sizing: border-box !important;
                color: #000000 !important;
            }
            #pdfRenderRoot b, #pdfRenderRoot strong { font-weight: 700 !important; }
            .hdr-table {
                width: 100% !important;
                border-collapse: collapse !important;
                border: 1.5px solid #000000 !important;
                margin: 0 !important;
                box-sizing: border-box !important;
            }
            .hdr-table td {
                border: 1px solid #000000 !important;
                padding: 4px 7px !important;
                vertical-align: top !important;
                font-size: 10.5pt !important;
                font-weight: 500 !important;
                line-height: 1.4 !important;
                box-sizing: border-box !important;
            }
            .hdr-title {
                text-align: center !important;
                padding: 8px 7px !important;
                border-bottom: 1.5px solid #000000 !important;
            }
            .section-bar {
                width: 100% !important;
                background: #f0f0f0 !important;
                font-weight: 700 !important;
                font-size: 10.5pt !important;
                padding: 5px 8px !important;
                border-left: 1.5px solid #000000 !important;
                border-right: 1.5px solid #000000 !important;
                border-top: none !important;
                border-bottom: 1px solid #000000 !important;
                box-sizing: border-box !important;
                margin: 0 !important;
            }
            .body-content {
                width: 100% !important;
                border-left: 1.5px solid #000000 !important;
                border-right: 1.5px solid #000000 !important;
                border-bottom: 1.5px solid #000000 !important;
                border-top: none !important;
                padding: 8px 10px !important;
                text-align: justify !important;
                line-height: 1.55 !important;
                font-size: 10.5pt !important;
                font-weight: 500 !important;
                box-sizing: border-box !important;
                margin: 0 !important;
                min-height: 30px;
            }
            .body-content ul, .body-content ol {
                padding-left: 20px !important;
                margin: 3px 0 6px 0 !important;
            }
            .body-content li {
                margin-bottom: 2px !important;
                line-height: 1.5 !important;
            }
            .body-content p {
                margin: 2px 0 !important;
            }
        </style>

        <!-- HEADER TABLE -->
        <table class="hdr-table">
            <tr>
                <td colspan="2" class="hdr-title">
                    <div style="font-size: 15pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin: 0;">SMVS SAMARPAN KARYALYA</div>
                    <div style="font-size: 9pt; font-weight: 500; margin: 2px 0 0 0;">Video Post Production Data Report</div>
                </td>
            </tr>
            <tr>
                <td style="width: 50%;"><b>તારીખ:</b> ${formattedDate}</td>
                <td style="width: 50%;"><b>વાર:</b> ${day}</td>
            </tr>
            <tr>
                <td><b>સમય:</b> ${startTime} થી ${endTime}</td>
                <td><b>ગ્રેડ:</b> ${grade}</td>
            </tr>
            <tr>
                <td><b>પ્રસંગ:</b> ${occasion}</td>
                <td><b>સ્થળ:</b> ${location}</td>
            </tr>
            <tr>
                <td colspan="2"><b>દિવ્યવાણી:</b> ${divyavani}</td>
            </tr>
            <tr>
                <td colspan="2"><b>સભાનો વિષય:</b> ${subject || "-"}</td>
            </tr>
            <tr>
                <td colspan="2"><b>કેટેગરી:</b><br/>${catHtml}</td>
            </tr>
        </table>

        <!-- SECTION BAR -->
        <div class="section-bar">કથાવાર્તા અહેવાલ</div>

        <!-- BODY CONTENT -->
        <div class="body-content">${htmlBody || "<p>-</p>"}</div>
    </div>`;
}

async function generatePDFDocument(data, fileName, action = "download") {
    const content = getCleanPreviewHTML(data, true);

    const opt = {
        margin: [10, 10, 10, 10], // 10mm margin on all 4 sides
        filename: fileName + ".pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            scrollY: 0,
            logging: false,
            letterRendering: true
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
    };

    const worker = html2pdf().set(opt).from(content);
    if (action === "download") {
        await worker.save();
    } else if (action === "share") {
        const pdfBlob = await worker.output("blob");
        await shareFile(pdfBlob, fileName + ".pdf", "application/pdf");
    }
}

function getWordContent(data) {
    let catHtml = "";
    if (data.categories) {
        for (const [main, subs] of Object.entries(data.categories)) {
            const subText = Array.isArray(subs) ? subs.join(", ") : (subs || "");
            if (subText) {
                catHtml += `<p style="margin: 0; font-family: 'Hind Vadodara', Arial, sans-serif; font-weight: 500;"><b>${main}:</b> ${subText}</p>`;
            }
        }
    }
    const dateParts = String(data.date || "").split("-");
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : (data.date || "");

    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700&display=swap');
            body { font-family: 'Hind Vadodara', Arial, sans-serif; font-weight: 500; font-size: 11pt; color: #000; }
            table { border-collapse: collapse; width: 100%; border: 1.5px solid black; }
            td { border: 1px solid black; padding: 5px; vertical-align: top; font-family: 'Hind Vadodara', Arial, sans-serif; font-weight: 500; }
            h2 { margin: 0; font-weight: 700; font-family: 'Hind Vadodara', Arial, sans-serif; }
            p { margin: 0; font-family: 'Hind Vadodara', Arial, sans-serif; font-weight: 500; }
            ul, ol { margin: 4px 0; padding-left: 20px; }
            li { margin-bottom: 2px; font-family: 'Hind Vadodara', Arial, sans-serif; font-weight: 500; }
        </style>
    </head>
    <body>
        <table border="1" cellspacing="0" cellpadding="5" width="100%">
            <tr>
                <td colspan="2" align="center" style="border-bottom: 2px solid black; padding: 10px;">
                    <h2 style="font-size: 18pt; color: #000000; text-transform: uppercase;">SMVS SAMARPAN KARYALYA</h2>
                    <p style="font-size: 10pt;">Video Post Production Data Report</p>
                </td>
            </tr>
            <tr>
                <td width="50%"><b>Date:</b> ${formattedDate}</td>
                <td width="50%"><b>Day:</b> ${data.day || ""}</td>
            </tr>
            <tr>
                <td><b>Time:</b> ${data.startTime || ""} - ${data.endTime || ""}</td>
                <td><b>Grade:</b> ${data.grade || ""}</td>
            </tr>
            <tr>
                <td><b>Occasion:</b> ${data.occasion || ""}</td>
                <td><b>Location:</b> ${data.location || ""}</td>
            </tr>
            <tr>
                <td colspan="2"><b>Divyavani:</b> ${data.divyavani || ""}</td>
            </tr>
            <tr>
                <td colspan="2"><b>Subject:</b><br/>${data.subject || ""}</td>
            </tr>
            <tr>
                <td colspan="2"><b>Categories:</b><br/>${catHtml || "-"}</td>
            </tr>
            <tr>
                <td colspan="2" style="background-color: #f0f0f0; font-weight: bold;"><b>Report Body:</b></td>
            </tr>
            <tr>
                <td colspan="2" style="padding: 10px; font-family: 'Hind Vadodara', Arial, sans-serif; font-weight: 500;">
                    ${data.htmlBody || ""}
                </td>
            </tr>
        </table>
    </body>
    </html>`;
}

function generateWordDocument(data, fileName, action = "download") {
    const htmlContent = getWordContent(data);
    const converted = htmlDocx.asBlob(htmlContent, {
        orientation: "portrait",
        margins: { top: 720, bottom: 720, left: 720, right: 720 }
    });
    if (action === "download") {
        saveAs(converted, fileName + ".docx");
    } else if (action === "share") {
        shareFile(converted, fileName + ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }
}

async function shareFile(blob, filename, mimeType) {
    try {
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "SMVS Sabha Report",
                    text: filename
                });
                return;
            } catch (err) {
                if (err.name === "AbortError") return; // User dismissed share sheet
                console.warn("Native share error, falling back to download:", err);
            }
        }

        // Fallback for browsers without file sharing (e.g. desktop)
        if (typeof saveAs === "function") {
            saveAs(blob, filename);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    } catch (e) {
        console.warn("Share fallback error:", e);
        if (typeof saveAs === "function") {
            saveAs(blob, filename);
        }
    }
}

window.handlePDF = function(action) {
    return saveAndGenerate("pdf", action);
};

window.handleWord = function(action) {
    return saveAndGenerate("word", action);
};


window.previewReport = function(source, id = null) {
    let data;
    if (source === "form") {
        data = getFormData();
    } else {
        data = allReports.find(r => String(r.id) === String(id));
    }
    if (!data) return;
    document.getElementById("previewContent").innerHTML = getCleanPreviewHTML(data, false);
    if (!previewModal) {
        previewModal = new bootstrap.Modal(document.getElementById("previewModal"));
    }
    previewModal.show();
};

window.handlePreview = function() {
    previewReport("form");
};

// --- 12. HISTORY VIEW & FILTERING ---
window.showHistory = function() {
    document.getElementById("dashboardView").classList.add("d-none");
    document.getElementById("formView").classList.add("d-none");
    document.getElementById("adminView").classList.add("d-none");
    document.getElementById("historyView").classList.remove("d-none");
    renderHistory(allReports);
};

async function fetchReports(force = false) {
    try {
        const snap = await db.collection("reports").get();
        allReports = [];
        snap.forEach(doc => {
            const data = doc.data();
            allReports.push({ id: doc.id, ...data });
        });
        
        // Robust sort descending by date / timestamp / createdAt
        allReports.sort((a, b) => {
            const getTimestamp = (r) => {
                if (r.createdAt?.toDate) return r.createdAt.toDate().getTime();
                if (r.timestamp?.toDate) return r.timestamp.toDate().getTime();
                if (r.createdAt) return new Date(r.createdAt).getTime();
                if (r.timestamp) return new Date(r.timestamp).getTime();
                if (r.date) return new Date(r.date).getTime();
                return 0;
            };
            return getTimestamp(b) - getTimestamp(a);
        });

        console.log("Total reports loaded from Firestore:", allReports.length);
    } catch (e) {
        console.warn("Error fetching reports from Firestore:", e);
    }
    updateDashboardUI();
    renderHistory(allReports);
}

window.closeMobileNav = function() {
    const navEl = document.getElementById("smvsNavbarNav");
    if (navEl && navEl.classList.contains("show") && typeof bootstrap !== "undefined") {
        const bsCollapse = bootstrap.Collapse.getInstance(navEl) || new bootstrap.Collapse(navEl);
        bsCollapse.hide();
    }
};

function normalizeText(text) {
    if (!text) return "";
    let s = text.toLowerCase().trim();
    const map = {
        'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh', 'ચ': 'ch', 'છ': 'chh',
        'જ': 'j', 'ઝ': 'z', 'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh',
        'ણ': 'n', 'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n',
        'પ': 'p', 'ફ': 'f', 'બ': 'b', 'ભ': 'bh', 'મ': 'm', 'ય': 'y',
        'ર': 'r', 'લ': 'l', 'વ': 'v', 'શ': 's', 'ષ': 'sh', 'સ': 's', 'હ': 'h'
    };
    for (const [gu, en] of Object.entries(map)) {
        s = s.split(gu).join(en);
    }
    return s.replace(/[\u0ABE-\u0ACF]/g, "").replace(/w/g, "v").replace(/ee/g, "i").replace(/oo/g, "u").replace(/sh/g, "s");
}

window.filterReports = function() {
    const dateVal = document.getElementById("filterDate").value;
    const countryVal = document.getElementById("filterCountry").value;
    const zoneSelect = document.getElementById("filterZone");
    const zoneVal = zoneSelect.options[zoneSelect.selectedIndex]?.textContent;
    const cntSelect = document.getElementById("filterCenter");
    const centerVal = cntSelect.options[cntSelect.selectedIndex]?.textContent;
    const occVal = normalizeText(document.getElementById("filterOccasion").value);
    const locVal = normalizeText(document.getElementById("filterLocation").value);

    const filtered = allReports.filter(r => {
        if (dateVal && r.date !== dateVal) return false;
        if (countryVal && String(r.countryId) !== String(countryVal)) return false;
        if (zoneVal && zoneVal !== "All Zones" && (r.zone || "").toLowerCase() !== zoneVal.toLowerCase()) return false;
        if (centerVal && centerVal !== "All Centers" && (r.center || "").toLowerCase() !== centerVal.toLowerCase()) return false;
        if (occVal && !normalizeText(r.occasion || "").includes(occVal)) return false;
        if (locVal && !normalizeText(r.location || "").includes(locVal)) return false;
        return true;
    });

    renderHistory(filtered);
};

function renderHistory(reports) {
    const list = document.getElementById("historyList");
    if (!list) return;

    if (!reports || reports.length === 0) {
        list.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fa-solid fa-inbox fa-3x mb-3 d-block"></i>No reports found.</div>';
        return;
    }

    let html = "";
    reports.forEach(r => {
        const dateObj = new Date(r.date);
        const dateDisplay = !isNaN(dateObj) ? `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}` : r.date;

        html += `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card h-100 btn-card">
                <div class="card-header d-flex justify-content-between align-items-center py-3">
                    <div>
                        <h6 class="mb-0 fw-bold text-primary">${r.location || "Unknown Location"}</h6>
                        <small class="text-muted">${dateDisplay} | ${r.day || ""}</small>
                    </div>
                    <span class="badge bg-secondary">${r.grade || "A"}</span>
                </div>
                <div class="card-body">
                    <p class="mb-1 text-muted"><strong>Occasion:</strong> ${r.occasion || "-"}</p>
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
    if (!report) {
        alert("Report not found!");
        return;
    }

    const d = new Date(report.date || Date.now());
    const dayStr = !isNaN(d) ? String(d.getDate()).padStart(2, "0") : "01";
    const monthStr = !isNaN(d) ? d.toLocaleString("en-US", { month: "short" }) : "Report";
    const yearStr = !isNaN(d) ? d.getFullYear() : "2026";
    const fname = `${dayStr} ${monthStr}_${yearStr}_${report.occasion || 'Sabha'}_${report.location || 'Report'}`;

    showLoader("PREPARING EXPORT...");
    try {
        if (type === "pdf") {
            generatePDFDocument(report, fname, action).finally(hideLoader);
        } else {
            generateWordDocument(report, fname, action);
            hideLoader();
        }
    } catch (err) {
        hideLoader();
        alert("Export error: " + err.message);
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
    if (!confirm("Are you sure you want to delete this report?")) return;
    showLoader("DELETING FROM FIRESTORE...");
    try {
        await db.collection("reports").doc(id).delete();
        allReports = allReports.filter(r => String(r.id) !== String(id));
        renderHistory(allReports);
        updateDashboardUI();
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        hideLoader();
    }
};

// --- 13. NAVIGATION HELPERS ---
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
    const createBtns = document.getElementById("createActionButtons");
    const editBtns = document.getElementById("editActionButtons");
    if (mode === "edit") {
        createBtns.classList.add("d-none");
        editBtns.classList.remove("d-none");
        editBtns.classList.add("d-flex");
    } else {
        createBtns.classList.remove("d-none");
        editBtns.classList.add("d-none");
        editBtns.classList.remove("d-flex");
    }
}

window.resetForm = function(force = false) {
    if (force && !confirm("Are you sure you want to Clear the Form?")) return;
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

// --- 14. ADMIN MANAGEMENT CONSOLE (LOCATIONS, CATEGORIES, USERS) ---
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
    showLoader("LOADING ADMIN PANEL...");

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
    if (locationTree.length > 0 && !adminSelectedCountryId) {
        adminSelectedCountryId = locationTree[0].id;
    }
    const currentCountry = locationTree.find(c => c.id === adminSelectedCountryId) || locationTree[0];

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
                    <span class="badge bg-secondary">${locationTree.length}</span>
                </div>
                <form onsubmit="addCountry(event)" class="mb-3">
                    <div class="input-group">
                        <input type="text" id="newCountryName" class="form-control" placeholder="Add Country..." required>
                        <button class="btn btn-primary" type="submit" title="Add Country"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </form>
                <div class="overflow-y-auto" style="max-height: 480px;">
                    ${locationTree.map(c => `
                        <div class="admin-list-item ${c.id === currentCountry?.id ? 'active' : ''}" onclick="selectAdminCountry(${c.id})">
                            <div>
                                <span class="fw-bold">${c.name}</span>
                                <small class="d-block text-muted">${(c.zones || []).length} Zones</small>
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
                                    <small class="d-block text-muted">${(z.centers || []).length} Centers</small>
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
    const newId = Date.now();
    locationTree.push({ id: newId, name, code: "", zones: [] });
    await saveLocationsTreeToFirestore();
    populateCountryDropdown();
    switchAdminTab("locations");
};

window.deleteCountry = async function(id) {
    if (!confirm("Are you sure you want to delete this country?")) return;
    locationTree = locationTree.filter(c => c.id !== id);
    if (adminSelectedCountryId === id) adminSelectedCountryId = null;
    await saveLocationsTreeToFirestore();
    populateCountryDropdown();
    switchAdminTab("locations");
};

window.addZone = async function(e, countryId) {
    e.preventDefault();
    const name = document.getElementById("newZoneName").value.trim();
    if (!name) return;
    const country = locationTree.find(c => c.id === countryId);
    if (country) {
        if (!country.zones) country.zones = [];
        country.zones.push({ id: Date.now(), name, centers: [] });
        await saveLocationsTreeToFirestore();
        populateCountryDropdown();
        switchAdminTab("locations");
    }
};

window.deleteZone = async function(id) {
    if (!confirm("Are you sure you want to delete this zone?")) return;
    locationTree.forEach(c => {
        if (c.zones) c.zones = c.zones.filter(z => z.id !== id);
    });
    if (adminSelectedZoneId === id) adminSelectedZoneId = null;
    await saveLocationsTreeToFirestore();
    populateCountryDropdown();
    switchAdminTab("locations");
};

window.addCenter = async function(e, zoneId) {
    e.preventDefault();
    const name = document.getElementById("newCenterName").value.trim();
    if (!name) return;
    locationTree.forEach(c => {
        (c.zones || []).forEach(z => {
            if (z.id === zoneId) {
                if (!z.centers) z.centers = [];
                z.centers.push({ id: Date.now(), name });
            }
        });
    });
    await saveLocationsTreeToFirestore();
    populateCountryDropdown();
    switchAdminTab("locations");
};

window.deleteCenter = async function(id) {
    if (!confirm("Are you sure you want to delete this center?")) return;
    locationTree.forEach(c => {
        (c.zones || []).forEach(z => {
            if (z.centers) z.centers = z.centers.filter(cnt => cnt.id !== id);
        });
    });
    await saveLocationsTreeToFirestore();
    populateCountryDropdown();
    switchAdminTab("locations");
};

// Selection-Based Categories: Main Category -> Subcategories
async function renderAdminCategories(container) {
    const catKeys = Object.keys(categoriesData);
    if (catKeys.length > 0 && (!adminSelectedCategoryId || !categoriesData[adminSelectedCategoryId])) {
        adminSelectedCategoryId = catKeys[0];
    }
    const currentCatKey = adminSelectedCategoryId || catKeys[0];
    const catSubs = categoriesData[currentCatKey] || [];

    container.innerHTML = `
    <div class="row g-4">
        <!-- 1. Main Categories Column (Left) -->
        <div class="col-12 col-md-5">
            <div class="card p-3 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0"><i class="fa-solid fa-tags me-2"></i>Main Categories (મુખ્ય કેટેગરી)</h6>
                    <span class="badge bg-secondary">${catKeys.length}</span>
                </div>
                <form onsubmit="addCategory(event)" class="mb-3">
                    <div class="input-group">
                        <input type="text" id="newCatName" class="form-control" placeholder="Add New Category..." required>
                        <button class="btn btn-primary" type="submit" title="Add Category"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </form>
                <div class="overflow-y-auto" style="max-height: 480px;">
                    ${catKeys.map(c => {
                        const count = (categoriesData[c] || []).length;
                        return `
                        <div class="admin-list-item ${c === currentCatKey ? 'active' : ''}" onclick="selectAdminCategory('${c}')">
                            <div>
                                <span class="fw-bold">${c}</span>
                                <small class="d-block text-muted">${count} Subcategories</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" onclick="event.stopPropagation(); openAdminEdit('category', '${c}', '${c.replace(/'/g, "\\'")}')" title="Edit Category"><i class="fa-solid fa-pen-to-square fa-xs"></i></button>
                                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="event.stopPropagation(); deleteCategory('${c}');" title="Delete Category"><i class="fa-solid fa-trash fa-xs"></i></button>
                            </div>
                        </div>`;
                    }).join("")}
                </div>
            </div>
        </div>

        <!-- 2. Subcategories Column (Right) -->
        <div class="col-12 col-md-7">
            <div class="card p-3 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0">
                        <i class="fa-solid fa-list-check me-2"></i>Sub-Categories of <span class="text-warning">"${currentCatKey || ''}"</span>
                    </h6>
                    <span class="badge bg-secondary">${catSubs.length}</span>
                </div>
                ${currentCatKey ? `
                    <form onsubmit="addSubCategory(event, '${currentCatKey}')" class="mb-3">
                        <div class="input-group">
                            <input type="text" id="newSubCatName" class="form-control" placeholder="Add Sub-Category in ${currentCatKey}..." required>
                            <button class="btn btn-primary" type="submit" title="Add Sub-Category"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </form>
                    <div class="overflow-y-auto" style="max-height: 480px;">
                        ${catSubs.length === 0 ? '<p class="text-muted small text-center py-4">No sub-categories in this category yet. Add one above!</p>' : ''}
                        ${catSubs.map((s, idx) => `
                            <div class="admin-list-item">
                                <span class="fw-bold">${s}</span>
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" onclick="openAdminEdit('subcategory', '${idx}', '${s.replace(/'/g, "\\'")}', '', '${currentCatKey}')" title="Edit Sub-Category"><i class="fa-solid fa-pen-to-square fa-xs"></i></button>
                                    <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteSubCategory('${currentCatKey}', '${s.replace(/'/g, "\\'")}')" title="Delete Sub-Category"><i class="fa-solid fa-trash fa-xs"></i></button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                ` : '<p class="text-muted small text-center py-4">Select a category on the left first.</p>'}
            </div>
        </div>
    </div>`;
}

window.selectAdminCategory = function(name) {
    adminSelectedCategoryId = name;
    switchAdminTab("categories");
};

window.addCategory = async function(e) {
    e.preventDefault();
    const name = document.getElementById("newCatName").value.trim();
    if (!name || categoriesData[name]) return;
    categoriesData[name] = [];
    await saveCategoriesToFirestore();
    renderCategories();
    switchAdminTab("categories");
};

window.deleteCategory = async function(name) {
    if (!confirm(`Delete category "${name}" and all its subcategories?`)) return;
    delete categoriesData[name];
    if (adminSelectedCategoryId === name) adminSelectedCategoryId = null;
    await saveCategoriesToFirestore();
    renderCategories();
    switchAdminTab("categories");
};

window.addSubCategory = async function(e, catName) {
    e.preventDefault();
    const name = document.getElementById("newSubCatName").value.trim();
    if (!name || !categoriesData[catName]) return;
    if (!categoriesData[catName].includes(name)) {
        categoriesData[catName].push(name);
        await saveCategoriesToFirestore();
        renderCategories();
        switchAdminTab("categories");
    }
};

window.deleteSubCategory = async function(catName, subName) {
    if (!confirm(`Delete subcategory "${subName}"?`)) return;
    if (categoriesData[catName]) {
        categoriesData[catName] = categoriesData[catName].filter(s => s !== subName);
        await saveCategoriesToFirestore();
        renderCategories();
        switchAdminTab("categories");
    }
};

// Admin Users Tab (Loaded from Firestore 'users' collection)
async function renderAdminUsers(container) {
    let users = [];
    try {
        const snap = await db.collection("users").get();
        snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.warn("Error fetching users:", e);
    }

    if (users.length === 0) {
        await seedDefaultUsersIfNeeded();
        const snap = await db.collection("users").get();
        snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    }

    container.innerHTML = `
    <div class="row g-4">
        <div class="col-12 col-lg-4">
            <div class="card p-3">
                <h6 class="text-primary fw-bold mb-3"><i class="fa-solid fa-user-plus me-2"></i>Add New User</h6>
                <form onsubmit="addUser(event)">
                    <div class="mb-2">
                        <label class="form-label small">Username / Email</label>
                        <input type="text" id="newUsername" class="form-control" placeholder="user@smvs.org" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small">Display Name</label>
                        <input type="text" id="newUserDisplayName" class="form-control" placeholder="PSK" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small">Password</label>
                        <input type="text" id="newUserPass" class="form-control" placeholder="Password" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small">Role</label>
                        <select id="newUserRole" class="form-select">
                            <option value="admin">Admin (Full Access)</option>
                            <option value="user">User (Standard Access)</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 fw-bold"><i class="fa-solid fa-user-check me-1"></i> Create User</button>
                </form>
            </div>
        </div>

        <div class="col-12 col-lg-8">
            <div class="card p-3">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-primary fw-bold mb-0"><i class="fa-solid fa-users me-2"></i>Existing Users (${users.length})</h6>
                    <button class="btn btn-sm btn-outline-primary" onclick="switchAdminTab('users')"><i class="fa-solid fa-rotate me-1"></i> Refresh</button>
                </div>
                <div class="table-responsive">
                    <table class="table table-dark table-hover mb-0 align-middle">
                        <thead>
                            <tr class="text-muted small">
                                <th>Display Name</th>
                                <th>Username / Email</th>
                                <th>Password</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td class="fw-bold">${u.displayName || u.fullName || u.username}</td>
                                    <td><small class="text-muted">${u.username || u.email}</small></td>
                                    <td><code class="text-warning">${u.password || "••••"}</code></td>
                                    <td><span class="${u.role === 'admin' ? 'badge bg-warning text-dark' : 'badge bg-secondary'}">${(u.role || 'user').toUpperCase()}</span></td>
                                    <td><span class="badge ${u.isActive !== false ? 'bg-success' : 'bg-danger'}">${u.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                                    <td class="text-end text-nowrap">
                                        <button class="btn btn-sm btn-outline-warning me-1" onclick="openAdminEdit('user', '${u.id}', '${u.username}', '', null, '${(u.displayName||u.fullName||'').replace(/'/g, "\\'")}', '${u.email||u.username}', '${u.role}', ${u.isActive !== false ? 1 : 0}, '${(u.password||'').replace(/'/g, "\\'")}');" title="Edit User"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}')" ${u.username === currentUser?.username ? 'disabled' : ''} title="Delete User"><i class="fa-solid fa-trash"></i></button>
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

window.addUser = async function(e) {
    e.preventDefault();
    const username = document.getElementById("newUsername").value.trim();
    const displayName = document.getElementById("newUserDisplayName").value.trim();
    const password = document.getElementById("newUserPass").value.trim();
    const role = document.getElementById("newUserRole").value;

    showLoader("CREATING USER...");
    try {
        await db.collection("users").add({
            username,
            email: username,
            displayName,
            fullName: displayName,
            password,
            role,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("User added successfully in Firestore!");
        switchAdminTab("users");
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        hideLoader();
    }
};

window.deleteUser = async function(id) {
    if (!confirm("Delete user record from Firestore?")) return;
    try {
        await db.collection("users").doc(id).delete();
        switchAdminTab("users");
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// --- 15. UNIVERSAL ADMIN EDIT MODAL ---
window.openAdminEdit = function(type, id, name, code = "", parentId = null, fullName = "", email = "", role = "user", isActive = 1, password = "") {
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

    // Reset visibility
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
        parentSelect.innerHTML = locationTree.map(c => `<option value="${c.id}" ${c.id === parentId ? 'selected' : ''}>${c.name}</option>`).join("");
    } else if (type === "center") {
        titleEl.innerHTML = '<i class="fa-solid fa-location-dot me-2 text-warning"></i>Edit Center';
        nameLabel.textContent = "Center Name";
        parentGroup.classList.remove("d-none");
        parentLabel.textContent = "Parent Zone";
        let zoneOptions = "";
        locationTree.forEach(c => {
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
        document.getElementById("adminEditParentId").value = parentId;
    } else if (type === "user") {
        titleEl.innerHTML = '<i class="fa-solid fa-user-pen me-2 text-warning"></i>Edit User';
        nameGroup.classList.add("d-none");
        userFields.classList.remove("d-none");
        document.getElementById("adminEditUserFullName").value = fullName;
        document.getElementById("adminEditUserEmail").value = email;
        document.getElementById("adminEditUserRole").value = role;
        document.getElementById("adminEditUserPassword").value = password || "";
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
        if (type === "country") {
            const country = locationTree.find(c => String(c.id) === String(id));
            if (country) country.name = name;
            await saveLocationsTreeToFirestore();
            populateCountryDropdown();
            switchAdminTab("locations");
        } else if (type === "zone") {
            locationTree.forEach(c => {
                (c.zones || []).forEach(z => {
                    if (String(z.id) === String(id)) z.name = name;
                });
            });
            await saveLocationsTreeToFirestore();
            populateCountryDropdown();
            switchAdminTab("locations");
        } else if (type === "center") {
            locationTree.forEach(c => {
                (c.zones || []).forEach(z => {
                    (z.centers || []).forEach(cnt => {
                        if (String(cnt.id) === String(id)) cnt.name = name;
                    });
                });
            });
            await saveLocationsTreeToFirestore();
            populateCountryDropdown();
            switchAdminTab("locations");
        } else if (type === "category") {
            if (id !== name && categoriesData[id]) {
                categoriesData[name] = categoriesData[id];
                delete categoriesData[id];
                adminSelectedCategoryId = name;
                await saveCategoriesToFirestore();
                renderCategories();
                switchAdminTab("categories");
            }
        } else if (type === "subcategory") {
            const catName = document.getElementById("adminEditParentId")?.value || adminSelectedCategoryId;
            const idx = parseInt(id);
            if (categoriesData[catName] && !isNaN(idx) && categoriesData[catName][idx]) {
                categoriesData[catName][idx] = name;
                await saveCategoriesToFirestore();
                renderCategories();
                switchAdminTab("categories");
            }
        } else if (type === "user") {
            const displayName = document.getElementById("adminEditUserFullName").value.trim();
            const username = document.getElementById("adminEditUserEmail").value.trim();
            const role = document.getElementById("adminEditUserRole").value;
            const password = document.getElementById("adminEditUserPassword").value.trim();
            const isActive = document.getElementById("adminEditUserActive").checked;

            const updatePayload = {
                displayName,
                fullName: displayName,
                username,
                email: username,
                role,
                isActive,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (password) updatePayload.password = password;

            await db.collection("users").doc(id).set(updatePayload, { merge: true });

            // If updating current active user, update state
            if (currentUser && currentUser.id === id) {
                currentUser.displayName = displayName;
                currentUser.username = username;
                currentUser.role = role;
                localStorage.setItem("smvs_active_user", JSON.stringify(currentUser));
            }

            switchAdminTab("users");
        }

        if (adminEditModalInstance) adminEditModalInstance.hide();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        hideLoader();
    }
};

// --- 16. INITIALIZATION ON DOM READY ---
document.addEventListener("DOMContentLoaded", () => {
    initEmailJsIfConfigured();

    // Check existing active user session
    checkSavedSession();

    // Pre-seed user accounts in background
    seedDefaultUsersIfNeeded().catch(console.warn);

    // Initialize Quill Editor
    const editorEl = document.getElementById("editor-container");
    if (editorEl && typeof Quill !== "undefined") {
        quill = new Quill("#editor-container", {
            theme: "snow",
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    [{ align: [] }],
                    ["clean"]
                ]
            }
        });
        quill.on("text-change", scheduleDraftSave);
    }

    // Auto-save draft on form input changes
    const reportForm = document.getElementById("reportForm");
    if (reportForm) {
        reportForm.addEventListener("input", scheduleDraftSave);
        reportForm.addEventListener("change", scheduleDraftSave);
    }
});

window.closeSidebarDrawer = function() {
    const el = document.getElementById("smvsSidebarDrawer");
    if (el && typeof bootstrap !== "undefined") {
        const offcanvas = bootstrap.Offcanvas.getInstance(el);
        if (offcanvas) offcanvas.hide();
    }
};
