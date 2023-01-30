// EXAMPLE CALL SCRATCHPAD


// GET Individual tweet response

T.get('statuses/show/:id', {id: '1533961937352105984', include_ext_alt_text: true}).then(({data}) => {
  //console.log(data)
  var parentAltText = data?.extended_entities?.media?.[0]?.ext_alt_text || '';
            var parentWordleResult = getWordleMatrixFromText(data.text);

            parentWordleResult = parentWordleResult.length > 0 ? 
              parentWordleResult : getWordleMatrixFromImageAltText(parentAltText);

  console.log(parentWordleResult);
//   const wordleResult = getWordleMatrixFromText(data.text);
//   const score = calculateScoreFromWordleMatrix(wordleResult).finalScore;
//   const solvedRow = getSolvedRow(wordleResult);
//   console.log(`The wordle scored ${score} out of 360${getSentenceSuffix(solvedRow)} ${getCompliment()}`)
});

// GET a11y text for testing

T.get('statuses/show/:id', {id: '1608109623889756160', include_ext_alt_text: true}).then(({data}) => {
  var text = data?.extended_entities?.media?.[0]?.ext_alt_text || '';
  console.log(text);
  console.log(getWordleMatrixFromImageAltText(text));
});


/*
https://socel.net/@tomwe/109773963630240355
#Wordle 589 4/6
Analysis...
⬛🟨⬛🟨⬛  197 words left.
🟨⬛⬛⬛🟨  17 words left.
⬛⬛⬛⬛🟨  5 words left.
🟩🟩🟩🟩🟩  1 words left.
https://www.stevedegroof.com/word-check.html
#WordleWarriors
*/