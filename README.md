InsideDesk Interview Task
=========================

Name: Ryan Sandoval
Task: WebScrapper

Testing
=======

To launch the application:
```
$ npm install # Install Dependencies

$ node main.js [--file <path>] [--specialty <specialty>]
```

Specialty should be a string to be selected in the select box.
e.g. 
```
$ node main.js -specialty "General Practice"
$ node main.js --specialty "Periodontics"
```

Outputs
=======

A json file for each zip code in the input JSON. 
Output files are in the form "<zipcode>.json".

Notes
=====

A function to workaround the CATCHPA has been implemented in webscraper.js
It simply reloads the page until the CATCHPA disappears.
It will do this forever so if it is stuck, try clearing cache.

The crawler launches a browser in NON-headless mode.
