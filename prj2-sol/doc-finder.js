const assert = require('assert');
const mongo = require('mongodb').MongoClient;

const {inspect} = require('util'); //for debugging

'use strict';

/** This class is expected to persist its state.  Hence when the
 *  class is created with a specific database url, it is expected
 *  to retain the state it had when it was last used with that URL.
 */
class DocFinder {

  /** Constructor for instance of DocFinder. The dbUrl is
   *  expected to be of the form mongodb://SERVER:PORT/DB
   *  where SERVER/PORT specifies the server and port on
   *  which the mongo database server is running and DB is
   *  name of the database within that database server which
   *  hosts the persistent content provided by this class.
   */
  constructor(dbUrl) {
    this.url = dbUrl.slice(0,dbUrl.lastIndexOf('/')+1);
    this.dbName = dbUrl.slice(dbUrl.lastIndexOf('/')+1, dbUrl.length);
    this.client = {};
    this.db = {};
    this.NOISE_WORDS = [];

  }

  /** This routine is used for all asynchronous initialization
   *  for instance of DocFinder.  It must be called by a client
   *  immediately after creating a new instance of this.
   */

   //refered from "http://mongodb.github.io/node-mongodb-native/3.0/reference/ecmascriptnext/connecting/"
  async init() {
    const MongoClient = require('mongodb').MongoClient;
      try {
        this.client = await MongoClient.connect(this.url,{ useNewUrlParser: true });
        this.db = await this.client.db(this.dbName);
        this.db.createCollection("documents");
        this.db.createCollection("noise_words");
        this.db.createCollection("doc_names");
        this.db.createCollection("dictonary");
      } catch (err) {
        console.log(err.stack);
      }
  }

  /** Release all resources held by this doc-finder.  Specifically,
   *  close any database connections.
   */
  async close() {
    // Closing the database server connection
    if (this.client) await this.client.close();
  }

  /** Clear database */
  async clear() {
    if (this.db) await this.db.dropDatabase();
  }

  /** Return an array of non-noise normalized words from string
   *  contentText.  Non-noise means it is not a word in the noiseWords
   *  which have been added to this object.  Normalized means that
   *  words are lower-cased, have been stemmed and all non-alphabetic
   *  characters matching regex [^a-z] have been removed.
   */
  async words(contentText) {
    //console.log(contentText);
    let normalizedWords = await contentText.split(/\s+/);
    // with the reference of the class slides in "js2.pdf" arrays
    normalizedWords = await Promise.all(normalizedWords.map(async w => await normalize(w)));
    //console.log(await normalizedWords);
    var obj = await this.db.collection("noise_words").findOne({_id:"noise"});
    var noise = await obj.words;
    normalizedWords = await Promise.all(normalizedWords.filter(w => !(noise.includes(w))));
    //console.log(await normalizedWords);
    return await normalizedWords;
  } 

  /** Add all normalized words in the noiseText string to this as
   *  noise words.  This operation should be idempotent.
   */
  async addNoiseWords(noiseText) {
    var NOISE_WORDS = await noiseText.split(/\s+/);
    var object = { _id: "noise", words: NOISE_WORDS };
    await this.db.collection("noise_words").updateOne({_id: "noise"}, { $set:object}, {upsert: true});
  }


  /** Add document named by string name with specified content string
   *  contentText to this instance. Update index in this with all
   *  non-noise normalized words in contentText string.
   *  This operation should be idempotent.
   */
  async addContent(name, contentText) {

    var obj = await this.db.collection("noise_words").findOne({_id:"noise"});
    var temp1 = await this.db.collection("doc_names").findOne({_id:"docnames"});
    if(temp1 === null) {
        let v = [name];
        let obj = {names: v};
        await this.db.collection("doc_names").updateOne({_id: "docnames"}, { $set: obj} , {upsert: true});
    }
    else{
        if(!(temp1.names.includes(name))){
            temp1.names.push(name);
           }
        await this.db.collection("doc_names").updateOne({_id: "docnames"}, { $set: temp1} , {upsert: true});
    }
    var noise = await obj.words;
    var contentIntoWords = await this.words(contentText);
    var pairs = [];
    let match;
    while(match = WORD_REGEX.exec(contentText)) {
     const [word, offset] = [match[0], match.index];
     if(!(noise.includes(word))){
       await pairs.push([await normalize(word), offset]);
     }
   }

   var temp_dict = await this.db.collection("dictonary").findOne({_id:"complete_words"});
   var dictonary = [];

   if(temp_dict === null) {
     dictonary = [contentIntoWords[0]];
   }else {
     dictonary = temp_dict.words;
   }

   contentIntoWords.forEach(function(w) {
      if(!(dictonary.includes(w))){
        dictonary.push(w);
      }
    });

  await this.db.collection("dictonary").updateOne({_id: "complete_words"}, { $set: {words: dictonary} }, {upsert: true});


  //console.log(name);
  //console.log(await this.words(contentText));
  //console.log(pairs);

  var object = {
    docName : name,
    docWords : await this.words(contentText),
    docContent : contentText,
    docPairs : pairs
  }
  await this.db.collection("documents").updateOne({docName : name}, { $set: object} , {upsert: true});
  }

