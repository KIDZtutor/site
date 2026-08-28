/*
 * home.js — логика главной страницы (index.html):
 * строит список предметов из загруженных записей.
 * Требует shared.js, подключённый ДО этого файла.
 */

document.addEventListener("DOMContentLoaded", init);

async function init() {
    const listEl = document.getElementById("subjects-list");

    try {
        const records = await loadRecords();
        initGlobalSearch(records);
        renderSubjects(records, listEl);
    } catch (err) {
        console.error("Ошибка при загрузке данных:", err);
        renderError(listEl);
    }
}

/** Собирает список уникальных предметов. */
function collectSubjects(records) {
    const bySubject = new Map();

    for (const rec of records) {
        if (!bySubject.has(rec.subjectId)) {
            bySubject.set(rec.subjectId, {
                id: rec.subjectId,
                title: rec.subjectTitle
            });
        }
    }

    const subjects = Array.from(bySubject.values());
    subjects.sort((a, b) => a.title.localeCompare(b.title, "ru"));

    // "Прочее" всегда в конце списка, если такой предмет есть
    const otherIndex = subjects.findIndex(s => s.title.toLowerCase() === "прочее");
    if (otherIndex !== -1) {
        const [other] = subjects.splice(otherIndex, 1);
        subjects.push(other);
    }

    return subjects;
}

function renderSubjects(records, container) {
    if (!container) return;
    const subjects = collectSubjects(records);

    container.innerHTML = "";

    if (subjects.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Предметы пока не добавлены.";
        container.appendChild(li);
        return;
    }

    for (const subject of subjects) {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = buildSubjectUrl(subject.id);
        link.textContent = subject.title;

        li.appendChild(link);
        container.appendChild(li);
    }
}

function renderError(container) {
    if (!container) return;
    container.innerHTML = "";
    const li = document.createElement("li");
    li.className = "load-error";
    li.textContent = "Не удалось загрузить список предметов. Проверьте интернет-соединение и обновите страницу.";
    container.appendChild(li);
}
