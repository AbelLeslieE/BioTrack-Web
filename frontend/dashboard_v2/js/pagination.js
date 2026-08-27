/* Shared client-side pagination for the data tables in BioTrack. */
(function () {
    const PAGE_SIZES = [10, 25, 50, 100];

    function renderPagination(container, state, totalItems, onChange, label = "items") {
        if (!container) return;

        const pageSize = PAGE_SIZES.includes(Number(state.pageSize))
            ? Number(state.pageSize)
            : PAGE_SIZES[0];
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const page = Math.min(Math.max(1, Number(state.page) || 1), totalPages);

        state.page = page;
        state.pageSize = pageSize;

        if (totalItems === 0) {
            container.innerHTML = "";
            return;
        }

        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, totalItems);
        const pageButtons = [];

        for (let value = Math.max(1, page - 2); value <= Math.min(totalPages, page + 2); value += 1) {
            pageButtons.push(`<button type="button" class="pagination-page ${value === page ? "is-active" : ""}" data-page="${value}" aria-label="Page ${value}">${value}</button>`);
        }

        container.innerHTML = `
            <div class="pagination-summary">Showing ${start}-${end} of ${totalItems} ${label}</div>
            <div class="pagination-controls">
                <label class="pagination-size-label">Rows per page
                    <select class="pagination-size" aria-label="Rows per page">
                        ${PAGE_SIZES.map(size => `<option value="${size}" ${size === pageSize ? "selected" : ""}>${size}</option>`).join("")}
                    </select>
                </label>
                <div class="pagination-pages" aria-label="Pagination">
                    <button type="button" class="pagination-page" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>Previous</button>
                    ${pageButtons.join("")}
                    <button type="button" class="pagination-page" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>Next</button>
                </div>
            </div>
        `;

        container.querySelector(".pagination-size").addEventListener("change", (event) => {
            state.pageSize = Number(event.target.value);
            state.page = 1;
            onChange();
        });

        container.querySelectorAll("[data-page]").forEach((button) => {
            button.addEventListener("click", () => {
                const nextPage = Number(button.dataset.page);
                if (nextPage < 1 || nextPage > totalPages || nextPage === state.page) return;
                state.page = nextPage;
                onChange();
            });
        });
    }

    window.TablePagination = {
        pageItems(items, state) {
            const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
            state.page = Math.min(Math.max(1, state.page), totalPages);
            const start = (state.page - 1) * state.pageSize;
            return items.slice(start, start + state.pageSize);
        },
        render: renderPagination,
    };
})();