  /** Return contents of document name.  If not found, throw an Error
   *  object with property code set to 'NOT_FOUND' and property
   *  message set to `doc ${name} not found`.
   */
  async docContent(name) {
    let content = '';
    content = await this.db.collection("documents").findOne({docName:name});
    if (content === null) {
      throw new Error('NOT_FOUND', `doc ${name} not found`);
    }
    return await content.docContent;
  }

  /** Given a list of normalized, non-noise words search terms,
   *  return a list of Result's  which specify the matching documents.
   *  Each Result object contains the following properties:
   *
   *     name:  the name of the document.
   *     score: the total number of occurrences of the search terms in the
   *            document.
   *     lines: A string consisting the lines containing the earliest
   *            occurrence of the search terms within the document.  The
   *            lines must have the same relative order as in the source
   *            document.  Note that if a line contains multiple search
   *            terms, then it will occur only once in lines.
   *
   *  The returned Result list must be sorted in non-ascending order
   *  by score.  Results which have the same score are sorted by the
   *  document name in lexicographical ascending order.
   *
   */
  async find(terms) {

    var resultSet = [];
    var docArray = [];
    var temp2 =   await this.db.collection("doc_names").findOne({_id: "docnames"});
    var doc_list = temp2.names;
    for(const doc of doc_list){
      const docTemp = await this.db.collection("documents").findOne({docName: doc});
      //console.log(docTemp);
      docArray.push(docTemp);
    }


    for(const doc of docArray) {
      let count = 0;
      let line = '';
      for(var term of terms) {
        if(doc.docWords.includes(term)) {
          for (const element of doc.docWords) {
              if(element === term){
	              count++;
              }
          } // for

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
              lines: line + "\n" });
          }
        }
      }
    }


    //with the reference of "https://stackoverflow.com/questions/1129216/sort-array-of-objects-by-string-property-value-in-javascript" for sorting the objects in arrays

    await resultSet.sort( function(obj1, obj2) {
      if( obj1.score > obj2.score){
        return -1;
      }
      else if( obj1.score < obj2.score){
        return 1;
      }
      else if( obj1.score === obj2.score){
        if( obj1.name < obj2.name){
          return -1;
        }
        else{
          return 1;
        }
      }
    });

  var finalSet =[];

  resultSet.forEach(obj => finalSet.push(obj.name+': '+obj.score,obj.lines));

    return finalSet;
  }


  /** Given a text string, return a ordered list of all completions of
   *  the last normalized word in text.  Returns [] if the last char
   *  in text is not alphabetic.
   */
  async complete(text) {
    var resultList = []
    var temp_dict = await this.db.collection("dictonary").findOne({_id: "complete_words"});
    var completeWords = temp_dict.words;
    // with the reference of the "https://stackoverflow.com/questions/20883404/javascript-returning-the-last-word-in-a-string" to get the last word in the array
    var textIntoArray = text.split(' ');
    var lastWord = textIntoArray[textIntoArray.length -1];
    var letters = /^[A-Za-z]+$/;
    if(lastWord.match(letters)){
      resultList = completeWords.filter(w => w.startsWith(lastWord.toLowerCase()));
      await resultList.sort();
      return await resultList;
    }else{
      return [];
    }
  }

  //Add private methods as necessary

} //class DocFinder

module.exports = DocFinder;

//Add module global functions, constants classes as necessary
//(inaccessible to the rest of the program).

//Used to prevent warning messages from mongodb.
const MONGO_OPTIONS = {
  useNewUrlParser: true
};

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple utility class which packages together the result for a
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
