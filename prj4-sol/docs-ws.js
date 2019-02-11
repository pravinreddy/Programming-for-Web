'use strict';

const axios = require('axios');


function DocsWs(baseUrl) {
  this.docsUrl = `${baseUrl}/docs`;
}

module.exports = DocsWs;

//get the document content wrapper
DocsWs.prototype.get = async function(id) {
  try {
    const response = await axios.get(`${this.docsUrl}/${id}`);
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};

//add document wrapper
DocsWs.prototype.add = async function(user) {
  try {
    const response = await axios.post(this.docsUrl, user);
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};

//search content wrapper
DocsWs.prototype.search = async function(id) {
  try {
    let response;

    if(id.start === undefined){
      response = await axios.get(`${this.docsUrl}/?q=${id.q}`);
    }

    if(id.start !== undefined ) {
      response = await axios.get(`${this.docsUrl}/?q=${id.q}&start=${id.start}`);
    }

    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};
