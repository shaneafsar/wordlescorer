// const blocks = {'⬛': 0,'⬜': 0,'🟨': 1,'🟦':1,'🟧':2,'🟩': 2};

const SCORE = {
  CORRECT: 2,
  PARTIAL: 1,
  WRONG: 0
}

const CODEPOINT_SCORE = new Map([
  [129000, SCORE.PARTIAL],
  [128998, SCORE.PARTIAL],
  [129001, SCORE.CORRECT],
  [128999, SCORE.CORRECT],
  [11035, SCORE.WRONG],
  [11036, SCORE.WRONG],
]);

export { SCORE, CODEPOINT_SCORE };