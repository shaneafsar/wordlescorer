# wordlescorer

## Intro
This node script runs and watches a specific bot account on Twitter (@ScoreMyWordle) and replies to anyone who asks with a score of their wordle output. The more characters that are solved earlier in the puzzle, the more points you get!

Accepting pull requests and bug reports!

### Features
* At-mention @ScoreMyWordle in your tweet with a Wordle output (or in a reply), and it'll tweet-back a response with a score.
* Supports reading the default square emoji wordle output (including the high contrast version of the emojis)
* Supports reading wa11y.co alt text on wordle images if there's no default wordle square emoji output

## Future ideas

### Features
* Improve parsing acessibility text on images that leveraged wa11y.co (any others parsers out there?)
* Provide a score or message for interesting patterns
* Watch @-mentions so that it works with the Wordle Twitter community (Communities are currently inaccessible via API)
* Tweet out a leaderboard daily with top 3 wordlers ranked by row solved, score, and tweet time
* Static website to paste results without needing to tweet
* More & varied compliments!

### Infra
* Add suite of unit tests
* Add data persistence layer to conistently track already mentioned tweets app starts


## Special thanks
* https://www.powerlanguage.co.uk/wordle/ (@powerlanguish) - for creating wordle!
* https://wa11y.co/ (@antagonistapp) - for creating an accessible alt-text version of the game's output
* @ishabazz - for posting wordle images with alt text & slight variations I could test with
* https://developer.twitter.com/ - for Twitter's API access 
* https://www.linode.com/docs/guides/nodejs-twitter-bot/ - for providing the basis for setting up this node script