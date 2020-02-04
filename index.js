var fs = require('fs');
var path = require('path');
var jsdom = require("jsdom");
const { JSDOM } = jsdom;
var scriptElementsRegex = new RegExp('<script[^<>]*>.*</script>', 'gi');
var htmlTagsRegex = new RegExp('</?[^<>]*>', 'gi');
var newLineRegex = new RegExp('\\n\\r', 'g');
var whiteSpaceRegex = new RegExp('\\s+', 'g');
var excludeUrls = ['/search-results/index.html', '/videos/index.html', 'videos/english/index.html', 'videos/german/index.html', 'videos/isixhosa/index.html'];
var includeElements = ['#video-full-content', '#main-content'];

function getFiles(dir, files_) {
  files_ = files_ || [];
  var files;
  try {
    files = fs.readdirSync(dir);
    for (var i in files) {
      var name = dir + '/' + files[i];
      if (fs.statSync(name).isDirectory()) {
        getFiles(name, files_);
      } else {
        if (path.extname(name) === '.html') {
          files_.push(name);
        }
      }
    }
    return files_;
  } catch (err) {
    console.log(err);
  } 
}

function pageTitle($) {
  var headerTypes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  var headerText = null;
  headerTypes.forEach(type => {
    if (headerText) {
      return;
    } else if ($(type).length > 0) {
      headerText = $(type).first().html();
    }
  });
  return headerText;
}

function removeTrailingSlash(str) {
  if (str.charAt(str.length-1) === '/') {
    return str.substring(0, str.length - 1);
  }
  return str;
}

function removeLeadingSlash(str) {
  if (str.charAt(0) === '/') {
    return str.substring(1);
  }
  return str;
}

function removeLeadingandTrailingSlash(str) {
  str = removeLeadingSlash(str);
  str = removeTrailingSlash(str);
  return str;
}

function combinePaths(array) {
  return array.map(item => {
    item = removeLeadingSlash(item);
    item = removeTrailingSlash(item);
    return item;
  }).join('/');
}

function removeExtraSpaces(string, whiteSpaceReplaacement = '') {
  string = string.trim();
  string = string.replace(/\s\s+/g, whiteSpaceReplaacement);
  return string;
}

function parseString(string) {
  if (!string) { return; }
  return string.trim().replace(scriptElementsRegex, '').replace(htmlTagsRegex, '').replace(newLineRegex, '').replace(whiteSpaceRegex, ' ').replace(/&nbsp;/g, ' ')
}

function processHTMLFile(filePath, sitePath) {
  var html = fs.readFileSync(filePath, 'utf-8');
  const dom = new JSDOM(html).window.document;
  var window = dom.defaultView;
  var $ = require('jquery')(window);
  $("header").remove();
  $("footer").remove();
  $("script").remove();
  $('.affiliate-box').remove();
  $('.download-links').remove();
  $('.language-links').remove();
  $('.language-specific').remove();
  const title = parseString(pageTitle($, path.dirname(filePath.replace(sitePath, ''))));
  var text = '';
  var headers = [];
  var finalArray = [];
  includeElements.forEach(element => { 
    $(element).find('h1,h2,h3,h4,h5,h6').each((index, headerElement) => {
      headers.push(parseString($(headerElement).text()));
    });
    
    $(element).find('h1,h2,h3,h4,h5,h6').remove();
    text += removeExtraSpaces($(element).text(), ' ');

  });
  if (!text) { return;}
  headers.forEach(header => {
    finalArray.push({
      title: title,
      href: path.dirname(filePath.replace(sitePath, '')),
      content: parseString(header),
      contentType: 'header'
    });
  });

  finalArray.push({
    title: title,
    href: path.dirname(filePath.replace(sitePath, '')),
    content: parseString(text),
    contentType: 'body'
  });
  return finalArray;
}

module.exports = {
  runIndex(sitePath, callback) {
    var absoluteExclueUrls = excludeUrls.map(excludePath => {
      return removeLeadingandTrailingSlash(combinePaths([sitePath, excludePath]));
    });
    var filesToIndex = getFiles(sitePath).filter(filePath => {
      return absoluteExclueUrls.indexOf(removeLeadingandTrailingSlash(filePath)) < 0;
    });
    var pagesIndex = [];
    filesToIndex.filter(item => {
      return item;
    }).forEach(filePath => {
      pagesIndex = pagesIndex.concat(processHTMLFile(filePath, sitePath));
    });
    var final = {searchIndex: pagesIndex};
    callback(null, {searchIndex: JSON.stringify(final, null, 2), stats: '1'});
  }
};
