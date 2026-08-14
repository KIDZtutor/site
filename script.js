document.addEventListener("DOMContentLoaded", () => {
    const subjectsList = document.getElementById("subjects-list");
    const searchInput = document.getElementById("global-search");
    const dropdown = document.getElementById("search-dropdown");

    function setupSearch(data) {
        if (!searchInput || !dropdown) return;

        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            dropdown.innerHTML = "";

            if (query.length < 2) {
                dropdown.style.display = "none";
                return;
            }

            let results = [];
            data.forEach(subject => {
                if (subject.title.toLowerCase().includes(query)) {
                    results.push({
                        text: `📁 Предмет: ${subject.title}`,
                        url: `subject.html?id=${subject.id}`
                    });
                }
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

            results.slice(0, 8).forEach(item => {
                const a = document.createElement("a");
                a.href = item.url;
                a.className = "search-item";
                a.textContent = item.text;
                dropdown.appendChild(a);
            });

            dropdown.style.display = "block";
        });

        document.addEventListener("click", (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = "none";
            }
        });
    }

    fetch("data.json")
        .then(response => response.json())
        .then(data => {
            setupSearch(data);

            if (subjectsList) {
                subjectsList.innerHTML = "";
                data.forEach(subject => {
                    const li = document.createElement("li");
                    const a = document.createElement("a");
                    a.href = `subject.html?id=${subject.id}`;
                    a.textContent = subject.title;
                    li.appendChild(a);
                    subjectsList.appendChild(li);
                });
            }
        })
        .catch(error => {
            console.error("Ошибка:", error);
            if (subjectsList) subjectsList.innerHTML = "<li>Ошибка загрузки данных.</li>";
        });
});