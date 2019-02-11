'use strict';

const express = require('express');
const upload = require('multer')();
const fs = require('fs');
const mustache = require('mustache');
const Path = require('path');
const { URL } = require('url');

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

function serve(port, base, model) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  app.locals.model = model;
  process.chdir(__dirname);
  app.use(base, express.static(STATIC_DIR));
  setupTemplates(app, TEMPLATES_DIR);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

module.exports = serve;

/******************************** Routes *******************************/

function setupRoutes(app) {
  const base = app.locals.base;
  app.get(`/`, redirect(app));  //redirect from the root page
  app.get(`${base}/search.html`, doSearch(app)); //go to search page
  app.get(`${base}/add.html`, addContentForm(app)); //add content from file form
  app.post(`${base}/add.html`, upload.single("file"), uploadFile(app)); // upload the data in the server
  app.get(`${base}/:id`, getContent(app)); //show the content of the file
}

/*****************************Feilds Info*****************************/

const FIELDS_INFO = {
  searchTerms:  {friendlyName: 'Search Terms',
    id: 'query',
    name: 'q',
    isSearch: 'true',
  }
};

const FIELDS =
  Object.keys(FIELDS_INFO).map((n) => Object.assign({name: n}, FIELDS_INFO[n]));

/*************************** Action Routines ***************************/

// to redirect from the root page
function redirect(app) {
  return async function(req, res) {
    res.redirect(`/docs/`);
  };
};


// search page for searching the words
function doSearch(app) {
  return async function(req, res) {
    const isSubmit = req.query.submit !== undefined;
    let searchTerms = [];
    let next;
    let valueName = '';
    let previous;
    let resultsSet;
    let errors = undefined;
    let search = getNonEmptyValues(req.query);
    if (isSubmit || (search.q !== undefined && search.start !== undefined)) {
      if (search.q === undefined) {
	const msg = 'at least one search term must be specified';
	errors = Object.assign(errors || {}, { _: msg });
      }
      if (!errors) {
	const q =search;
	try {
	  resultsSet = await app.locals.model.search(q);
    valueName = search.q;
    searchTerms = resultsSet.results;
    searchTerms.forEach((a)=> a.href =  `${app.locals.base}/`+ a.name);
    resultsSet.links.forEach((a)=> {if(a.rel === "next"){next =  `${app.locals.base}/search.html` +a.href.slice(a.href.indexOf("?q="), a.href.indexOf("&count"))}; if(a.rel === "previous"){previous =`${app.locals.base}/search.html` +a.href.slice(a.href.indexOf("?q="), a.href.indexOf("&count"))}});

	}
	catch (err) {
          console.error(err);
	  errors = err;
	}
	if (searchTerms.length === 0) {
	  errors = {_: `no document containg "${search.q}" found; please retry`};
	}
      }
    }
    let model, template;
    if (searchTerms.length > 0) {
      template = 'search';
      for(let l=0; l<searchTerms.length; l++)
        for(let i=0; i< searchTerms[l].lines.length; i++) {
          let p = searchTerms[l].lines[i].split(' ');
          let j = p.length;
          let findWords = search.q.split(' ');
          findWords = findWords.map((a)=> normalize(a));
          let words = p.map((a)=> normalize(a));
          let word = '';
          while(--j) {
            word = words[j];
            for(let k=0; k< findWords.length; k++) {
              if(word == findWords[k]) {
                p[j] = '<span class="search-term">' + p[j] + "</span>"
              }
            }

          }
           searchTerms[l].lines[i] = p.join(' ');
        }

      if(previous !== undefined && next !== undefined){
        model = { base: app.locals.base,  resultsList: searchTerms, valueName: valueName, isNext: {id: "Next", href: next}, isPrevious:{id: "Previous", href: previous} ,isResultsHeader: {id: "true"} , fields: fieldsWithValues(FIELDS_INFO, errors)};
      }
      if(previous === undefined && next !== undefined){
        model = { base: app.locals.base,  resultsList: searchTerms, valueName: valueName, isNext: {id: "Next", href: next}, isResultsHeader: {id: "true"} , fields: fieldsWithValues(FIELDS_INFO, errors)};
      }
      if(previous !== undefined && next === undefined){
        model = { base: app.locals.base,  resultsList: searchTerms, valueName: valueName, isPrevious:{id: "Previous", href: previous} ,isResultsHeader: {id: "true"} , fields: fieldsWithValues(FIELDS_INFO, errors)};
      }
      if(previous === undefined && next === undefined){
        model = { base: app.locals.base,  resultsList: searchTerms, valueName: valueName ,isResultsHeader: {id: "true"} , fields: fieldsWithValues(FIELDS_INFO, errors)};
      }
    }
    else {
      template =  'search';
      if(errors === undefined) {
        model = errorModel(app, search, FIELDS_INFO);
      }
      else{
        model = errorModel(app, search, errors);
        console.log("found errors");
      }
    }
    model.valueName = valueName;
    const html = doMustache(app, template, model);
    res.send(html);
  };
};

