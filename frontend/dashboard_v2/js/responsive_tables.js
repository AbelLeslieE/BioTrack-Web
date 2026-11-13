(() => {
    const content = document.getElementById("page-content");
    if (!content) return;

    const labelRows = table => {
        const headers = Array.from(table.querySelectorAll("thead th"), cell =>
            cell.textContent.replace(/\s+/g, " ").trim()
        );

        if (!headers.length) return;

        table.classList.add("mobile-card-table");
        table.querySelectorAll("tbody tr").forEach(row => {
            Array.from(row.cells).forEach((cell, index) => {
                if (cell.colSpan > 1) {
                    cell.removeAttribute("data-label");
                    return;
                }

                cell.dataset.label = headers[index] || "Details";
            });
        });
    };

    const labelTables = root => {
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        if (root.matches?.("table")) labelRows(root);
        root.querySelectorAll?.("table").forEach(labelRows);
    };

    labelTables(content);

    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(labelTables);

            if (mutation.type === "childList" && mutation.target.closest?.("tbody")) {
                const table = mutation.target.closest("table");
                if (table) labelRows(table);
            }
        });
    }).observe(content, { childList:true, subtree:true });
})();
