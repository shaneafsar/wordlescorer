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
      <button type="submit">Search</button>
    </form>
  `;

  const form = document.getElementById('search-form');

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
    const params = new URLSearchParams({ ...currentParams, page: currentPage, pageSize: 20 });
    fetch('/api/search?' + params.toString())
      .then(r => r.json())
      .then(renderResults)
      .catch(err => {
        wordlesContainer.innerHTML = '<p>Error loading results.</p>';
        console.error(err);
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
