<!DOCTYPE html>
<html>
  <head>
    <title>Document Collection Search</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    <h1>Document Collection Search</h1>
    <ul>
      {{#errors}}
        <li class="error">{{.}}</li>
      {{/errors}}
    </ul>
    <form method="GET" action="{{{base}}}/search.html">
       <p>
	 Please fill in one or more search terms in the feild below
        </p>

	    <label>
	    <span class="label">Search Terms:</span>
	    <input id="query" name = "q" value="{{valueName}}">
	    </label>
	    <br/>
  {{#fields}}
	    {{#errorMessage}}
	      <span class="error">{{errorMessage}}</span><br/>
	    {{/errorMessage}}
	 {{/fields}}
      <input id="submit" name="submit" type="submit" value="search" class="control">
    </form>
{{#isResultsHeader}}
  </p>
  <h2>Search Results</h2>
{{/isResultsHeader}}

{{#resultsList}}
<p class="result">
  <a class="doc-name" href="{{href}}">{{name}}</a><br>
  {{#lines}}
     {{{.}}}</br>
    {{/lines}}
<br>
</p>
{{/resultsList}}
{{#isPrevious}}<a id="previous" href="{{href}}">{{id}}</a>{{/isPrevious}} {{#isNext}}<a id="next" href="{{href}}">{{id}}</a>{{/isNext}}
    {{>footer}}
  </body>
</html>
