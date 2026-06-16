// react/jsx-runtime — auto-generated ESM vendor bundle
  var __mod_exports = {};
  (function(module, exports) {
  "use strict";
  /**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";
var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"),
  REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
function jsxProd(type, config, maybeKey) {
  var key = null;
  void 0 !== maybeKey && (key = "" + maybeKey);
  void 0 !== config.key && (key = "" + config.key);
  if ("key" in config) {
    maybeKey = {};
    for (var propName in config)
      "key" !== propName && (maybeKey[propName] = config[propName]);
  } else maybeKey = config;
  config = maybeKey.ref;
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: type,
    key: key,
    ref: void 0 !== config ? config : null,
    props: maybeKey
  };
}
exports.Fragment = REACT_FRAGMENT_TYPE;
exports.jsx = jsxProd;
exports.jsxs = jsxProd;

  })({exports: __mod_exports}, __mod_exports);
  export default __mod_exports;
  var __x_Fragment = __mod_exports["Fragment"];
var __x_jsx = __mod_exports["jsx"];
var __x_jsxs = __mod_exports["jsxs"];
  export { __x_Fragment as Fragment };
export { __x_jsx as jsx };
export { __x_jsxs as jsxs };
  