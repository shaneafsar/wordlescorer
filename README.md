# wordlescorer

## Intro
This node script runs and watches a specific bot account on Twitter ([@ScoreMyWordle](https://twitter.com/ScoreMyWordle)) and replies to anyone who asks with a score of their wordle output. The more characters that are solved earlier in the puzzle, the more points you get!

Accepting bug reports & feature requests!

### Features
* At-mention [@ScoreMyWordle](https://twitter.com/ScoreMyWordle) in your tweet with a Wordle output (or in a reply), and it'll tweet back a response with a score. (Note: limited support in Communities, you will be quote-tweeted).
* Supports reading the default square emoji wordle output (including the high contrast version of the emojis)
* Supports reading wa11y.co alt text on wordle images if there's no default wordle square emoji output
* Tweets out the top Wordler of the day ranked by score, row solved, then tweet time.

## Future ideas

### Features
* Improve parsing acessibility text on images that leveraged wa11y.co (any others parsers out there?).
* Provide a score or unique message for interesting pattern results.
* Static website to paste results without needing to tweet.
* More & varied compliments!

### Infra
* Add massive suite of unit tests (make it easier to receive contributions)
* Refactor DBs into typescript and/or leverage Replit data store
* Pull out the scoring mechanism so that it can be used independently (e.g. for a static website, bots on other services)


## Special thanks
* https://www.powerlanguage.co.uk/wordle/ | [@powerlanguish](https://twitter.com/powerlanguish) - for creating wordle!
* https://wa11y.co/ | [@antagonistapp](https://twitter.com/antagonistapp) - for creating an accessible alt-text version of the game's output
* [@ishabazz](https://twitter.com/ishabazz) & many others - for posting wordle images with alt text & slight variations I could test with.
* https://developer.twitter.com/ - for Twitter's API access 
* https://www.linode.com/docs/guides/nodejs-twitter-bot/ - for providing the basis for setting up this node script