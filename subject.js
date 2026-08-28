/*
 * subject.js — логика страницы предмета (subject.html).
 * Требует shared.js, подключённый ДО этого файла.
 */

document.addEventListener("DOMContentLoaded", init);

async function init() {
    // Инициализируем переключатель курсов в шапке
    initYearSwitcher();

    const params = new URLSearchParams(window.location.search);
    const subjectId = params.get("id");
    const year = getCurrentYear();

    // Кнопка "Назад" ведёт на главную того же курса
    const backLink = document.getElementById("back-link");
    if (backLink) backLink.href = "index.html?year=" + year;

    const titleEl   = document.getElementById("subject-title");
    const container = document.getElementById("topics-container");

    if (!subjectId) {
        setTitle(titleEl, "Предмет не выбран");
        renderMessage(container, "Вернитесь на главную страницу и выберите предмет.");
        return;
    }

    try {
        const records = await loadRecords();
        initGlobalSearch(records);

        const subject = buildSubject(records, subjectId);
        if (!subject) {
            setTitle(titleEl, "Предмет не найден");
            renderMessage(container, "Такого предмета нет в архиве, или таблица пока пуста для него.");
            return;
        }

        setTitle(titleEl, subject.title);
        renderTopics(subject, container);
    } catch (err) {
        console.error("Ошибка при загрузке данных:", err);
        renderMessage(container, "Не удалось загрузить материалы. Проверьте интернет-соединение и обновите страницу.");
    }
}

function setTitle(titleEl, text) {
    if (titleEl) titleEl.textContent = text;
    document.title = `${text} | Архив КИДЗ`;
}

function renderMessage(container, text) {
    if (!container) return;
    container.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = text;
    container.appendChild(p);
}

function buildSubject(records, subjectId) {
    const rows = records.filter(r => r.subjectId === subjectId);
    if (rows.length === 0) return null;

    const title = rows[0].subjectTitle;
    const topicsByTitle = new Map();

    for (const row of rows) {
        const topicKey = row.moduleTitle || "Без темы";

        if (!topicsByTitle.has(topicKey)) {
            topicsByTitle.set(topicKey, {
                title: topicKey,
                description: row.moduleDesc || "",
                materials: [],
                subtopicsByTitle: new Map()
            });
        }
        const topic = topicsByTitle.get(topicKey);

        if (!topic.description && row.moduleDesc) topic.description = row.moduleDesc;
        if (!row.itemName || !row.itemUrl) continue;

        const safeUrl = sanitizeUrl(row.itemUrl);
        if (!safeUrl) continue;

        const material = {
            name: row.itemName,
            url: safeUrl,
            icon: getIconForItem(row.itemType, row.itemUrl, row.itemName)
        };

        if (row.subtopicTitle) {
            if (!topic.subtopicsByTitle.has(row.subtopicTitle)) {
                topic.subtopicsByTitle.set(row.subtopicTitle, { title: row.subtopicTitle, materials: [] });
            }
            topic.subtopicsByTitle.get(row.subtopicTitle).materials.push(material);
        } else {
            topic.materials.push(material);
        }
    }

    const topics = Array.from(topicsByTitle.values()).map(t => ({
        title: t.title,
        description: t.description,
        materials: t.materials,
        subtopics: Array.from(t.subtopicsByTitle.values())
    }));

    return { title, topics };
}

function renderTopics(subject, container) {
    if (!container) return;
    container.innerHTML = "";

    if (subject.topics.length === 0) {
        renderMessage(container, "Для этого предмета пока нет материалов.");
        return;
    }

    subject.topics.forEach((topic, index) => container.appendChild(buildTopicBox(topic, index)));
}

function buildTopicBox(topic, index) {
    const box = document.createElement("div");
    box.className = "topic-box collapsed";

    const heading = document.createElement("h3");
    heading.textContent = topic.title;
    heading.tabIndex = 0;
    heading.setAttribute("role", "button");
    heading.setAttribute("aria-expanded", "false");
    const contentId = `topic-content-${index}`;
    heading.setAttribute("aria-controls", contentId);

    const toggle = () => {
        const collapsed = box.classList.toggle("collapsed");
        heading.setAttribute("aria-expanded", String(!collapsed));
    };
    heading.addEventListener("click", toggle);
    heading.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });

    box.appendChild(heading);

    const content = document.createElement("div");
    content.id = contentId;
    content.className = "topic-content";

    if (topic.description) {
        const desc = document.createElement("p");
        desc.className = "topic-desc";
        desc.textContent = topic.description;
        content.appendChild(desc);
    }

    if (topic.materials.length > 0) content.appendChild(buildMaterialsLinks(topic.materials));

    if (topic.subtopics.length > 0) {
        const subContainer = document.createElement("div");
        subContainer.className = "subtopics-container";

        topic.subtopics.forEach(sub => {
            const subBox = document.createElement("div");
            subBox.className = "subtopic";
            const subHeading = document.createElement("h4");
            subHeading.textContent = sub.title;
            subBox.appendChild(subHeading);
            if (sub.materials.length > 0) subBox.appendChild(buildMaterialsLinks(sub.materials));
            subContainer.appendChild(subBox);
        });

        content.appendChild(subContainer);
    }

    box.appendChild(content);
    return box;
}

function buildMaterialsLinks(materials) {
    const wrap = document.createElement("div");
    wrap.className = "materials-links";

    for (const m of materials) {
        const a = document.createElement("a");
        a.href = m.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";

        const iconSpan = document.createElement("span");
        iconSpan.setAttribute("aria-hidden", "true");
        iconSpan.textContent = m.icon;
        a.appendChild(iconSpan);
        a.appendChild(document.createTextNode(" " + m.name));

        wrap.appendChild(a);
    }

    return wrap;
}
