"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@math.gl+types@4.1.0";
exports.ids = ["vendor-chunks/@math.gl+types@4.1.0"];
exports.modules = {

/***/ "(ssr)/../../node_modules/.pnpm/@math.gl+types@4.1.0/node_modules/@math.gl/types/dist/is-array.js":
/*!**************************************************************************************************!*\
  !*** ../../node_modules/.pnpm/@math.gl+types@4.1.0/node_modules/@math.gl/types/dist/is-array.js ***!
  \**************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   isNumberArray: () => (/* binding */ isNumberArray),\n/* harmony export */   isNumericArray: () => (/* binding */ isNumericArray),\n/* harmony export */   isTypedArray: () => (/* binding */ isTypedArray)\n/* harmony export */ });\n// math.gl\n// SPDX-License-Identifier: MIT\n// Copyright (c) vis.gl contributors\n/**\n * Check is an array is a typed array\n * @param value value to be tested\n * @returns input with type narrowed to TypedArray, or null\n */\nfunction isTypedArray(value) {\n    return ArrayBuffer.isView(value) && !(value instanceof DataView);\n}\n/**\n * Check is an array is an array of numbers)\n * @param value value to be tested\n * @returns input with type narrowed to NumberArray, or null\n */\nfunction isNumberArray(value) {\n    if (Array.isArray(value)) {\n        return value.length === 0 || typeof value[0] === 'number';\n    }\n    return false;\n}\n/**\n * Check is an array is a numeric array (typed array or array of numbers)\n * @param value value to be tested\n * @returns input with type narrowed to NumericArray, or null\n */\nfunction isNumericArray(value) {\n    return isTypedArray(value) || isNumberArray(value);\n}\n//# sourceMappingURL=is-array.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0BtYXRoLmdsK3R5cGVzQDQuMS4wL25vZGVfbW9kdWxlcy9AbWF0aC5nbC90eXBlcy9kaXN0L2lzLWFycmF5LmpzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBIiwic291cmNlcyI6WyIvVXNlcnMvb2ppZWFtZS9GaWVsZFB1bHNlLXYzL25vZGVfbW9kdWxlcy8ucG5wbS9AbWF0aC5nbCt0eXBlc0A0LjEuMC9ub2RlX21vZHVsZXMvQG1hdGguZ2wvdHlwZXMvZGlzdC9pcy1hcnJheS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBtYXRoLmdsXG4vLyBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTUlUXG4vLyBDb3B5cmlnaHQgKGMpIHZpcy5nbCBjb250cmlidXRvcnNcbi8qKlxuICogQ2hlY2sgaXMgYW4gYXJyYXkgaXMgYSB0eXBlZCBhcnJheVxuICogQHBhcmFtIHZhbHVlIHZhbHVlIHRvIGJlIHRlc3RlZFxuICogQHJldHVybnMgaW5wdXQgd2l0aCB0eXBlIG5hcnJvd2VkIHRvIFR5cGVkQXJyYXksIG9yIG51bGxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVHlwZWRBcnJheSh2YWx1ZSkge1xuICAgIHJldHVybiBBcnJheUJ1ZmZlci5pc1ZpZXcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBEYXRhVmlldyk7XG59XG4vKipcbiAqIENoZWNrIGlzIGFuIGFycmF5IGlzIGFuIGFycmF5IG9mIG51bWJlcnMpXG4gKiBAcGFyYW0gdmFsdWUgdmFsdWUgdG8gYmUgdGVzdGVkXG4gKiBAcmV0dXJucyBpbnB1dCB3aXRoIHR5cGUgbmFycm93ZWQgdG8gTnVtYmVyQXJyYXksIG9yIG51bGxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTnVtYmVyQXJyYXkodmFsdWUpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLmxlbmd0aCA9PT0gMCB8fCB0eXBlb2YgdmFsdWVbMF0gPT09ICdudW1iZXInO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG4vKipcbiAqIENoZWNrIGlzIGFuIGFycmF5IGlzIGEgbnVtZXJpYyBhcnJheSAodHlwZWQgYXJyYXkgb3IgYXJyYXkgb2YgbnVtYmVycylcbiAqIEBwYXJhbSB2YWx1ZSB2YWx1ZSB0byBiZSB0ZXN0ZWRcbiAqIEByZXR1cm5zIGlucHV0IHdpdGggdHlwZSBuYXJyb3dlZCB0byBOdW1lcmljQXJyYXksIG9yIG51bGxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTnVtZXJpY0FycmF5KHZhbHVlKSB7XG4gICAgcmV0dXJuIGlzVHlwZWRBcnJheSh2YWx1ZSkgfHwgaXNOdW1iZXJBcnJheSh2YWx1ZSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pcy1hcnJheS5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/../../node_modules/.pnpm/@math.gl+types@4.1.0/node_modules/@math.gl/types/dist/is-array.js\n");

/***/ })

};
;