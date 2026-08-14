document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("global-search");
    if (!searchInput) return;

    // Создаем контейнер для выпадающих результатов поиска под инпутом
    const dropdown = document.createElement("div");
    dropdown.className = "search-dropdown";
    searchInput.parentNode.appendChild(dropdown);

    let searchData = [];

    // Загружаем общую базу данных для поиска
    fetch("data.json")
        .then(response => response.json())
        .then(data => {
            searchData = data;
        });

    // Обработка ввода текста
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        dropdown.innerHTML = "";

        if (query.length < 2) {
            dropdown.style.display = "none";
            return;
        }

        let results = [];

        // Ищем по предметам и темам
        searchData.forEach(subject => {
            // Если название предмета совпало
            if (subject.title.toLowerCase().includes(query)) {
                results.push({
                    text: `📁 Предмет: ${subject.title}`,
                    url: `subject.html?id=${subject.id}`
                });
            }

            // Ищем внутри тем предмета
            if (subject.topics) {
                subject.topics.forEach(topic => {
                    if (topic.title.toLowerCase().includes(query)) {
                        results.push({
                            text: `📄 ${subject.title} — ${topic.title}`,
                            url: `subject.html?id=${subject.id}`
                        });
                    }
                });
            }
        });

        if (results.length === 0) {
            dropdown.innerHTML = "<div class='search-item'>Ничего не найдено</div>";
            dropdown.style.display = "block";
            return;
        }

        // Ограничим выдачу первыми 8 результатами для красоты
        results.slice(0, 8).forEach(item => {
            const a = document.createElement("a");
            a.href = item.url;
            a.className = "search-item";
            a.textContent = item.text;
            dropdown.appendChild(a);
        });

        dropdown.style.display = "block";
    });

    // Закрываем выпадающий список при клике вне поиска
    document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = "none";
        }
    });
});