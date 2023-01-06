const APP_ID = 'EO8V4J92JS';
const APP_SEARCH_KEY = 'b7f12a56d0c6478b02c0c7891a31e10b';

const search = instantsearch({
  indexName: 'analyzedwordles',
  searchClient: algoliasearch(APP_ID, APP_SEARCH_KEY),
  searchParameters: {
    clickAnalytics: true,
  }
});

const insightsMiddleware = instantsearch.middlewares.createInsightsMiddleware({
  insightsClient: window.aa,
  insightsInitParams: {
    useCookie: true,
  }
})

search.use(insightsMiddleware);

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
    attribute: 'wordleNumber',
    sortBy: ['name:desc']
  }),
  
  instantsearch.widgets.refinementList({
    container: '#solved_row-list',
    attribute: 'solvedRow',
    transformItems(items) {
      const list = items.map(item => { 
        if (item.label === '0') { 
          item.label = 'Not solved';
          item.highlighted = 'Not solved';
        } else {
          item.highlighted = `Row ${item.label}`;
        }
        return item; 
      });
      list.sort((a,b) => { 
        var numA = Number(a.label);
        var numB = Number(b.label);
        if(isNaN(numA)) { 
          return Number.MAX_VALUE - numB; 
        } 
        if(isNaN(numB)) { 
          return numA - Number.MAX_VALUE; 
        } 
        return numA - numB; 
      })
      return list;
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
          const label = 'Auto-scored'
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
      item: function(val, bindEvent) { return `
        <article class="wordle" ${bindEvent('click', val, 'Wordle clicked')}>
          <header>
            <img class='profile-image' src="${val.photoUrl}" alt="profile image for ${val.scorerName}" data-default="https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"/>
            <a class="wordle-title${val.date_timestamp > 1666286675 && !val.autoScore ? ' mentioned':''}" href="https://www.twitter.com/${val.scorerName}/status/${val.id}" target="_blank" ${bindEvent('conversion', val, 'Wordle tweet clicked')}>
            ${val.scorerName}</a>
          </header>
          <ul class="attributes">
            ${val.score && `
              <li><span class="label">Score:</span> ${val.score}</li>
            `}
            ${val.wordleNumber && `
              <li><span class="label">Wordle</span> ${val.wordleNumber}</li>
            `}
            ${val.solvedRow ? `
              <li>Solved on row ${val.solvedRow}</li>
            ` : `
              <li>Not solved</li>
            `}
            ${val.date_timestamp && `
            <li><time>${(new Date(val.date_timestamp * 1000)).toLocaleDateString("en-US")}</time></li>
            `}
          </ul>
        </article>
      `},
    }
  }),

  instantsearch.widgets.pagination({
    container: '#pagination',
    scrollTo: '#pagination'
  })
]);

// 5. Start the search!
search.start();


// Initialize algolia insights
/*
aa('init', {
  appId: APP_ID,
  apiKey: APP_SEARCH_KEY,
  useCookie: true,  
});

document.getElementById('wordles').addEventListener('click', (e) => {
  if(e.target.closest('.ais-Hits-item')) {
    
  }
});*/