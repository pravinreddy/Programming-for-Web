'use strict';

const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const process = require('process');
const url = require('url');
const queryString = require('querystring');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;


//Main URLs
const DOCS = '/docs';
const COMPLETIONS = '/completions';

//Default value for count parameter
const COUNT = 5;

/** Listen on port for incoming requests.  Use docFinder instance
 *  of DocFinder to access document collection methods.
 */
function serve(port, docFinder) {
  const app = express();
  app.locals.port = port;
  app.locals.finder = docFinder;
  setupRoutes(app);
  const server = app.listen(port, async function() {
    console.log(`PID ${process.pid} listening on port ${port}`);
  });
  return server;
}

module.exports = { serve };

function setupRoutes(app) {
  app.use(cors());            //for security workaround in future projects
  app.use(bodyParser.json()); //all incoming bodies are JSON

  //@TODO: add routes for required 4 services
    app.get('/docs/:id', doGetContent(app)); //to get the documents
    app.get('/completions\?[\w\s]*', doGetComplete(app)); //to get the complete words
    app.get('/docs\?[\w\s]*', doGetFind(app)); //find the documnets that contain the words
    app.post('/docs', doAddContent(app)); // adding the document to the docs
    app.use(doErrors()); //must be last; setup for server errors
}

//@TODO: add handler creation functions called by route setup
//routine for each individual web service.  Note that each
//returned handler should be wrapped using errorWrap() to
//ensure that any internal errors are handled reasonably.