//get content from the server and output on the screen
function getContent(app) {
  return async function(req, res) {
    let model;
    let errors = undefined;
    const id = req.params.id;
    try {
      const textData = await app.locals.model.get(id);
      if(textData.content === undefined){
        throw textData;
      }
      model = { base: app.locals.base, name:id ,file: textData };
    }
    catch (err) {
      errors = { _:err.message};
      model = errorModel(app, {}, errors);
    }
    const html = doMustache(app, 'getcontent', model);
    res.send(html);
  };
};

function addContentForm(app) {
  return async function(req, res) {
    const model = { base: app.locals.base };
    const html = doMustache(app, 'addContent', model);
    res.send(html);
  };
}

//upload the file in the server
function uploadFile(app) {
  return async function(req, res) {
    let html1;
    let errors;
    const isUpload = req.body.submit === 'submit';
    let file = req.file ;
    if( file !== undefined) {
      let fileName  = req.file.originalname;
        if(fileName.slice(fileName.indexOf(".")) === ".txt"){
            const fileDataJson = {"name": fileName.slice(0,fileName.indexOf(".")),
                                    "content":req.file.buffer.toString('utf8') }
            await app.locals.model.add(fileDataJson);
            res.redirect(`${app.locals.base}/${fileName.slice(0,fileName.indexOf("."))}`);
          }
          else{
            html1 = doMustache(app, 'addContent', { base: app.locals.base });
          }
      }
      else if(file === undefined) {
        errors = {_: `please select a file containing a document to upload`};
        const model = errorModel(app, { }, errors);
        html1 = doMustache(app, 'addContent', model);
      }
    res.send(html1)
  };

};

/*************************utilites***************************************/
/** Return a model suitable for mixing into a template */
function errorModel(app, values={}, errors={}) {
  return {
    base: app.locals.base,
    errors: errors._,
    fields: fieldsWithValues(values, errors)
  };
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


/** Return copy of FIELDS with values and errors injected into it. */
function fieldsWithValues(values, errors={}) {
  return FIELDS.map(function (info) {
    const name = info.name;
    const extraInfo = { value: values[name] };
    if (errors[name]) extraInfo.errorMessage = errors[name];
    return Object.assign(extraInfo, info);
  });
}

/************************ General Utilities ****************************/


/** return object containing all non-empty values from object values */
function getNonEmptyValues(values) {
  const out = {};
  Object.keys(values).forEach(function(k) {
    const v = values[k];
    if (v && v.trim().length > 0) out[k] = v.trim();
  });
  return out;
}


/** Return a URL relative to req.originalUrl.  Returned URL path
 *  determined by path (which is absolute if starting with /). For
 *  example, specifying path as ../search.html will return a URL which
 *  is a sibling of the current document.  Object queryParams are
 *  encoded into the result's query-string and hash is set up as a
 *  fragment identifier for the result.
 */
function relativeUrl(req, path='', queryParams={}, hash='') {
  const url = new URL('http://dummy.com');
  url.protocol = req.protocol;
  url.hostname = req.hostname;
  url.port = req.socket.address().port;
  url.pathname = req.originalUrl.replace(/(\?.*)?$/, '');
  if (path.startsWith('/')) {
    url.pathname = path;
  }
  else if (path) {
    url.pathname += `/${path}`;
  }
  url.search = '';
  Object.entries(queryParams).forEach(([k, v]) => {
    url.searchParams.set(k, v);
  });
  url.hash = hash;
  return url.toString();
}

/************************** Template Utilities *************************/


/** Return result of mixing view-model view into template templateId
 *  in app templates.
 */
function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

/** Add contents all dir/*.ms files to app templates with each
 *  template being keyed by the basename (sans extensions) of
 *  its file basename.
 */
function setupTemplates(app, dir) {
  app.templates = {};
  for (let fname of fs.readdirSync(dir)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  }
}
