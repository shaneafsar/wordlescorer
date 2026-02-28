// Score search - queries the local SQLite-backed API
(function() {
  const searchbox = document.getElementById('searchbox');
  const wordlesContainer = document.getElementById('wordles');
  const paginationContainer = document.getElementById('pagination');
  const statsContainer = document.getElementById('stats');

  if (!searchbox) return;

  let currentPage = 0;
  let currentParams = {};

  searchbox.innerHTML = `
    <form id="search-form" class="search-form">
      <input type="text" name="q" placeholder="Search by username..." />
      <input type="number" name="wordleNumber" placeholder="Wordle #" min="1" />
      <select name="solvedRow">
        <option value="">Any row</option>
        <option value="1">Row 1</option>
        <option value="2">Row 2</option>
        <option value="3">Row 3</option>
        <option value="4">Row 4</option>
        <option value="5">Row 5</option>
        <option value="6">Row 6</option>
        <option value="0">Not solved</option>
      </select>
      <input type="number" name="scoreMin" placeholder="Min score" min="0" />
      <input type="number" name="scoreMax" placeholder="Max score" min="0" />
      <select name="autoScore">
        <option value="">All posts</option>
        <option value="0">@ Mentioned bot</option>
        <option value="1">Auto-scored</option>
      </select>
      <button type="submit">
        <span class="btn-label">Search</span>
        <span class="btn-spinner" aria-hidden="true"></span>
      </button>
      <span id="search-status" class="search-status" role="status" aria-live="polite"></span>
    </form>
  `;

  const form = document.getElementById('search-form');
  const wrapper = document.querySelector('.wrapper');
  const statusEl = document.getElementById('search-status');
  const submitButton = form.querySelector('button[type="submit"]');
  let activeRequestId = 0;

  function setLoadingState(isLoading) {
    form.classList.toggle('is-loading', isLoading);
    if (submitButton) submitButton.disabled = isLoading;
    if (statusEl) statusEl.textContent = isLoading ? 'Searching...' : '';
    if (wrapper) wrapper.classList.toggle('is-loading', isLoading);

    if (isLoading) {
      // Keep current result area height while loading to avoid layout jumps.
      const currentHeight = wordlesContainer.offsetHeight;
      if (currentHeight > 0) {
        wordlesContainer.style.minHeight = currentHeight + 'px';
      }
      wordlesContainer.setAttribute('aria-busy', 'true');
    } else {
      wordlesContainer.removeAttribute('aria-busy');
      requestAnimationFrame(function() {
        wordlesContainer.style.minHeight = '';
      });
    }
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    currentPage = 0;
    const formData = new FormData(form);
    currentParams = {};
    for (const [key, val] of formData.entries()) {
      if (val) currentParams[key] = val;
    }
    fetchResults();
  });

  function fetchResults() {
    const requestId = ++activeRequestId;
    setLoadingState(true);
    const params = new URLSearchParams({ ...currentParams, page: currentPage, pageSize: 20 });
    fetch('/api/search?' + params.toString())
      .then(function(r) {
        if (!r.ok) throw new Error('Search request failed with status ' + r.status);
        return r.json();
      })
      .then(function(data) {
        if (requestId !== activeRequestId) return;
        renderResults(data);
      })
      .catch(err => {
        if (requestId !== activeRequestId) return;
        wordlesContainer.innerHTML = '<p>Error loading results.</p>';
        console.error(err);
      })
      .finally(function() {
        if (requestId !== activeRequestId) return;
        setLoadingState(false);
      });
  }

  function renderResults(data) {
    if (statsContainer) {
      statsContainer.innerHTML = `<p>${data.total.toLocaleString()} results found</p>`;
    }

    if (data.hits.length === 0) {
      wordlesContainer.innerHTML = '<p>No results found.</p>';
      paginationContainer.innerHTML = '';
      return;
    }

    wordlesContainer.innerHTML = '<div class="results-grid">' + data.hits.map(function(val) {
      const dateStr = val.date_timestamp ? new Date(val.date_timestamp * 1000).toLocaleDateString('en-US') : '';
      const link = val.url || '#';
      return `
        <article class="result-card">
          <div class="card-header">
            <a href="${link}" target="_blank">${escapeHtml(val.scorerName)}</a>
            ${val.score != null ? '<span class="card-score">' + val.score + '</span>' : ''}
          </div>
          <div class="card-tags">
            ${val.wordleNumber ? '<span class="tag">Wordle #' + val.wordleNumber + '</span>' : ''}
            ${val.solvedRow ? '<span class="tag">Row ' + val.solvedRow + '</span>' : '<span class="tag">Not solved</span>'}
            ${!val.autoScore ? '<span class="tag tag-mention">@</span>' : ''}
            ${dateStr ? '<span class="tag">' + dateStr + '</span>' : ''}
          </div>
        </article>
      `;
    }).join('') + '</div>';

    // Pagination
    if (data.totalPages > 1) {
      let html = '<div class="pagination">';
      if (currentPage > 0) {
        html += '<a href="#" class="page-link" data-page="' + (currentPage - 1) + '">&laquo; Prev</a>';
      }
      html += '<span>Page ' + (currentPage + 1) + ' of ' + data.totalPages + '</span>';
      if (currentPage < data.totalPages - 1) {
        html += '<a href="#" class="page-link" data-page="' + (currentPage + 1) + '">Next &raquo;</a>';
      }
      html += '</div>';
      paginationContainer.innerHTML = html;

      paginationContainer.querySelectorAll('.page-link').forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          currentPage = parseInt(this.dataset.page, 10);
          fetchResults();
          searchbox.scrollIntoView({ behavior: 'smooth' });
        });
      });
    } else {
      paginationContainer.innerHTML = '';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Auto-load initial results
  fetchResults();
})();
