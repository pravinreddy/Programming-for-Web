const {inspect} = require('util'); //for debugging

'use strict';

class DocFinder {

  /** Constructor for instance of DocFinder. */
  constructor() {
    //@TODO
    //to store the noise words in a array
    this.NOISE_WORDS = [];
    //to store the documents data in a array
    this.docArray = [];
    //to store the non noise words in the array
    this.completeWords = [];

  }

  /** Return array of non-noise normalized words from string content.
   *  Non-noise means it is not a word in the noiseWords which have
   *  been added to this object.  Normalized means that words are
   *  lower-cased, have been stemmed and all non-alphabetic characters
   *  matching regex [^a-z] have been removed.
   */
  words(content) {
    var normalizedWords = content.split(/\s+/);
    // with the reference of the class slides in "js2.pdf" arrays
    normalizedWords = normalizedWords.map(w => normalize(w));
    normalizedWords = normalizedWords.filter( (w) => !this.NOISE_WORDS.includes(w));
    //console.log(normalizedWords);
    return normalizedWords;
  }

  /** Add all normalized words in noiseWords string to this as
   *  noise words.
   */
  addNoiseWords(noiseWords) {
    this.NOISE_WORDS = noiseWords.split(/\s+/);
  }


  _wordsLow( content){
    let match;
    var pairs = [];
    while(match = WORD_REGEX.exec(content)) {
      const [word, offset] = [match[0], match.index];
      pairs.push([normalize(word), offset]);
    }
    return pairs;
  }

  /** Add document named by string name with specified content to this
   *  instance. Update index in this with all non-noise normalized
   *  words in content string.
   */
  addContent(name, content) {
    var contentIntoWords = this.words(content);
    var temp = this.completeWords;
    contentIntoWords.forEach(function(w) {
      if(!(temp.includes(w))){
        temp.push(w);
      }
    });
    temp.sort();
     this.completeWords = temp;
    var pairs = [];
    pairs = this._wordsLow(content);
    //console.log(this.completeWords);

    // all the properties in the docArray 
    this.docArray.push({
      docName: name,
      docContent: content,
      docWords: contentIntoWords,
      docPairs: pairs
    });

  }

  /** Given a list of normalized, non-noise words search terms,
   *  return a list of Result's  which specify the matching documents.
   *  Each Result object contains the following properties:
   *     name:  the name of the document.
   *     score: the total number of occurrences of the search terms in the
   *            document.
   *     lines: A string consisting the lines containing the earliest
   *            occurrence of the search terms within the document.  Note
   *            that if a line contains multiple search terms, then it will
   *            occur only once in lines.
   *  The Result's list must be sorted in non-ascending order by score.
   *  Results which have the same score are sorted by the document name
   *  in lexicographical ascending order.
   *
   */
  find(terms) {
    //@TODO
    var resultSet = [];
    for(const doc of this.docArray) {
      let count = 0;
      let line = '';
      for(var term of terms) {
        if(doc.docWords.includes(term)) {
          //console.log(doc.docName);
          doc.docWords.forEach(function(element) {
              if(element === term){
	              count++;
              }
          }); // forEach

          //for the lines content
          if(line === ''){
            let temp = doc.docPairs.findIndex(function (element){
              return element[0] === term;
            });

            let tempIndexPair = doc.docPairs[temp];

            //adding the previous content into the line
            for(let i=tempIndexPair[1]; (doc.docContent[i] != '\n') && (i!=-1) && (i!=doc.docContent.length); i--){
              line = doc.docContent[i] + line;
            }

            //adding the after content into the line
            for(let i=tempIndexPair[1]+1; (doc.docContent[i] != '\n') && (i!=-1) && (i!=doc.docContent.length); i++){
              line = line + doc.docContent[i];
            }

          }// if lines

          let findObj = false;

          resultSet.forEach(function(element) {
            if(element.name === doc.docName) {
              findObj = true;
              element.score = count;
            }
          });

          if(!findObj){
            resultSet.push({ name: doc.docName,
              score: count,
              lines: line + '\n'});
          }
        }
      }
    }
    //with the reference of "https://stackoverflow.com/questions/1129216/sort-array-of-objects-by-string-property-value-in-javascript" for sorting the objects in arrays

    resultSet.sort(function(obj1, obj2) {
      if(obj1.score > obj2.score){
        return -1;
      }
      else if(obj1.score < obj2.score){
        return 1;
      }
      else if(obj1.score === obj2.score){
        if(obj1.name < obj2.name){
          return -1;
        }
        else{
          return 1;
        }
      }
    });
    return resultSet;
  }

  /** Given a text string, return a ordered list of all completions of
   *  the last word in text.  Returns [] if the last char in text is
   *  not alphabetic.
   */
  complete(text) {
    //@TODO
    var resultList = []
    // with the reference of the "https://stackoverflow.com/questions/20883404/javascript-returning-the-last-word-in-a-string" to get the last word in the array
    var textIntoArray = text.split(' ');
    var lastWord = textIntoArray[textIntoArray.length -1];
    var letters = /^[A-Za-z]+$/;
    if(lastWord.match(letters)){
      resultList = this.completeWords.filter(w => w.startsWith(lastWord.toLowerCase()));
      return resultList;
    }else{
      return [];
    }
  }


} //class DocFinder

module.exports = DocFinder;

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple class which packages together the result for a
 *  document search as documented above in DocFinder.find().
 */
class Result {
  constructor(name, score, lines) {
    this.name = name; this.score = score; this.lines = lines;
  }

  toString() { return `${this.name}: ${this.score}\n${this.lines}`; }
}

/** Compare result1 with result2: higher scores compare lower; if
 *  scores are equal, then lexicographically earlier names compare
 *  lower.
 */
function compareResults(result1, result2) {
  return (result2.score - result1.score) ||
    result1.name.localeCompare(result2.name);
}

/** Normalize word by stem'ing it, removing all non-alphabetic
 *  characters and converting to lowercase.
 */
function normalize(word) {
  return stem(word.toLowerCase()).replace(/[^a-z]/g, '');
}

/** Place-holder for stemming a word before normalization; this
 *  implementation merely removes 's suffixes.
 */
function stem(word) {
  return word.replace(/\'s$/, '');
}
