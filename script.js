const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQo1BTijFHbQ-9CccGiWTz8cP-uzybyEsAdOyn9ce5TdwvKEDgMWnj1yye9kNBbhaJk66pCI5O-4GUU/pub?output=csv";

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    try {
        const text = await fetchCSV(CSV_URL);
        const rows = parseCSV(text);
        
        const subjectsList = document.getElementById('subjects-list');
        if (subjectsList) {
            const subjects = processSubjects(rows);
            renderSubjects(subjects);
        }

        initGlobalSearch(rows);

    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        const container = document.getElementById('subjects-list');
        if (container) container.innerHTML = '<li>Ошибка загрузки данных</li>';
    }
}

async function fetchCSV(url) {
    const response = await fetch(url + "&t=" + new Date().getTime());
    if (!response.ok) throw new Error('Сетевая ошибка при загрузке CSV');
    return await response.text();
}

function parseCSV(text) {
    const arr = [];
    let quote = false;
    let row = 0;
    let col = 0;
    for (let c = 0; c < text.length; c++) {
        let cc = text[c], nc = text[c + 1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';

        if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { ++col; continue; }
        if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; continue; }
        if (cc === '\n' && !quote) { ++row; col = 0; continue; }
        if (cc === '\r' && !quote) { ++row; col = 0; continue; }
        arr[row][col] += cc;
    }
    return arr;
}

function processSubjects(rows) {
    if (!rows || rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim().toLowerCase());
    let subjectColIndex = headers.findIndex(h => h.includes('предмет') || h.includes('subject_title'));
    if (subjectColIndex === -1) subjectColIndex = 1;

    const subjectsSet = new Set();
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const subjectName = row[subjectColIndex]?.trim();
        if (subjectName) subjectsSet.add(subjectName);
    }

    let subjects = Array.from(subjectsSet);
    subjects.sort((a, b) => a.localeCompare(b, 'ru'));

    const otherIndex = subjects.findIndex(s => s.toLowerCase() === 'прочее');
    if (otherIndex !== -1) {
        const other = subjects.splice(otherIndex, 1)[0];
        subjects.push(other);
    }

    return subjects;
}

function renderSubjects(subjects) {
    const container = document.getElementById('subjects-list');
    if (!container) return;

    container.innerHTML = '';
    subjects.forEach(subject => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `subject.html?name=${encodeURIComponent(subject)}`;
        link.textContent = subject;
        li.appendChild(link);
        container.appendChild(li);
    });
}

function initGlobalSearch(rows) {
    const searchInput = document.getElementById('global-search');
    const dropdown = document.getElementById('search-dropdown');

    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('input', (event) => {
        const query = event.target.value.toLowerCase().trim();
        dropdown.innerHTML = "";

        if (query.length < 2) {
            dropdown.style.display = "none";
            return;
        }

        const results = [];
        const addedTexts = new Set();

        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.length < 8) continue;

            const subject = r[1]?.trim();
            const moduleTitle = r[2]?.trim();
            const moduleDesc = r[3]?.trim();
            const subTitle = r[4]?.trim();
            const itemName = r[6]?.trim();
            const itemUrl = r[7]?.trim();

            if (!subject) continue;
            const subjectUrl = `subject.html?name=${encodeURIComponent(subject)}`;

            // 1. Поиск по предмету
            if (subject.toLowerCase().includes(query)) {
                const key = `subj_${subject}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📁 Предмет: ${subject}`, url: subjectUrl });
                }
            }

            // 2. Поиск по заголовку модуля (темы)
            if (moduleTitle && moduleTitle.toLowerCase().includes(query)) {
                const key = `mod_${subject}_${moduleTitle}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📚 ${subject} › ${moduleTitle}`, url: subjectUrl });
                }
            }

            // 3. Поиск по описанию модуля
            if (moduleDesc && moduleDesc.toLowerCase().includes(query)) {
                const key = `desc_${subject}_${moduleTitle}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📝 ${subject} › ${moduleTitle || 'Описание'}`, url: subjectUrl });
                }
            }

            // 4. Поиск по подразделам
            if (subTitle && subTitle.toLowerCase().includes(query)) {
                const key = `sub_${subject}_${moduleTitle}_${subTitle}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📌 ${subject} › ${moduleTitle || ''} › ${subTitle}`, url: subjectUrl });
                }
            }

            // 5. Поиск по названию файлов и ссылок
            if (itemName && itemName.toLowerCase().includes(query)) {
                const key = `item_${itemName}_${itemUrl}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ 
                        text: `📄 ${subject} › ${itemName}`, 
                        url: itemUrl || subjectUrl,
                        external: !!itemUrl 
                    });
                }
            }
        }

        if (results.length === 0) {
            dropdown.innerHTML = "<div class='search-item empty'>Ничего не найдено</div>";
            dropdown.style.display = "block";
            return;
        }

        results.slice(0, 10).forEach((item) => {
            const a = document.createElement("a");
            a.href = item.url;
            a.className = "search-item";
            a.textContent = item.text;
            if (item.external) {
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            }
            dropdown.appendChild(a);
        });

        dropdown.style.display = "block";
    });

    document.addEventListener("click", (event) => {
        if (!searchInput.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.style.display = "none";
        }
    });
}