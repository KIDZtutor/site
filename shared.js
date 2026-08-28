/*
 * shared.js
 * Общий код для index.html и subject.html:
 * - загрузка и кэширование данных из Google Таблицы (CSV)
 * - разбор CSV
 * - безопасная вставка текста/ссылок (защита от XSS)
 * - подбор иконки по типу материала
 * - глобальный поиск
 * - переключение курсов
 *
 * Формат таблицы (столбцы, порядок не важен — ищутся по названию):
 * subject_id | subject_title | module_title | module_desc | subtopic_title | item_type | item_name | item_url
 *
 * item_type: file / link / video
 *
 * Курс передаётся через ?year=1 или ?year=2 в URL.
 * 1 курс  → первый лист (gid=0)
 * 2 курс  → второй лист (gid=1440724464)
 */

// Базовый URL таблицы (без gid — он добавляется динамически)
const SPREADSHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRab9U4NkEN_nDzMDGPwYyLiFjJSh15rupb509MjKCRVk2du7EAJ5QtA633LfIUcuj3bUHL0QbIiwEm/pub?output=csv";

const SHEET_GID = {
    "1": "0",
    "2": "1440724464"
};

const CACHE_TTL_MS = 3 * 60 * 1000;

const COLUMN_NAMES = {
    subjectId:     ["subject_id"],
    subjectTitle:  ["subject_title"],
    moduleTitle:   ["module_title"],
    moduleDesc:    ["module_desc"],
    subtopicTitle: ["subtopic_title"],
    itemType:      ["item_type"],
    itemName:      ["item_name"],
    itemUrl:       ["item_url"]
};

// ─── Определение текущего курса ──────────────────────────────────────────────

/**
 * Возвращает текущий курс из URL (?year=1 или ?year=2).
 * По умолчанию — 1.
 */
function getCurrentYear() {
    const params = new URLSearchParams(window.location.search);
    const year = params.get("year");
    return (year === "2") ? "2" : "1";
}

/** URL CSV-листа для заданного курса. */
function getCsvUrl(year) {
    const gid = SHEET_GID[year] || SHEET_GID["1"];
    return SPREADSHEET_BASE_URL + "&gid=" + gid + "&t=" + Date.now();
}

/** Ключ кэша в sessionStorage для заданного курса. */
function getCacheKey(year) {
    return "archive_csv_cache_v1_year" + year;
}

// ─── Переключатель курсов в шапке ────────────────────────────────────────────

/**
 * Рендерит переключатель курсов в элемент .year-switcher.
 * Активный курс выделен, неактивный — ссылка на тот же тип страницы.
 */
function initYearSwitcher() {
    const container = document.querySelector(".year-switcher");
    if (!container) return;

    const currentYear = getCurrentYear();

    // Строим ссылку для переключения, сохраняя тип страницы и id предмета
    function buildSwitchUrl(targetYear) {
        const params = new URLSearchParams(window.location.search);
        params.set("year", targetYear);
        // При переключении курса со страницы предмета — возвращаем на главную
        // того курса (предмет может не существовать в другом курсе)
        const isSubjectPage = params.has("id");
        if (isSubjectPage) {
            return "index.html?year=" + targetYear;
        }
        return window.location.pathname.split("/").pop() + "?" + params.toString();
    }

    container.innerHTML = "";

    ["1", "2"].forEach(year => {
        if (year === currentYear) {
            const span = document.createElement("span");
            span.className = "year-btn year-btn--active";
            span.textContent = year + " курс";
            container.appendChild(span);
        } else {
            const a = document.createElement("a");
            a.href = buildSwitchUrl(year);
            a.className = "year-btn";
            a.textContent = year + " курс";
            container.appendChild(a);
        }
    });
}

// ─── Парсинг CSV ──────────────────────────────────────────────────────────────

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') { field += '"'; i++; }
            else if (char === '"') { inQuotes = false; }
            else { field += char; }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            row.push(field); field = "";
        } else if (char === "\r") {
            if (next !== "\n") { row.push(field); field = ""; rows.push(row); row = []; }
        } else if (char === "\n") {
            row.push(field); field = ""; rows.push(row); row = [];
        } else {
            field += char;
        }
    }

    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ""));
}

function resolveColumns(headerRow) {
    const headers = headerRow.map(h => h.trim().toLowerCase());
    const fallbackOrder = ["subjectId","subjectTitle","moduleTitle","moduleDesc","subtopicTitle","itemType","itemName","itemUrl"];
    const columns = {};
    fallbackOrder.forEach((key, i) => {
        const found = headers.findIndex(h => COLUMN_NAMES[key].includes(h));
        columns[key] = found !== -1 ? found : i;
    });
    return columns;
}

function toRecords(rows) {
    if (!rows || rows.length < 2) return [];
    const columns = resolveColumns(rows[0]);
    const records = [];

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        const subjectTitle = (r[columns.subjectTitle] || "").trim();
        if (!subjectTitle) continue;
        const subjectId = (r[columns.subjectId] || "").trim();
        records.push({
            subjectId:     subjectId || subjectTitle,
            subjectTitle,
            moduleTitle:   (r[columns.moduleTitle]   || "").trim(),
            moduleDesc:    (r[columns.moduleDesc]     || "").trim(),
            subtopicTitle: (r[columns.subtopicTitle]  || "").trim(),
            itemType:      (r[columns.itemType]       || "").trim().toLowerCase(),
            itemName:      (r[columns.itemName]       || "").trim(),
            itemUrl:       (r[columns.itemUrl]        || "").trim()
        });
    }
    return records;
}

// ─── Загрузка данных с кэшем ──────────────────────────────────────────────────