//function for the getting the the document content fron the database
function doGetContent(app) {
  return errorWrap(async function(req, res) {
    try {
      const id = req.params.id;
      const results = await app.locals.finder.docContent(id); //using the docFinder.doccontent function form the project 2
      if (results.length === 0) {
	throw {
	  isDomain: true,
	  errorCode: 'NOT_FOUND',
	  message: `file ${id} not found`,
	};
      }
      else {
        var resultSet = {
          content: results,
          links : [
            {
            rel: "self",
            href: baseUrl(req,'/docs/'+req.params.id) // creating the url using the baseUrl function
          }
          ]
        }
	res.json(resultSet);
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}




//function for the getting the complete words for the last word in the given sentence
function doGetComplete(app) {
  return errorWrap(async function(req, res) {
    try {
      const id = req.query.text;
      if(req.query.text === undefined){
        throw {
      	  isDomain: true,
      	  errorCode: 'BAD_PARAM',
      	  message: `required query parameter \"text\" is missing`,
      	};
      }
      const results = await app.locals.finder.complete(id.split(" ").reverse()[0]); // using the docFinder.complete function from the previous project 2
      if (results.length === 0) {
	throw {
	  isDomain: true,
	  errorCode: 'NOT_FOUND',
	  message: `words not found`,
	};
      }
      else {
	res.json(results);
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

//fucntion for the finding the documents that contains the words that we have given to search
function doGetFind(app) {
  return errorWrap(async function(req, res) {
    try {
      const words =  req.query.q;

        if (req.query.q === undefined) {
          throw {
            isDomain: true,
            errorCode: 'BAD_PARM',
            message: `required query parameter \"q\" is missing`,
          };
        }
      const results = await app.locals.finder.find(words);

        for(var i=0; i<results.length; i++) {
          var path = baseUrl(req, req.path+'/'+ results[i].name);
          results[i].href = path;

        }

        var resultSubSet;
        var cursor;
        var thisPath;
        var cursorPath;
        var tempStart;

        if(req.query.start === undefined) {
          tempStart = 0;
        }
        else {

          if ( isNaN(req.query.start) || Number(req.query.start)<= 0) {
            throw {
              isDomain: true,
              errorCode: 'BAD_PARAM',
              message: `bad query parameter \"start\"`,
            };
          }
          tempStart = Number(req.query.start);
        }

        var tempCount;

        if(req.query.count === undefined) {
          tempCount = COUNT;
        }
        else {
          if ( isNaN(req.query.count) || Number(req.query.count)<= 0) {
            throw {
              isDomain: true,
              errorCode: 'BAD_PARAM',
              message: `bad query parameter \"count\"`,
            };
          }
          tempCount = Number(req.query.count);
        }

        if(tempStart+tempCount > results.length && tempStart-tempCount>0) {
          cursor = 'previous';
          cursorPath = baseUrl(req,req.url) + '&start='+(tempStart-tempCount)+'&count='+tempCount;
          thisPath = baseUrl(req,req.url) + '&start='+tempStart+'&count='+tempCount;
        }
        else if (tempStart+tempCount <= results.length){
          cursor = 'next';
          cursorPath = baseUrl(req,req.url) + '&start='+(tempStart+tempCount)+'&count='+tempCount;
          thisPath = baseUrl(req,req.url) + '&start='+tempStart+'&count='+tempCount;
        }


        if(req.query.start === undefined && req.query.count === undefined ){
          resultSubSet = results.slice( tempStart, tempStart+tempCount);
          thisPath = baseUrl(req,req.url) + '&start=0&count=5';
          cursorPath = baseUrl(req,req.url) + '&start=5&count=5';
        }
        else if(req.query.count === undefined) {
          resultSubSet = results.slice(tempStart);

          if(tempStart+tempCount > results.length && tempStart-tempCount>0) {
            cursorPath =  baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('start')) + 'start='+(tempStart-tempCount)+'&count=5';
          }
          else if (tempStart+tempCount <= results.length) {
            cursorPath = baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('start')) + 'start='+(tempStart+tempCount)+'&count=5';
          }
          thisPath =  baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('start')) + 'start='+tempStart+'&count='+tempCount;
        }
        else if(req.query.start === undefined) {
          resultSubSet = results.slice(0,tempCount);
          if(tempStart+tempCount > results.length && tempStart-tempCount>0) {
            cursorPath =  baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('count')) + 'start='+(tempStart-tempCount)+'&count='+tempCount;;
          }
          else if (tempStart+tempCount <= results.length) {
            cursorPath = baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('count')) + 'start='+(tempStart+tempCount)+'&count='+tempCount;
          }
          thisPath = baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('count')) + 'start='+(tempStart)+'&count='+tempCount;

        }
        else {
          resultSubSet = results.slice( tempStart, tempStart+tempCount);
          if(tempStart+tempCount > results.length && tempStart-tempCount>0) {
            cursorPath =  baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('start')) + 'start='+(tempStart-tempCount)+'&count='+tempCount;;
          }
          else if (tempStart+tempCount <= results.length) {
            cursorPath = baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('start')) + 'start='+(tempStart+tempCount)+'&count='+tempCount;
          }
          thisPath = baseUrl(req,req.url).slice(0, baseUrl(req,req.url).lastIndexOf('start')) + 'start='+(tempStart)+'&count='+tempCount;

        }

        var linkSet = [
          {
          rel: "self",
          href: thisPath
        },
        ];

        if(cursor != undefined) {
          linkSet.push({
            rel: cursor,
            href: cursorPath
          });
        }
        var resultSet = {
          results: resultSubSet,
          totalCount: results.length,
          links : linkSet
        }
	res.json(resultSet);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

//function for adding the document to the set of documents
function doAddContent(app) {
  return errorWrap(async function(req, res) {
    try {
      const obj = req.body;
      if (obj.name === undefined) {
        throw {
          isDomain: true,
          errorCode: 'BAD_PARAM',
          message: `required body parameter \"name\" is missing`,
        };
      }

      if (obj.content === undefined) {
        throw {
          isDomain: true,
          errorCode: 'BAD_PARAM',
          message: `required body parameter \"content\" is missing`,
        };
      }
      const results = await app.locals.finder.addContent(obj.name, obj.content);
      var str = '/docs/'+obj.name;
      res.append('href', baseUrl(req, str));
      res.status(CREATED).json({href:  baseUrl(req, str)});

    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


/** Return error handler which ensures a server error results in nice
 *  JSON sent back to client with details logged on console.
 */
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}


/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
  EXISTS: CONFLICT,
  NOT_FOUND: NOT_FOUND
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return err.isDomain
    ? { status: (ERROR_MAP[err.errorCode] || BAD_REQUEST),
	code: err.errorCode,
	message: err.message
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
}


/** Return base URL of req for path.
 *  Useful for building links; Example call: baseUrl(req, DOCS)
 */
function baseUrl(req, path='/') {
  const port = req.app.locals.port;
  const url = `${req.protocol}://${req.hostname}:${port}${path}`;
  return url;
}
