const CleanCSS = require('clean-css');
const closure = require('google-closure-compiler-js').compile;
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
  return string.replace(/\t/g, '').replace(/\n{2,}/g, '\n');
}
const cachedStandardFiles = {};
function getStandardFile(name) {
  if (name in cachedStandardFiles) return cachedStandardFiles[name];
  else {
    const path = __dirname + '/standard/' + name.toLowerCase() + '.html';
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
function uglifyScript(script) {
  return (
    '!function(){' +
    closure({
      assumeFunctionWrapper: true,
      jsCode: [{src: script}],
      rewritePolyfills: true
    }).compiledCode +
    '}()'
  );
}
function compile(file, callback, omitReplacement, test) {
  console.error('Compiling ' + file);
  if (file.endsWith('.html') && !omitReplacement) {
    fs.readFile(file, (err, data) => {
      if (err) throw err;
      else {
        data = omitWhiteSpace(data.toString());
        if (!test) {
          const INLINE_SCRIPT = '<script>', INLINE_SCRIPT_END = '</script>';
          let startIndex = 0, nextIndex;
          while ((nextIndex = data.indexOf(INLINE_SCRIPT, startIndex)) !== -1) {
            const scriptStart = nextIndex + INLINE_SCRIPT.length;
            const endIndex = data.indexOf(INLINE_SCRIPT_END, scriptStart);
            const result = uglifyScript(data.substring(scriptStart, endIndex));
            data = data.substring(0, scriptStart) + result + data.substring(endIndex);
            startIndex = scriptStart + result.length + INLINE_SCRIPT_END.length;
          }
        }
        const STANDARD_MATCH = /<STANDARD_([A-Z]*) \/>/g;
        let match;
        while (match = STANDARD_MATCH.exec(data)) {
          let replaceRequest = match[0], resultFile = getStandardFile(match[1]), index = match.index;
          data = data.substring(0, index) + resultFile + data.substring(index + replaceRequest.length);
        }
        const SCRIPT_MATCH = /<script src = '(.+\.js)'><\/script>/g;
        while (match = SCRIPT_MATCH.exec(data)) {
          const resultFileName = match[1];
          if (resultFileName.indexOf('://') === -1) {
            const replaceRequest = match[0], resultFile = getResource(resultFileName, file), index = match.index;
            data = data.substring(0, index) + '<script>' + resultFile + '</script>' + data.substring(index + replaceRequest.length);
          }
        }
        const STYLE_MATCH = /<link href = '(.+\.css)' rel = 'stylesheet' \/>/g;
        while (match = STYLE_MATCH.exec(data)) {
          const resultFileName = match[1];
          if (resultFileName.indexOf('://') === -1) {
            const replaceRequest = match[0], resultFile = getResource(resultFileName, file), index = match.index;
            data = data.substring(0, index) + '<style>' + resultFile + '</style>' + data.substring(index + replaceRequest.length);
          }
        }
        if (!test) {
          const INLINE_STYLE = '<style>', INLINE_STYLE_END = '</style>';
          startIndex = 0;
          while ((nextIndex = data.indexOf(INLINE_STYLE, startIndex)) !== -1) {
            const styleStart = nextIndex + INLINE_STYLE.length;
            const endIndex = data.indexOf(INLINE_STYLE_END, styleStart);
            const result = new CleanCSS({
              'keepSpecialComments': 0
            }).minify(data.substring(styleStart, endIndex)).styles;
            data = data.substring(0, styleStart) + result + data.substring(endIndex);
            startIndex = styleStart + result.length + INLINE_STYLE_END.length;
          }
        }
        fs.writeFile(transformPath(file), data, err => {
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

const UNCOMPILED_FOLDERS = ['uploads', 'gl'];
const OMIT_FOLDERS = ['nbt/.git', 'uploads/data'];
[UNCOMPILED_FOLDERS, OMIT_FOLDERS].forEach(folders => {
  for (let i = 0; i < folders.length; i++) folders[i] = ROOT_DIR + '/' + folders[i];
});
function walkDir(dir, omitReplacement, test) {
  fs.mkdir(transformPath(dir), err => {
    if (err) throw err;
    else {
      fs.readdir(dir, (err, files) => {
        if (err) throw err;
        else {
          files.forEach(file => {
            file = dir + '/' + file;
            fs.stat(file, (err, stats) => {
              if (err) throw err;
              else {
                if (stats.isDirectory()) {
                  if (OMIT_FOLDERS.indexOf(file) === -1) walkDir(file, omitReplacement || UNCOMPILED_FOLDERS.indexOf(file) !== -1);
                }
                else compile(file, undefined, omitReplacement, test);
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
  files.forEach(file => {
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
module.exports.compileAll = test => {
  if (fs.existsSync(COMPILED_DIR)) rmDirRecursive(COMPILED_DIR);
  walkDir(ROOT_DIR, false, test);
};
module.exports.remove = file => {
  fs.unlink(transformPath(file), err => {});
};