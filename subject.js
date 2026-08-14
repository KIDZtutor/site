// СЮДА ВСТАВЬ ССЫЛКУ НА CSV ИЗ ТАБЛИЦЫ!
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQo1BTijFHbQ-9CccGiWTz8cP-uzybyEsAdOyn9ce5TdwvKEDgMWnj1yye9kNBbhaJk66pCI5O-4GUU/pub?output=csv";

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const subjectId = urlParams.get("id");

    const titleElement = document.getElementById("subject-title");
    const container = document.getElementById("topics-container");

    // Функция для парсинга CSV с учетом кавычек
    function parseCSV(text) {
        const rows = [];
        let row = [];
        let inQuotes = false;
        let current = "";
        
        for (let i = 0; i < text.length; i++) {
            let c = text[i];
            let next = text[i+1];
            
            if (c === '"' && inQuotes && next === '"') {
                current += '"'; i++;
            } else if (c === '"') {
                inQuotes = !inQuotes;
            } else if (c === ',' && !inQuotes) {
                row.push(current.trim()); current = "";
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') i++;
                row.push(current.trim());
                if (row.length > 1 && row[0] !== "subject_id") rows.push(row);
                row = []; current = "";
            } else {
                current += c;
            }
        }
        if (current !== "" || row.length > 0) {
            row.push(current.trim());
            if (row.length > 1 && row[0] !== "subject_id") rows.push(row);
        }
        return rows;
    }

    // Собираем плоские строки из таблицы в структуру (Модули -> Подразделы -> Файлы)
    function buildDataStructure(rows) {
        console.log("Все строки из таблицы:", rows); // <--- ПОСМОТРИМ, ЧТО ПРИШЛО ИЗ ГУГЛА
        const subjects = {};

        rows.forEach(r => {
            const [s_id, s_title, m_title, m_desc, sub_title, i_type, i_name, i_url] = r;
            if (!s_id) return;

            if (!subjects[s_id]) {
                subjects[s_id] = { id: s_id, title: s_title, topics: {} };
            }

            if (m_title && !subjects[s_id].topics[m_title]) {
                subjects[s_id].topics[m_title] = {
                    title: m_title,
                    description: m_desc || "",
                    files: [],
                    links: [],
                    subtopics: {}
                };
            }

            const topic = subjects[s_id].topics[m_title];

            if (i_name && i_url) {
                const item = { name: i_name, url: i_url };
                
                // Поддерживаем и английские, и русские типы
                const isFile = i_type === "file" || i_type === "файл";

                if (sub_title) {
                    if (!topic.subtopics[sub_title]) {
                        topic.subtopics[sub_title] = { title: sub_title, files: [], links: [] };
                    }
                    if (isFile) topic.subtopics[sub_title].files.push(item);
                    else topic.subtopics[sub_title].links.push(item);
                } else {
                    if (isFile) topic.files.push(item);
                    else topic.links.push(item);
                }
            }
        });

        console.log("Собранная структура предметов:", subjects); // <--- ПОСМОТРИМ, ЧТО СГРУППИРОВАЛОСЬ
        return Object.values(subjects).map(sub => {
            sub.topics = Object.values(sub.topics).map(top => {
                top.subtopics = Object.values(top.subtopics);
                return top;
            });
            return sub;
        });
    }

    // Загрузка и отрисовка
   fetch(CSV_URL + "&t=" + new Date().getTime())
        .then(res => res.text())
        .then(csvText => {
            const rows = parseCSV(csvText);
            const data = buildDataStructure(rows);
            
            // Запускаем глобальный поиск (если функция есть в search.js)
            if (typeof setupSearch === 'function') setupSearch(data);

            const subject = data.find(s => s.id === subjectId);
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

                // Кнопки основного модуля
                let linksHtml = "";
                topic.files.forEach(f => linksHtml += `<a href="${f.url}" target="_blank">📄 ${f.name}</a>`);
                topic.links.forEach(l => linksHtml += `<a href="${l.url}" target="_blank">🔗 ${l.name}</a>`);
                if (linksHtml) html += `<div class="materials-links">${linksHtml}</div>`;

                // Отрисовка подразделов
                if (topic.subtopics.length > 0) {
                    let subHtml = `<div class="subtopics-container">`;
                    topic.subtopics.forEach(sub => {
                        subHtml += `<div class="subtopic"><h4>${sub.title}</h4>`;
                        let subLinks = "";
                        sub.files.forEach(f => subLinks += `<a href="${f.url}" target="_blank">📄 ${f.name}</a>`);
                        sub.links.forEach(l => subLinks += `<a href="${l.url}" target="_blank">🔗 ${l.name}</a>`);
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
            if (container) container.innerHTML = "<p>Ошибка связи с Гугл Таблицей.</p>";
        });
});