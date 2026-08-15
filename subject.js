const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQo1BTijFHbQ-9CccGiWTz8cP-uzybyEsAdOyn9ce5TdwvKEDgMWnj1yye9kNBbhaJk66pCI5O-4GUU/pub?output=csv";

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const subjectName = urlParams.get("name");

    const titleElement = document.getElementById("subject-title");
    const container = document.getElementById("topics-container");

    if (!subjectName) {
        if (titleElement) titleElement.textContent = "Предмет не выбран";
        if (container) container.innerHTML = "<p>Вернитесь на главную страницу и выберите предмет.</p>";
        return;
    }

    function getIconForLink(url = "", name = "") {
    const u = url.toLowerCase();
    const n = name.toLowerCase();

    // 1. Видео
    if (u.includes("youtu") || u.includes("rutube") || u.includes("vimeo") || u.endsWith(".mp4") || n.includes("видео") || n.includes("плейлист")) {
        return "🎥";
    }
    
    // 2. Презентации
    if (u.includes("docs.google.com/presentation") || u.endsWith(".ppt") || u.endsWith(".pptx") || n.endsWith(".ppt") || n.endsWith(".pptx") || n.includes("презентаци") || n.includes("слайд")) {
        return "🖼️";
    }
    
    // 3. Файлы и документы (Google Диск, Документы, PDF, Word, Excel + ключевые слова в названии)
    if (u.includes("drive.google.com") || u.includes("docs.google.com/document") || u.includes("docs.google.com/spreadsheets") || u.endsWith(".pdf") || u.endsWith(".doc") || u.endsWith(".docx") || n.includes("учебник") || n.includes("атлас") || n.includes("документ") || n.includes("файл") || n.includes("книг")) {
        return "📄";
    }
    
    // 4. Все остальные внешние ссылки (например, сторонние сайты и приложения)
    return "🔗"; 
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

    function getSubjectData(rows, targetName) {
        const subject = { title: targetName, topics: {} };
        let hasData = false;

        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.length < 8) continue;

            const s_title = r[1]?.trim();
            if (s_title !== targetName) continue;
            
            hasData = true;

            const m_title = r[2]?.trim();
            const m_desc = r[3]?.trim();
            const sub_title = r[4]?.trim();
            const i_name = r[6]?.trim();
            const i_url = r[7]?.trim();

            if (m_title && !subject.topics[m_title]) {
                subject.topics[m_title] = {
                    title: m_title,
                    description: m_desc || "",
                    materials: [],
                    subtopics: {}
                };
            }

            if (m_title && i_name && i_url) {
                const topic = subject.topics[m_title];
                const item = { name: i_name, url: i_url };

                if (sub_title) {
                    if (!topic.subtopics[sub_title]) {
                        topic.subtopics[sub_title] = { title: sub_title, materials: [] };
                    }
                    topic.subtopics[sub_title].materials.push(item);
                } else {
                    topic.materials.push(item);
                }
            }
        }

        if (!hasData) return null;

        subject.topics = Object.values(subject.topics).map(top => {
            top.subtopics = Object.values(top.subtopics);
            return top;
        });

        return subject;
    }

    fetch(CSV_URL + "&t=" + new Date().getTime())
        .then(res => res.text())
        .then(csvText => {
            const rows = parseCSV(csvText);
            
            // Включаем глобальный поиск внутри страницы предмета
            initGlobalSearch(rows);

            const subject = getSubjectData(rows, subjectName);
            
            if (!subject) {
                if (titleElement) titleElement.textContent = "Предмет не найден";
                if (container) container.innerHTML = "<p>Такого предмета нет в архиве или таблица пуста.</p>";
                return;
            }

            if (titleElement) titleElement.textContent = subject.title;
            if (container) container.innerHTML = "";

            subject.topics.forEach(topic => {
                const box = document.createElement("div");
                box.className = "topic-box";
                
                let html = `<h3>${topic.title}</h3>`;
                if (topic.description) html += `<p class="topic-desc">${topic.description}</p>`;

                let linksHtml = "";
                topic.materials.forEach(m => {
                    const icon = getIconForLink(m.url, m.name);
                    linksHtml += `<a href="${m.url}" target="_blank" rel="noopener noreferrer">${icon} ${m.name}</a>`;
                });
                if (linksHtml) html += `<div class="materials-links">${linksHtml}</div>`;

                if (topic.subtopics.length > 0) {
                    let subHtml = `<div class="subtopics-container">`;
                    topic.subtopics.forEach(sub => {
                        subHtml += `<div class="subtopic"><h4>${sub.title}</h4>`;
                        let subLinks = "";
                        sub.materials.forEach(m => {
                            const icon = getIconForLink(m.url, m.name);
                            subLinks += `<a href="${m.url}" target="_blank" rel="noopener noreferrer">${icon} ${m.name}</a>`;
                        });
                        if (subLinks) subHtml += `<div class="materials-links">${subLinks}</div>`;
                        subHtml += `</div>`;
                    });
                    subHtml += `</div>`;
                    html += subHtml;
                }

                box.innerHTML = html;
                container.appendChild(box);
            });
        })
        .catch(err => {
            console.error(err);
            if (container) container.innerHTML = "<p>Ошибка связи с таблицей.</p>";
        });

    document.addEventListener("click", (event) => {
        const h3 = event.target.closest(".topic-box h3");
        if (h3) {
            const topicBox = h3.closest(".topic-box");
            topicBox.classList.toggle("collapsed");
        }
    });
});

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

            if (subject.toLowerCase().includes(query)) {
                const key = `subj_${subject}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📁 Предмет: ${subject}`, url: subjectUrl });
                }
            }

            if (moduleTitle && moduleTitle.toLowerCase().includes(query)) {
                const key = `mod_${subject}_${moduleTitle}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📚 ${subject} › ${moduleTitle}`, url: subjectUrl });
                }
            }

            if (moduleDesc && moduleDesc.toLowerCase().includes(query)) {
                const key = `desc_${subject}_${moduleTitle}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📝 ${subject} › ${moduleTitle || 'Описание'}`, url: subjectUrl });
                }
            }

            if (subTitle && subTitle.toLowerCase().includes(query)) {
                const key = `sub_${subject}_${moduleTitle}_${subTitle}`;
                if (!addedTexts.has(key)) {
                    addedTexts.add(key);
                    results.push({ text: `📌 ${subject} › ${moduleTitle || ''} › ${subTitle}`, url: subjectUrl });
                }
            }

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