async function loadRecords() {
    const year = getCurrentYear();
    const cacheKey = getCacheKey(year);
    const cached = readCache(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.records;
    }

    try {
        const response = await fetch(getCsvUrl(year));
        if (!response.ok) throw new Error("Сетевая ошибка при загрузке таблицы");
        const text = await response.text();
        const records = toRecords(parseCSV(text));
        writeCache(cacheKey, records);
        return records;
    } catch (err) {
        if (cached) {
            console.warn("Не удалось обновить данные, использую кэш:", err);
            return cached.records;
        }
        throw err;
    }
}

function readCache(key) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return (parsed && Array.isArray(parsed.records)) ? parsed : null;
    } catch { return null; }
}

function writeCache(key, records) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), records }));
    } catch { /* приватный режим — не критично */ }
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function sanitizeUrl(url) {
    if (!url) return "";
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^\//.test(trimmed)) return trimmed;
    return "";
}

function getIconForItem(itemType, url = "", name = "") {
    const u = url.toLowerCase();
    const n = name.toLowerCase();

    // Видео — приоритет по ссылке, даже если item_type = link
    if (
        itemType === "video" ||
        u.includes("youtu") || u.includes("rutube") || u.includes("vimeo") ||
        u.endsWith(".mp4") || n.includes("видео") || n.includes("плейлист")
    ) return "🎥";

    if (itemType === "file") return "📄";
    if (itemType === "link") return "🔗";

    // Запасной вариант
    if (
        u.includes("drive.google.com") || u.includes("docs.google.com") ||
        u.endsWith(".pdf") || u.endsWith(".doc") || u.endsWith(".docx")
    ) return "📄";

    return "🔗";
}

/** Строит ссылку на страницу предмета с учётом текущего курса. */
function buildSubjectUrl(subjectId) {
    const year = getCurrentYear();
    return `subject.html?year=${year}&id=${encodeURIComponent(subjectId)}`;
}

function buildBreadcrumbText(parts) {
    return parts.filter(Boolean).join(" › ");
}

function debounce(fn, waitMs) {
    let timer = null;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), waitMs); };
}

// ─── Глобальный поиск ────────────────────────────────────────────────────────

function initGlobalSearch(records) {
    const input    = document.getElementById("global-search");
    const dropdown = document.getElementById("search-dropdown");
    if (!input || !dropdown) return;

    let activeIndex = -1;

    const runSearch = (rawQuery) => {
        const query = rawQuery.toLowerCase().trim();
        dropdown.innerHTML = "";
        activeIndex = -1;

        if (query.length < 2) {
            dropdown.style.display = "none";
            dropdown.setAttribute("aria-expanded", "false");
            return;
        }

        const results = [];
        const seen = new Set();

        const add = (key, icon, text, url, external) => {
            if (seen.has(key)) return;
            seen.add(key);
            results.push({ icon, text, url, external });
        };

        for (const rec of records) {
            const subjectUrl = buildSubjectUrl(rec.subjectId);

            if (rec.subjectTitle.toLowerCase().includes(query))
                add(`subj_${rec.subjectId}`, "📁", `Предмет: ${rec.subjectTitle}`, subjectUrl, false);

            if (rec.moduleTitle && rec.moduleTitle.toLowerCase().includes(query))
                add(`mod_${rec.subjectId}_${rec.moduleTitle}`, "📚",
                    buildBreadcrumbText([rec.subjectTitle, rec.moduleTitle]), subjectUrl, false);

            if (rec.subtopicTitle && rec.subtopicTitle.toLowerCase().includes(query))
                add(`sub_${rec.subjectId}_${rec.moduleTitle}_${rec.subtopicTitle}`, "📌",
                    buildBreadcrumbText([rec.subjectTitle, rec.moduleTitle, rec.subtopicTitle]), subjectUrl, false);

            if (rec.itemName && rec.itemName.toLowerCase().includes(query)) {
                const safeUrl = sanitizeUrl(rec.itemUrl);
                add(`item_${rec.itemName}_${rec.itemUrl}`,
                    getIconForItem(rec.itemType, rec.itemUrl, rec.itemName),
                    buildBreadcrumbText([rec.subjectTitle, rec.itemName]),
                    safeUrl || subjectUrl,
                    !!safeUrl
                );
            }
        }

        if (results.length === 0) {
            const empty = document.createElement("div");
            empty.className = "search-item empty";
            empty.textContent = "Ничего не найдено";
            dropdown.appendChild(empty);
            dropdown.style.display = "block";
            dropdown.setAttribute("aria-expanded", "true");
            return;
        }

        results.slice(0, 10).forEach(item => {
            const a = document.createElement("a");
            a.href = item.url;
            a.className = "search-item";
            a.setAttribute("role", "option");
            a.textContent = `${item.icon} ${item.text}`;
            if (item.external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
            dropdown.appendChild(a);
        });

        dropdown.style.display = "block";
        dropdown.setAttribute("aria-expanded", "true");
    };

    input.addEventListener("input", debounce(e => runSearch(e.target.value), 200));

    input.addEventListener("keydown", e => {
        const items = Array.from(dropdown.querySelectorAll(".search-item:not(.empty)"));
        if (e.key === "Escape") {
            dropdown.style.display = "none";
            dropdown.setAttribute("aria-expanded", "false");
            return;
        }
        if (!items.length) return;
        if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = (activeIndex + 1) % items.length; items[activeIndex].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = (activeIndex - 1 + items.length) % items.length; items[activeIndex].focus(); }
    });

    document.addEventListener("click", e => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = "none";
            dropdown.setAttribute("aria-expanded", "false");
        }
    });
}
