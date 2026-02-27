// Recent Wordle days - expandable cards showing row distribution and winners
(function() {
  var container = document.getElementById('recent-days');
  if (!container) return;

  fetch('/api/recent-days')
    .then(function(r) { return r.json(); })
    .then(function(data) { render(data.days); })
    .catch(function(err) {
      console.error('Failed to load recent days', err);
    });

  function render(days) {
    if (!days || days.length === 0) return;

    var html = '<h2 class="recent-days-title">Recent Wordles</h2>';
    html += '<div class="recent-days-list">';

    days.forEach(function(day, i) {
      var dateLabel = formatDate(day.dateKey);
      var wordleLabel = day.wordleNumber ? 'Wordle #' + day.wordleNumber : '';
      var playersLabel = day.totalPlayers.toLocaleString() + ' player' + (day.totalPlayers !== 1 ? 's' : '');

      html += '<div class="rd-card" data-index="' + i + '">';
      html += '<button class="rd-card-header" aria-expanded="false">';
      html += '<span class="rd-date">' + dateLabel + '</span>';
      html += '<span class="rd-meta">';
      if (wordleLabel) html += '<span class="rd-wordle">' + wordleLabel + '</span>';
      html += '<span class="rd-players">' + playersLabel + '</span>';
      html += '</span>';
      html += '<span class="rd-chevron">&#9660;</span>';
      html += '</button>';

      html += '<div class="rd-detail" hidden>';
      // Distribution bars
      html += '<div class="rd-distribution">';
      var rowLabels = ['No Solve', 'Row 1', 'Row 2', 'Row 3', 'Row 4', 'Row 5', 'Row 6'];
      var order = [1, 2, 3, 4, 5, 6, 0]; // show rows 1-6, then no solve
      for (var j = 0; j < order.length; j++) {
        var idx = order[j];
        var pctNum = day.totalPlayers > 0 ? (day.solvedRowCounts[idx] / day.totalPlayers) * 100 : 0;
        html += '<div class="rd-row">';
        html += '<span class="rd-row-label">' + rowLabels[idx] + '</span>';
        html += '<progress max="100" value="' + pctNum.toFixed(1) + '"></progress>';
        html += '<span class="rd-row-count">' + day.solvedRowCounts[idx] + ' (' + day.solvedRowPercents[idx] + ')</span>';
        html += '</div>';
      }
      html += '</div>';

      // Winners
      if (day.winners.length > 0) {
        html += '<div class="rd-winners">';
        var winnerTitle = day.winners.length === 1 ? 'Top Scorer' : 'Top Scorers (tied)';
        html += '<h4 class="rd-winners-title">' + winnerTitle + '</h4>';
        html += '<ul class="rd-winner-list">';
        day.winners.forEach(function(w) {
          var name = escapeHtml(w.screenName || 'Unknown');
          var link = w.url ? '<a href="' + escapeHtml(w.url) + '" target="_blank">' + name + '</a>' : name;
          html += '<li>' + link;
          html += ' <span class="rd-winner-score">' + w.score + ' pts</span>';
          html += ' <span class="rd-winner-row">Row ' + w.solvedRow + '</span>';
          html += ' <span class="tag">' + w.source + '</span>';
          html += '</li>';
        });
        html += '</ul>';
        html += '</div>';
      }

      html += '</div>'; // .rd-detail
      html += '</div>'; // .rd-card
    });

    html += '</div>';
    container.innerHTML = html;

    // Expand/collapse
    container.addEventListener('click', function(e) {
      var btn = e.target.closest('.rd-card-header');
      if (!btn) return;
      var card = btn.closest('.rd-card');
      var detail = card.querySelector('.rd-detail');
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      detail.hidden = expanded;
      card.classList.toggle('rd-expanded', !expanded);
    });
  }

  function formatDate(dateKey) {
    // dateKey is "YYYY-MM-DD" — parse as local
    var parts = dateKey.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
