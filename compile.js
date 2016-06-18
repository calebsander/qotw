const fs = require('fs');

let COMPILED_DIR;
function setCompiledDir(dir) {
  COMPILED_DIR = __dirname + '/' + dir;
}
setCompiledDir('compiled-files-production');
const ROOT_DIR = __dirname + '/files';
function transformPath(path) {
  return COMPILED_DIR + path.substring(ROOT_DIR.length);
}
function omitWhiteSpace(string) {
  return string.replace(/\t/g, '');
}
const cachedStandardFiles = {};
function getStandardFile(name) {
  if (name in cachedStandardFiles) return cachedStandardFiles[name];
  else {
    let path = __dirname + '/standard/' + name.toLowerCase() + '.html';
    return cachedStandardFiles[name] = omitWhiteSpace(fs.readFileSync(path).toString());
  }
}
const cachedResources = {};
function upDir(file) {
  return file.substring(0, file.lastIndexOf('/'));
}
function getResource(url, file) {
  if (url in cachedResources) return cachedResources[url];
  else {
    try {
      let path;
      if (url[0] === '/') path = ROOT_DIR + url;
      else path = upDir(file) + '/' + url;
      let result = omitWhiteSpace(fs.readFileSync(path).toString());
      if (url.endsWith('.css')) result = result.replace(/url\(\.\./g, 'url(' + upDir(upDir(url)).replace(ROOT_DIR, ''));
      return cachedResources[url] = result;
    }
    catch (e) {
      console.log('Error compiling: ' + file);
      throw e;
    }
  }
}
function compile(file, callback, omitReplacement) {
  console.error('Compiling ' + file);
  if (file.endsWith('.html') && !omitReplacement) {
    fs.readFile(file, (err, data) => {
      if (err) throw err;
      else {
        data = data.toString().replace(/\t/g, '');
        const STANDARD_MATCH = /<STANDARD_([A-Z]*) \/>/g;
        let match;
        while (match = STANDARD_MATCH.exec(data)) {
          let replaceRequest = match[0], resultFile = getStandardFile(match[1]), index = match.index;
          data = data.substring(0, index) + resultFile + data.substring(index + replaceRequest.length);
        }
        const SCRIPT_MATCH = /<script src = '(.+\.js)'><\/script>/g;
        while (match = SCRIPT_MATCH.exec(data)) {
          let resultFileName = match[1];
          if (resultFileName.indexOf('://') === -1) {
            let replaceRequest = match[0], resultFile = getResource(resultFileName, file), index = match.index;
            data = data.substring(0, index) + '<script>' + resultFile + '</script>' + data.substring(index + replaceRequest.length);
          }
        }
        const STYLE_MATCH = /<link href = '(.+\.css)' rel = 'stylesheet' \/>/g;
        while (match = STYLE_MATCH.exec(data)) {
          let resultFileName = match[1];
          if (resultFileName.indexOf('://') === -1) {
            let replaceRequest = match[0], resultFile = getResource(resultFileName, file), index = match.index;
            data = data.substring(0, index) + '<style>' + resultFile + '</style>' + data.substring(index + replaceRequest.length);
          }
        }
        fs.writeFile(transformPath(file), data, (err) => {
          if (err) throw err;
          else {
            if (callback) callback();
          }
        });
      }
    });
  }
  else {
    fs.createReadStream(file).pipe(fs.createWriteStream(transformPath(file))).on('finish', () => {
      if (callback) callback();
    });
  }
}

const UNCOMPILED_FOLDERS = [];
const OMIT_FOLDERS = [];
[UNCOMPILED_FOLDERS, OMIT_FOLDERS].forEach((folders) => {
  for (let i = 0; i < folders.length; i++) folders[i] = ROOT_DIR + '/' + folders[i];
});
function walkDir(dir, omitReplacement) {
  fs.mkdir(transformPath(dir), (err) => {
    if (err) throw err;
    else {
      fs.readdir(dir, (err, files) => {
        if (err) throw err;
        else {
          files.forEach((file) => {
            file = dir + '/' + file;
            fs.stat(file, (err, stats) => {
              if (err) throw err;
              else {
                if (stats.isDirectory()) {
                  if (OMIT_FOLDERS.indexOf(file) === -1) walkDir(file, omitReplacement || UNCOMPILED_FOLDERS.indexOf(file) !== -1);
                }
                else compile(file, undefined, omitReplacement);
              }
            });
          });
        }
      });
    }
  });
}
//from http://stackoverflow.com/a/12761924
function rmDirRecursive(path) {
  var files = [];
  files = fs.readdirSync(path);
  files.forEach((file, index) => {
    var curPath = path + '/' + file;
    if (fs.lstatSync(curPath).isDirectory()) rmDirRecursive(curPath);
    else fs.unlinkSync(curPath);
  });
  fs.rmdirSync(path);
}

module.exports = compile;
module.exports.setCompiledDir = setCompiledDir;
module.exports.getCompiledDir = () => COMPILED_DIR;
module.exports.walkDir = walkDir;
module.exports.compileAll = () => {
  if (fs.existsSync(COMPILED_DIR)) rmDirRecursive(COMPILED_DIR);
  walkDir(ROOT_DIR);
};
module.exports.remove = (file) => {
  fs.unlink(transformPath(file), (err) => {});
};