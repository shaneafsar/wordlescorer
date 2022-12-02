
function imageLoadFailure(e) {
  console.log('failed!', e, arguments);
}

const search = instantsearch({
  indexName: 'analyzedwordles',
  searchClient: algoliasearch('EO8V4J92JS', 'b7f12a56d0c6478b02c0c7891a31e10b'),
});

search.addWidgets([
  instantsearch.widgets.searchBox({
    container: '#searchbox',
    placeholder: 'Search for usernames, wordle number, scores, tweet ID'
  }),
  
  instantsearch.widgets.clearRefinements({
    container: '#clear-refinements',
  }),
  
  instantsearch.widgets.refinementList({
    container: '#name-list',
    attribute: 'scorerName',
  }),

  instantsearch.widgets.refinementList({
    container: '#wordle_number-list',
    attribute: 'wordleNumber'
  }),
  
  instantsearch.widgets.refinementList({
    container: '#solved_row-list',
    attribute: 'solvedRow',
    transformItems(items) {
      return items.map(item => { 
        if (item.label === '0') { 
          item.label = 'Not solved';
          item.highlighted = 'Not solved';
        } 
        return item; 
      });
    }
  }),

  instantsearch.widgets.stats({
    container: '#stats',
  }),

  instantsearch.widgets.refinementList({
    container: '#toggle-auto-score',
    attribute: 'autoScore',
    transformItems(items) {
      return items.map(item => { 
        if (item.label === 'true') { 
          const label = 'Filter to auto-scored results'
          item.label = label;
          item.highlighted = label;
        } 
        return item; 
      });
    }
  }),

  instantsearch.widgets.numericMenu({
    container: '#scores-list',
    attribute: 'score',
    items: [
      { label: 'All' },
      { label: 'Less than 100', end: 100 },
      { label: 'Between 100 - 200', start: 100, end: 200 },
      { label: 'Between 200 - 250', start: 200, end: 250 },
      { label: 'More than 250', start: 250 }
    ],
  }),

  instantsearch.widgets.hits({
    container: '#wordles',
    templates: {
      item: (val, { html, components }) => html`
        <article class="wordle">
          <img class='profile-image' src="${val.photoUrl}" alt="profile image for ${val.scorerName}" data-default="https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"/>
          <a class="wordle-title${val.date_timestamp > 1666286675 && !val.autoScore ? ' mentioned':''}" href="https://www.twitter.com/${val.scorerName}/status/${val.id}">
          ${val.scorerName}</a>
          <ul>
            ${val.score && html`
              <li>Score: ${val.score}</li>
            `}
            ${val.wordleNumber && html`
              <li>Wordle ${val.wordleNumber}</li>
            `}
            ${val.solvedRow ? html`
              <li>Solved on Row ${val.solvedRow}</li>
            ` : html`
              <li>Not solved</li>
            `}
            ${val.date_timestamp && html`
            <li><time>${(new Date(val.date_timestamp * 1000)).toLocaleDateString("en-US")}</time></li>
            `}
          </ul>
        </article>
      `,
    }
  }),

  instantsearch.widgets.pagination({
    container: '#pagination',
    scrollTo: '#pagination'
  })
]);

// 5. Start the search!
search.start();