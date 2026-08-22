/*
 * shared.js
 * Общий код для index.html и subject.html:
 * - загрузка и кэширование данных из Google Таблицы (CSV)
 * - разбор CSV
 * - безопасная вставка текста/ссылок (защита от XSS)
 * - подбор иконки по типу материала
 * - глобальный поиск
 *
 * Формат таблицы (столбцы, порядок не важен — ищутся по названию):
 * subject_id | subject_title | module_title | module_desc | subtopic_title | item_type | item_name | item_url
 *
 * item_type: file / link / video (если пусто или опечатка — иконка подбирается по ссылке)
 */

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQo1BTijFHbQ-9CccGiWTz8cP-uzybyEsAdOyn9ce5TdwvKEDgMWnj1yye9kNBbhaJk66pCI5O-4GUU/pub?output=csv";

// Сколько миллисекунд считаем кэш свежим (чтобы переход между страницами
// главная -> предмет не дёргал таблицу заново каждый раз)
const CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE_KEY = "archive_csv_cache_v1";

// Названия столбцов, которые мы ищем в первой строке таблицы.
// Если человек в таблице переставит столбцы местами — код не сломается.
const COLUMN_NAMES = {
    subjectId: ["subject_id"],
    subjectTitle: ["subject_title"],
    moduleTitle: ["module_title"],
    moduleDesc: ["module_desc"],
    subtopicTitle: ["subtopic_title"],
    itemType: ["item_type"],
    itemName: ["item_name"],
    itemUrl: ["item_url"]
};

/**
 * Разбирает CSV-текст в массив строк (каждая строка — массив ячеек).
 * Понимает кавычки и запятые/переносы строк внутри кавычек.
 */
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\r") {
            // игнорируем, перенос строки обработает \n (или отдельный \r ниже)
            if (next !== "\n") {
                row.push(field);
                field = "";
                rows.push(row);
                row = [];
            }
        } else if (char === "\n") {
            row.push(field);
            field = "";
            rows.push(row);
            row = [];
        } else {
            field += char;
        }
    }

    // последняя строка без завершающего переноса
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter(r => r.some(cell => cell.trim() !== ""));
}

/**
 * По заголовкам таблицы определяет индекс каждого нужного столбца.
 * Если столбец не найден по имени — используется позиционный порядок
 * как в исходном формате таблицы (запасной вариант).
 */
function resolveColumns(headerRow) {
    const headers = headerRow.map(h => h.trim().toLowerCase());
    const fallbackOrder = ["subjectId", "subjectTitle", "moduleTitle", "moduleDesc", "subtopicTitle", "itemType", "itemName", "itemUrl"];

    const columns = {};
    fallbackOrder.forEach((key, fallbackIndex) => {
        const names = COLUMN_NAMES[key];
        const found = headers.findIndex(h => names.includes(h));
        columns[key] = found !== -1 ? found : fallbackIndex;
    });

    return columns;
}

/**
 * Превращает "сырые" строки CSV в удобные объекты записей,
 * пропуская пустые/битые строки.
 */
function toRecords(rows) {
    if (!rows || rows.length < 2) return [];

    const columns = resolveColumns(rows[0]);
    const records = [];

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;

        const subjectId = (r[columns.subjectId] || "").trim();
        const subjectTitle = (r[columns.subjectTitle] || "").trim();

        // Строка без предмета бесполезна — пропускаем, не роняя всё остальное
        if (!subjectTitle) continue;

        records.push({
            subjectId: subjectId || subjectTitle,
            subjectTitle,
            moduleTitle: (r[columns.moduleTitle] || "").trim(),
            moduleDesc: (r[columns.moduleDesc] || "").trim(),
            subtopicTitle: (r[columns.subtopicTitle] || "").trim(),
            itemType: (r[columns.itemType] || "").trim().toLowerCase(),
            itemName: (r[columns.itemName] || "").trim(),
            itemUrl: (r[columns.itemUrl] || "").trim()
        });
    }

    return records;
}

/**
 * Загружает записи из Google Таблицы с кэшированием в sessionStorage,
 * чтобы переход между страницами не тянул CSV заново каждый раз.
 * Если сеть недоступна — пробует отдать то, что есть в кэше (даже старое).
 */
async function loadRecords() {
    const cached = readCache();
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.records;
    }

    try {
        const response = await fetch(CSV_URL + "&t=" + Date.now());
        if (!response.ok) throw new Error("Сетевая ошибка при загрузке таблицы");
        const text = await response.text();
        const records = toRecords(parseCSV(text));
        writeCache(records);
        return records;
    } catch (err) {
        if (cached) {
            console.warn("Не удалось обновить данные, использую сохранённую копию:", err);
            return cached.records;
        }
        throw err;
    }
}

function readCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.records)) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(records) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), records }));
    } catch {
        // sessionStorage может быть недоступен (приватный режим) — не критично
    }
}

/** Экранирует текст перед вставкой в HTML, защита от XSS. */
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

/**
 * Пропускает только безопасные ссылки (http/https и относительные пути).
 * Отсекает javascript:, data: и прочие потенциально опасные схемы.
 */
function sanitizeUrl(url) {
    if (!url) return "";
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^\//.test(trimmed)) return trimmed;
    return "";
}

/** Возвращает эмодзи-иконку под тип материала. */
function getIconForItem(itemType, url = "", name = "") {
    if (itemType === "video") return "🎥";
    if (itemType === "link") return "🔗";
    if (itemType === "file") return "📄";

    // Запасной вариант, если item_type не заполнен или в нём опечатка
    const u = url.toLowerCase();
    const n = name.toLowerCase();

    if (u.includes("youtu") || u.includes("rutube") || u.includes("vimeo") || u.endsWith(".mp4") || n.includes("видео") || n.includes("плейлист")) {
        return "🎥";
    }
    if (u.includes("drive.google.com") || u.includes("docs.google.com") || u.endsWith(".pdf") || u.endsWith(".doc") || u.endsWith(".docx")) {
        return "📄";
    }
    return "🔗";
}

/** Строит ссылку на страницу предмета по его id. */
function buildSubjectUrl(subjectId) {
    return `subject.html?id=${encodeURIComponent(subjectId)}`;
}

/** Задерживает вызов функции — используется для поиска, чтобы не искать на каждую нажатую клавишу. */
function debounce(fn, waitMs) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), waitMs);
    };
}

/**
 * Строка "хлебных крошек" типа "Предмет › Модуль › Подраздел" безопасным способом (без innerHTML).
 */
function buildBreadcrumbText(parts) {
    return parts.filter(Boolean).join(" › ");
}

/**
 * Инициализация выпадающего глобального поиска в шапке сайта.
 * records — уже разобранные записи из loadRecords().
 */
function initGlobalSearch(records) {
    const input = document.getElementById("global-search");
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

        const addResult = (key, icon, text, url, external) => {
            if (seen.has(key)) return;
            seen.add(key);
            results.push({ icon, text, url, external });
        };

        for (const rec of records) {
            const subjectUrl = buildSubjectUrl(rec.subjectId);

            if (rec.subjectTitle.toLowerCase().includes(query)) {
                addResult(`subj_${rec.subjectId}`, "📁", `Предмет: ${rec.subjectTitle}`, subjectUrl, false);
            }
            if (rec.moduleTitle && rec.moduleTitle.toLowerCase().includes(query)) {
                addResult(`mod_${rec.subjectId}_${rec.moduleTitle}`, "📚", buildBreadcrumbText([rec.subjectTitle, rec.moduleTitle]), subjectUrl, false);
            }
            if (rec.subtopicTitle && rec.subtopicTitle.toLowerCase().includes(query)) {
                addResult(`sub_${rec.subjectId}_${rec.moduleTitle}_${rec.subtopicTitle}`, "📌", buildBreadcrumbText([rec.subjectTitle, rec.moduleTitle, rec.subtopicTitle]), subjectUrl, false);
            }
            if (rec.itemName && rec.itemName.toLowerCase().includes(query)) {
                const safeUrl = sanitizeUrl(rec.itemUrl);
                addResult(
                    `item_${rec.itemName}_${rec.itemUrl}`,
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

        results.slice(0, 10).forEach((item) => {
            const a = document.createElement("a");
            a.href = item.url;
            a.className = "search-item";
            a.setAttribute("role", "option");
            a.textContent = `${item.icon} ${item.text}`;
            if (item.external) {
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            }
            dropdown.appendChild(a);
        });

        dropdown.style.display = "block";
        dropdown.setAttribute("aria-expanded", "true");
    };

    input.addEventListener("input", debounce((e) => runSearch(e.target.value), 200));

    input.addEventListener("keydown", (e) => {
        const items = Array.from(dropdown.querySelectorAll(".search-item:not(.empty)"));
        if (e.key === "Escape") {
            dropdown.style.display = "none";
            dropdown.setAttribute("aria-expanded", "false");
            return;
        }
        if (items.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            items[activeIndex].focus();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            items[activeIndex].focus();
        }
    });

    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = "none";
            dropdown.setAttribute("aria-expanded", "false");
        }
    });
}
