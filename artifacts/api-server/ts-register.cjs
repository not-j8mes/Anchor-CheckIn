'use strict';
const Module = require('module');
const fs = require('fs');
const ts = require('/home/runner/workspace/node_modules/typescript/lib/typescript.js');

const tsCompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  resolveJsonModule: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: false,
  strict: false,
  skipLibCheck: true,
  sourceMap: false,
};

function compileTsFile(source, filename) {
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: tsCompilerOptions,
  });
  return result.outputText;
}

function registerExtension(ext) {
  require.extensions[ext] = function (module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const compiled = compileTsFile(source, filename);
    module._compile(compiled, filename);
  };
}

registerExtension('.ts');
registerExtension('.tsx');
registerExtension('.mts');
registerExtension('.cts');
