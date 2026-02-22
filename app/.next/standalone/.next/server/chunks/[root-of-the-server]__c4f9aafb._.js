module.exports=[918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},779430,e=>{"use strict";var t=function(e,r){return(t=Object.setPrototypeOf||({__proto__:[]})instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(e[r]=t[r])})(e,r)};function r(e,r){if("function"!=typeof r&&null!==r)throw TypeError("Class extends value "+String(r)+" is not a constructor or null");function n(){this.constructor=e}t(e,r),e.prototype=null===r?Object.create(r):(n.prototype=r.prototype,new n)}var n=function(){return(n=Object.assign||function(e){for(var t,r=1,n=arguments.length;r<n;r++)for(var o in t=arguments[r])Object.prototype.hasOwnProperty.call(t,o)&&(e[o]=t[o]);return e}).apply(this,arguments)};function o(e,t){var r={};for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&0>t.indexOf(n)&&(r[n]=e[n]);if(null!=e&&"function"==typeof Object.getOwnPropertySymbols)for(var o=0,n=Object.getOwnPropertySymbols(e);o<n.length;o++)0>t.indexOf(n[o])&&Object.prototype.propertyIsEnumerable.call(e,n[o])&&(r[n[o]]=e[n[o]]);return r}function i(e,t,r,n){var o,i=arguments.length,a=i<3?t:null===n?n=Object.getOwnPropertyDescriptor(t,r):n;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)a=Reflect.decorate(e,t,r,n);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,r,a):o(t,r))||a);return i>3&&a&&Object.defineProperty(t,r,a),a}function a(e,t){return function(r,n){t(r,n,e)}}function s(e,t,r,n,o,i){function a(e){if(void 0!==e&&"function"!=typeof e)throw TypeError("Function expected");return e}for(var s,c=n.kind,l="getter"===c?"get":"setter"===c?"set":"value",u=!t&&e?n.static?e:e.prototype:null,d=t||(u?Object.getOwnPropertyDescriptor(u,n.name):{}),p=!1,f=r.length-1;f>=0;f--){var y={};for(var m in n)y[m]="access"===m?{}:n[m];for(var m in n.access)y.access[m]=n.access[m];y.addInitializer=function(e){if(p)throw TypeError("Cannot add initializers after decoration has completed");i.push(a(e||null))};var h=(0,r[f])("accessor"===c?{get:d.get,set:d.set}:d[l],y);if("accessor"===c){if(void 0===h)continue;if(null===h||"object"!=typeof h)throw TypeError("Object expected");(s=a(h.get))&&(d.get=s),(s=a(h.set))&&(d.set=s),(s=a(h.init))&&o.unshift(s)}else(s=a(h))&&("field"===c?o.unshift(s):d[l]=s)}u&&Object.defineProperty(u,n.name,d),p=!0}function c(e,t,r){for(var n=arguments.length>2,o=0;o<t.length;o++)r=n?t[o].call(e,r):t[o].call(e);return n?r:void 0}function l(e){return"symbol"==typeof e?e:"".concat(e)}function u(e,t,r){return"symbol"==typeof t&&(t=t.description?"[".concat(t.description,"]"):""),Object.defineProperty(e,"name",{configurable:!0,value:r?"".concat(r," ",t):t})}function d(e,t){if("object"==typeof Reflect&&"function"==typeof Reflect.metadata)return Reflect.metadata(e,t)}function p(e,t,r,n){return new(r||(r=Promise))(function(o,i){function a(e){try{c(n.next(e))}catch(e){i(e)}}function s(e){try{c(n.throw(e))}catch(e){i(e)}}function c(e){var t;e.done?o(e.value):((t=e.value)instanceof r?t:new r(function(e){e(t)})).then(a,s)}c((n=n.apply(e,t||[])).next())})}function f(e,t){var r,n,o,i={label:0,sent:function(){if(1&o[0])throw o[1];return o[1]},trys:[],ops:[]},a=Object.create(("function"==typeof Iterator?Iterator:Object).prototype);return a.next=s(0),a.throw=s(1),a.return=s(2),"function"==typeof Symbol&&(a[Symbol.iterator]=function(){return this}),a;function s(s){return function(c){var l=[s,c];if(r)throw TypeError("Generator is already executing.");for(;a&&(a=0,l[0]&&(i=0)),i;)try{if(r=1,n&&(o=2&l[0]?n.return:l[0]?n.throw||((o=n.return)&&o.call(n),0):n.next)&&!(o=o.call(n,l[1])).done)return o;switch(n=0,o&&(l=[2&l[0],o.value]),l[0]){case 0:case 1:o=l;break;case 4:return i.label++,{value:l[1],done:!1};case 5:i.label++,n=l[1],l=[0];continue;case 7:l=i.ops.pop(),i.trys.pop();continue;default:if(!(o=(o=i.trys).length>0&&o[o.length-1])&&(6===l[0]||2===l[0])){i=0;continue}if(3===l[0]&&(!o||l[1]>o[0]&&l[1]<o[3])){i.label=l[1];break}if(6===l[0]&&i.label<o[1]){i.label=o[1],o=l;break}if(o&&i.label<o[2]){i.label=o[2],i.ops.push(l);break}o[2]&&i.ops.pop(),i.trys.pop();continue}l=t.call(e,i)}catch(e){l=[6,e],n=0}finally{r=o=0}if(5&l[0])throw l[1];return{value:l[0]?l[1]:void 0,done:!0}}}}var y=Object.create?function(e,t,r,n){void 0===n&&(n=r);var o=Object.getOwnPropertyDescriptor(t,r);(!o||("get"in o?!t.__esModule:o.writable||o.configurable))&&(o={enumerable:!0,get:function(){return t[r]}}),Object.defineProperty(e,n,o)}:function(e,t,r,n){void 0===n&&(n=r),e[n]=t[r]};function m(e,t){for(var r in e)"default"===r||Object.prototype.hasOwnProperty.call(t,r)||y(t,e,r)}function h(e){var t="function"==typeof Symbol&&Symbol.iterator,r=t&&e[t],n=0;if(r)return r.call(e);if(e&&"number"==typeof e.length)return{next:function(){return e&&n>=e.length&&(e=void 0),{value:e&&e[n++],done:!e}}};throw TypeError(t?"Object is not iterable.":"Symbol.iterator is not defined.")}function b(e,t){var r="function"==typeof Symbol&&e[Symbol.iterator];if(!r)return e;var n,o,i=r.call(e),a=[];try{for(;(void 0===t||t-- >0)&&!(n=i.next()).done;)a.push(n.value)}catch(e){o={error:e}}finally{try{n&&!n.done&&(r=i.return)&&r.call(i)}finally{if(o)throw o.error}}return a}function _(){for(var e=[],t=0;t<arguments.length;t++)e=e.concat(b(arguments[t]));return e}function v(){for(var e=0,t=0,r=arguments.length;t<r;t++)e+=arguments[t].length;for(var n=Array(e),o=0,t=0;t<r;t++)for(var i=arguments[t],a=0,s=i.length;a<s;a++,o++)n[o]=i[a];return n}function g(e,t,r){if(r||2==arguments.length)for(var n,o=0,i=t.length;o<i;o++)!n&&o in t||(n||(n=Array.prototype.slice.call(t,0,o)),n[o]=t[o]);return e.concat(n||Array.prototype.slice.call(t))}function x(e){return this instanceof x?(this.v=e,this):new x(e)}function w(e,t,r){if(!Symbol.asyncIterator)throw TypeError("Symbol.asyncIterator is not defined.");var n,o=r.apply(e,t||[]),i=[];return n=Object.create(("function"==typeof AsyncIterator?AsyncIterator:Object).prototype),a("next"),a("throw"),a("return",function(e){return function(t){return Promise.resolve(t).then(e,l)}}),n[Symbol.asyncIterator]=function(){return this},n;function a(e,t){o[e]&&(n[e]=function(t){return new Promise(function(r,n){i.push([e,t,r,n])>1||s(e,t)})},t&&(n[e]=t(n[e])))}function s(e,t){try{var r;(r=o[e](t)).value instanceof x?Promise.resolve(r.value.v).then(c,l):u(i[0][2],r)}catch(e){u(i[0][3],e)}}function c(e){s("next",e)}function l(e){s("throw",e)}function u(e,t){e(t),i.shift(),i.length&&s(i[0][0],i[0][1])}}function k(e){var t,r;return t={},n("next"),n("throw",function(e){throw e}),n("return"),t[Symbol.iterator]=function(){return this},t;function n(n,o){t[n]=e[n]?function(t){return(r=!r)?{value:x(e[n](t)),done:!1}:o?o(t):t}:o}}function E(e){if(!Symbol.asyncIterator)throw TypeError("Symbol.asyncIterator is not defined.");var t,r=e[Symbol.asyncIterator];return r?r.call(e):(e=h(e),t={},n("next"),n("throw"),n("return"),t[Symbol.asyncIterator]=function(){return this},t);function n(r){t[r]=e[r]&&function(t){return new Promise(function(n,o){var i,a,s;i=n,a=o,s=(t=e[r](t)).done,Promise.resolve(t.value).then(function(e){i({value:e,done:s})},a)})}}}function P(e,t){return Object.defineProperty?Object.defineProperty(e,"raw",{value:t}):e.raw=t,e}var A=Object.create?function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}:function(e,t){e.default=t},O=function(e){return(O=Object.getOwnPropertyNames||function(e){var t=[];for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[t.length]=r);return t})(e)};function R(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r=O(e),n=0;n<r.length;n++)"default"!==r[n]&&y(t,e,r[n]);return A(t,e),t}function S(e){return e&&e.__esModule?e:{default:e}}function j(e,t,r,n){if("a"===r&&!n)throw TypeError("Private accessor was defined without a getter");if("function"==typeof t?e!==t||!n:!t.has(e))throw TypeError("Cannot read private member from an object whose class did not declare it");return"m"===r?n:"a"===r?n.call(e):n?n.value:t.get(e)}function N(e,t,r,n,o){if("m"===n)throw TypeError("Private method is not writable");if("a"===n&&!o)throw TypeError("Private accessor was defined without a setter");if("function"==typeof t?e!==t||!o:!t.has(e))throw TypeError("Cannot write private member to an object whose class did not declare it");return"a"===n?o.call(e,r):o?o.value=r:t.set(e,r),r}function T(e,t){if(null===t||"object"!=typeof t&&"function"!=typeof t)throw TypeError("Cannot use 'in' operator on non-object");return"function"==typeof e?t===e:e.has(t)}function C(e,t,r){if(null!=t){var n,o;if("object"!=typeof t&&"function"!=typeof t)throw TypeError("Object expected.");if(r){if(!Symbol.asyncDispose)throw TypeError("Symbol.asyncDispose is not defined.");n=t[Symbol.asyncDispose]}if(void 0===n){if(!Symbol.dispose)throw TypeError("Symbol.dispose is not defined.");n=t[Symbol.dispose],r&&(o=n)}if("function"!=typeof n)throw TypeError("Object not disposable.");o&&(n=function(){try{o.call(this)}catch(e){return Promise.reject(e)}}),e.stack.push({value:t,dispose:n,async:r})}else r&&e.stack.push({async:!0});return t}var I="function"==typeof SuppressedError?SuppressedError:function(e,t,r){var n=Error(r);return n.name="SuppressedError",n.error=e,n.suppressed=t,n};function q(e){function t(t){e.error=e.hasError?new I(t,e.error,"An error was suppressed during disposal."):t,e.hasError=!0}var r,n=0;return function o(){for(;r=e.stack.pop();)try{if(!r.async&&1===n)return n=0,e.stack.push(r),Promise.resolve().then(o);if(r.dispose){var i=r.dispose.call(r.value);if(r.async)return n|=2,Promise.resolve(i).then(o,function(e){return t(e),o()})}else n|=1}catch(e){t(e)}if(1===n)return e.hasError?Promise.reject(e.error):Promise.resolve();if(e.hasError)throw e.error}()}function U(e,t){return"string"==typeof e&&/^\.\.?\//.test(e)?e.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i,function(e,r,n,o,i){return r?t?".jsx":".js":!n||o&&i?n+o+"."+i.toLowerCase()+"js":e}):e}let $={__extends:r,__assign:n,__rest:o,__decorate:i,__param:a,__esDecorate:s,__runInitializers:c,__propKey:l,__setFunctionName:u,__metadata:d,__awaiter:p,__generator:f,__createBinding:y,__exportStar:m,__values:h,__read:b,__spread:_,__spreadArrays:v,__spreadArray:g,__await:x,__asyncGenerator:w,__asyncDelegator:k,__asyncValues:E,__makeTemplateObject:P,__importStar:R,__importDefault:S,__classPrivateFieldGet:j,__classPrivateFieldSet:N,__classPrivateFieldIn:T,__addDisposableResource:C,__disposeResources:q,__rewriteRelativeImportExtension:U};e.s(["__addDisposableResource",()=>C,"__assign",()=>n,"__asyncDelegator",()=>k,"__asyncGenerator",()=>w,"__asyncValues",()=>E,"__await",()=>x,"__awaiter",()=>p,"__classPrivateFieldGet",()=>j,"__classPrivateFieldIn",()=>T,"__classPrivateFieldSet",()=>N,"__createBinding",()=>y,"__decorate",()=>i,"__disposeResources",()=>q,"__esDecorate",()=>s,"__exportStar",()=>m,"__extends",()=>r,"__generator",()=>f,"__importDefault",()=>S,"__importStar",()=>R,"__makeTemplateObject",()=>P,"__metadata",()=>d,"__param",()=>a,"__propKey",()=>l,"__read",()=>b,"__rest",()=>o,"__rewriteRelativeImportExtension",()=>U,"__runInitializers",()=>c,"__setFunctionName",()=>u,"__spread",()=>_,"__spreadArray",()=>g,"__spreadArrays",()=>v,"__values",()=>h,"default",0,$])},244070,e=>{"use strict";var t=e.i(224389);let r=process.env.SUPABASE_URL,n=process.env.SUPABASE_ANON_KEY;r&&n||(console.warn("⚠️  Supabase not configured. Video upload and RAG features will be disabled."),console.warn("   To enable these features, set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local"));let o=r&&n?(0,t.createClient)(r,n):null;e.s(["supabase",0,o])},130316,e=>{"use strict";var t=e.i(244070),r=e.i(449735),n=e.i(781719);async function o(e,n,i=3){let a=await (0,r.generateQueryEmbedding)(n),{data:s,error:c}=await t.supabase.rpc("search_video_nodes",{query_embedding:a,target_video_id:e,match_threshold:.5,match_count:i});if(c)throw console.error("Search nodes error:",c),Error(`Failed to search nodes: ${c.message}`);return s}async function i(e,r,n=3){let{data:o,error:a}=await t.supabase.from("video_nodes").select("*").eq("video_id",e).overlaps("key_concepts",r).order("order",{ascending:!0}).limit(n);if(a)throw console.error("Search by keywords error:",a),Error(`Failed to search by keywords: ${a.message}`);return o}async function a(e,t,r=[],n=3){let[s,c]=await Promise.all([o(e,t,n),r.length>0?i(e,r,n):Promise.resolve([])]),l=new Map;for(let e of s)l.set(e.id,{...e,similarity:.7*e.similarity});for(let e of c){let t=l.get(e.id);if(t)t.similarity+=.3;else{let{embedding:t,...r}=e;l.set(e.id,{...r,similarity:.3})}}return Array.from(l.values()).sort((e,t)=>t.similarity-e.similarity).slice(0,n)}async function s(e,r){if(!t.supabase)return console.log("Supabase not configured, using fallback node by time for video:",e),(0,n.getFallbackNodeByTime)(e,r);let o=Math.floor(r),{data:i,error:a}=await t.supabase.from("video_nodes").select("*").eq("video_id",e).lte("start_time",o).gte("end_time",o).single();return a?("PGRST116"===a.code||console.error("Get node by time error:",a),(0,n.getFallbackNodeByTime)(e,r)):i}async function c(e){if(!t.supabase)return console.log("Supabase not configured, using fallback nodes for video:",e),(0,n.getFallbackNodes)(e);let{data:r,error:o}=await t.supabase.from("video_nodes").select("*").eq("video_id",e).order("order",{ascending:!0});return o?(console.error("Get all nodes error:",o),console.log("Falling back to hardcoded nodes"),(0,n.getFallbackNodes)(e)):r}function l(e){let t=Math.floor(e/60),r=Math.floor(e%60);return`${t}:${r.toString().padStart(2,"0")}`}function u(e,t){let r="";if(e&&(r+=`
## 当前播放的知识点

【${e.title}】(${l(e.start_time)} - ${l(e.end_time)})
${e.summary}

详细内容：
${e.transcript||"(无详细内容)"}
`),t.length>0){let n=t.filter(t=>t.id!==e?.id);if(n.length>0)for(let e of(r+=`
## 相关知识点

以下是本节课中与学生问题可能相关的其他部分：
`,n))r+=`
【${e.title}】(${l(e.start_time)} - ${l(e.end_time)})
${e.summary}
关键词: ${e.key_concepts.join(", ")}
`}return r}e.s(["assembleRAGContext",()=>u,"getAllNodes",()=>c,"getNodeByTime",()=>s,"hybridSearch",()=>a])},449735,e=>{"use strict";e.i(889228);var t=e.i(91601);let r=process.env.DASHSCOPE_API_KEY?new t.default({apiKey:process.env.DASHSCOPE_API_KEY,baseURL:"https://dashscope.aliyuncs.com/compatible-mode/v1"}):null,n=process.env.OPENAI_API_KEY?new t.default({apiKey:process.env.OPENAI_API_KEY}):null;async function o(e){if(!r)throw Error("DashScope client not available");return(await r.embeddings.create({model:"text-embedding-v4",input:e,dimensions:1024})).data[0].embedding}async function i(e){if(!n)throw Error("OpenAI client not available");return(await n.embeddings.create({model:"text-embedding-3-small",input:e,dimensions:1024})).data[0].embedding}async function a(e){if(r)try{return await o(e)}catch(e){console.warn("DashScope embedding failed, falling back to OpenAI:",e)}if(n)return await i(e);throw Error("No embedding API available. Please set DASHSCOPE_API_KEY or OPENAI_API_KEY.")}async function s(e){return a(`查询: ${e}`)}async function c(e,t){return a(`${e} 关键词: ${t.join(", ")}`)}e.s(["generateDocumentEmbedding",()=>c,"generateQueryEmbedding",()=>s])},781719,e=>{"use strict";let t=[{id:"demo-node-0",order:0,title:"引入：为什么要学一元二次方程",start_time:0,end_time:60,summary:"讲解一次方程的局限性，引出二次方程的必要性。通过实际问题 x(x+3)=18 说明一次方程无法解决某些问题。",key_concepts:["一次方程","二次方程","方程的次数","一次方程的局限性"],node_type:"intro",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"quick_check",intervention:{intro:'我停一下。你现在如果只是觉得"二次方程更厉害"，后面你会不知道它到底解决了什么问题。',question:"我只问一句：用一次方程，能不能解 x(x+3)=18？回答：能 / 不能。",expectedAnswers:["能","不能"]},teacherNote:"动机段必停点 - 确保学生理解为什么需要二次方程",mistakePattern:'学生可能只是觉得二次方程"更厉害"，但不理解它解决了什么实际问题'}},{id:"demo-node-1",order:1,title:"什么是整式方程",start_time:60,end_time:120,summary:"介绍整式方程的概念，方程两边都是整式，没有分母中含有未知数的情况。",key_concepts:["整式方程","方程","未知数"],node_type:"concept"},{id:"demo-node-2",order:2,title:"一元二次方程的定义",start_time:120,end_time:210,summary:"定义一元二次方程：只含有一个未知数，并且未知数的最高次数是2的整式方程。标准形式：ax²+bx+c=0（a≠0）。",key_concepts:["一元二次方程","二次项","一次项","常数项","二次项系数"],node_type:"concept",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"trap_alert",intervention:{intro:"我必须在这停一下。这里如果你理解错，后面你会把很多方程全都分错类。",question:"我说一个式子，你只回答对或不对：x² + x = 0 是一元二次方程。对不对？",expectedAnswers:["对","不对","是","不是"],followUp:"我再换一个：x + 1 = 0 是不是一元二次方程？回答：是 / 不是。"},teacherNote:"最高频错误源",mistakePattern:"学生会误以为只要有x²就行，不理解最高次数的含义"}},{id:"demo-node-3",order:3,title:"判断一元二次方程",start_time:210,end_time:300,summary:"通过例题学习如何判断一个方程是否为一元二次方程，重点是化简后的形式和二次项系数不为0。",key_concepts:["化简","判断方程类型","二次项系数不为0"],node_type:"example",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"trap_alert",intervention:{intro:"我必须在这停一下。因为这是最容易被题目骗的地方。",question:"我说一句，你告诉我结论：两边化简后如果没有x²，它还是不是一元二次方程？回答：是 / 不是。",expectedAnswers:["是","不是"]},teacherNote:"学生会被题目外表骗",mistakePattern:"学生会被方程的外表骗，而且非常自信地错"}},{id:"demo-node-4",order:4,title:"常见错误和注意事项",start_time:300,end_time:367,summary:"总结判断一元二次方程时的常见错误，强调必须化简到最简形式，注意二次项系数a≠0的条件。",key_concepts:["常见错误","化简","a≠0"],node_type:"summary",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"final_check",intervention:{intro:"我最后点你一次名。你不用解释，只回答。",question:"判断一元二次方程需要满足三个条件。第一个：只有一个未知数？回答：是 / 不是。",expectedAnswers:["是","不是"],followUp:"第二个：最高次数是2？第三个：是不是整式？分别回答。"},teacherNote:"终检：是否可以放你走",mistakePattern:"老师用快速判断确认学生真的懂了"}}],r=[{id:"linear-node-0",order:0,title:"引入：从实际问题认识一次函数",start_time:0,end_time:180,summary:"通过实际问题（如行程问题、话费问题）引入一次函数的概念，让学生理解一次函数描述的是均匀变化的关系。",key_concepts:["函数","变量关系","均匀变化","实际问题建模"],node_type:"intro",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"quick_check",intervention:{intro:"我停一下。你得先搞清楚一次函数描述的是什么样的变化。",question:"小明每分钟走 80 米，走了 x 分钟，路程 y 米。月租 10 元、每分钟 0.1 元的话费也是 y 和 x 的关系。这两个关系有什么共同点？回答：都是均匀变化 / 没有共同点。",expectedAnswers:["都是均匀变化","均匀变化","都是"]},teacherNote:"引入段 - 建立一次函数 = 均匀变化的直觉",mistakePattern:"学生只是觉得一次函数是个公式，不理解它对应什么现实关系"}},{id:"linear-node-1",order:1,title:"一次函数的定义：y = kx + b",start_time:180,end_time:360,summary:"定义一次函数：形如 y = kx + b（k≠0）的函数叫做一次函数。k 是一次项系数，b 是常数项。重点强调 k≠0 这个条件。",key_concepts:["一次函数定义","y=kx+b","k≠0","一次项系数","常数项"],node_type:"concept",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"trap_alert",intervention:{intro:"我必须在这停一下。这个地方很多同学会栽。",question:"y = 0 乘以 x + 3，也就是 y = 3，是不是一次函数？回答：是 / 不是。",expectedAnswers:["是","不是"],followUp:"为什么？因为 k 等于多少？它违反了什么条件？"},teacherNote:"k≠0 是最关键的条件，必须单独停",mistakePattern:"学生看到 y=kx+b 的形式就直接套，忽略 k≠0"}},{id:"linear-node-2",order:2,title:"正比例函数与一次函数的关系",start_time:360,end_time:530,summary:"正比例函数 y=kx 是一次函数 y=kx+b 中 b=0 的特殊情况。所有正比例函数都是一次函数，但一次函数不一定是正比例函数。",key_concepts:["正比例函数","b=0","特殊与一般","包含关系"],node_type:"concept",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"trap_alert",intervention:{intro:"这个地方考试经常出判断题，你必须分清楚。",question:"y = 3x 是正比例函数，它是不是一次函数？回答：是 / 不是。",expectedAnswers:["是","不是"],followUp:"反过来：y = 3x + 1 是一次函数，它是不是正比例函数？回答：是 / 不是。"},teacherNote:"正比例函数 ⊂ 一次函数，包含关系必须搞清",mistakePattern:"学生分不清谁包含谁，或者认为一次函数和正比例函数是完全不同的东西"}},{id:"linear-node-3",order:3,title:"一次函数的图像：描点法",start_time:530,end_time:730,summary:"一次函数 y=kx+b 的图像是一条直线。用描点法画图：列表取值、描点、连线。画直线只需要两个点。",key_concepts:["直线","描点法","列表取值","两点确定直线"],node_type:"concept",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"quick_check",intervention:{intro:"我问你一个关键问题。",question:"一次函数的图像是什么形状？回答：直线 / 曲线。",expectedAnswers:["直线","曲线"],followUp:"那画这条直线，最少需要描几个点？"},teacherNote:"图像是直线 + 两点确定，这是画图的基础",mistakePattern:"学生可能多描很多点，不理解直线的性质"}},{id:"linear-node-4",order:4,title:"画图实操：选点技巧",start_time:730,end_time:900,summary:"画一次函数图像时，通常选取 x=0 和 y=0 两个特殊点（即与 y 轴和 x 轴的交点），这样计算最简便。通过实例练习画图。",key_concepts:["与y轴交点","与x轴交点","特殊点","画图步骤"],node_type:"example",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"quick_check",intervention:{intro:"你来试一个。",question:"画 y = 2x + 4 的图像。令 x = 0，y 等于多少？回答一个数。",expectedAnswers:["4","四"],followUp:"再令 y = 0，x 等于多少？"},teacherNote:"让学生实际算一次，比只听讲记得牢",mistakePattern:"学生会算错令 y=0 时的 x 值，或者不知道要令 y=0"}},{id:"linear-node-5",order:5,title:"k 的几何意义：斜率与增减性",start_time:900,end_time:1100,summary:"k 决定直线的倾斜方向和程度：k>0 时直线从左到右上升（y 随 x 增大而增大），k<0 时下降。|k| 越大，直线越陡。",key_concepts:["斜率","增减性","k>0上升","k<0下降","|k|与陡度"],node_type:"concept",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"trap_alert",intervention:{intro:"这是一次函数最核心的东西。搞混了后面全错。",question:"k 大于 0 时，直线从左到右是上升还是下降？回答：上升 / 下降。",expectedAnswers:["上升","下降"],followUp:"y = 2x + 1 和 y = 5x + 1，哪条直线更陡？回答：y=2x+1 / y=5x+1。"},teacherNote:"k 的符号 → 方向，|k| → 陡度，两个都要测",mistakePattern:"学生记住了 k>0 上升但不理解为什么，|k| 和陡度的关系更容易混"}},{id:"linear-node-6",order:6,title:"b 的几何意义：截距",start_time:1100,end_time:1270,summary:"b 是直线与 y 轴交点的纵坐标，叫做截距。b>0 交点在 x 轴上方，b<0 在下方，b=0 过原点（退化为正比例函数）。",key_concepts:["截距","y轴交点","b的正负","b=0过原点"],node_type:"concept",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"quick_check",intervention:{intro:"截距这个概念很多同学会搞错。",question:"y = -3x + 5 这条直线和 y 轴交在哪个点？回答坐标。",expectedAnswers:["0,5","(0,5)","零五","0 5","零逗号五"],followUp:"如果 b = 0，直线一定过哪个点？"},teacherNote:"截距 ≠ 距离，很多学生搞混",mistakePattern:"学生以为截距是直线到原点的距离，或者分不清在 y 轴上方还是下方"}},{id:"linear-node-7",order:7,title:"一次函数图像经过的象限",start_time:1270,end_time:1430,summary:"根据 k 和 b 的正负号组合，可以判断一次函数图像经过哪些象限。k>0,b>0 经过一二三象限；k>0,b<0 经过一三四象限；k<0,b>0 经过一二四象限；k<0,b<0 经过二三四象限。",key_concepts:["象限分布","k和b的符号","图像位置判断"],node_type:"concept",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"trap_alert",intervention:{intro:"这个地方考试必考。你得会从 k 和 b 的符号判断图像过哪几个象限。",question:"y = -x + 2，k 是负的，b 是正的。这条直线不经过哪个象限？回答：第一 / 第二 / 第三 / 第四。",expectedAnswers:["第三","三","第三象限"],followUp:"那如果 k 和 b 都是负的，比如 y = -x - 1，不经过第几象限？"},teacherNote:"象限判断是中考选择题高频考点",mistakePattern:"学生死记四种情况但不理解为什么，换个问法就不会了"}},{id:"linear-node-8",order:8,title:"总结：一次函数知识体系",start_time:1430,end_time:1593,summary:"总结一次函数的完整知识体系：定义(y=kx+b, k≠0)、与正比例函数的关系(b=0)、图像(直线)、k的意义(方向和陡度)、b的意义(截距)、象限分布。",key_concepts:["一次函数性质","增减性","图像特征","知识体系"],node_type:"summary",criticalCheckpoint:{enabled:!0,trigger:"auto",interventionType:"final_check",intervention:{intro:"最后我连问你三个，快速回答，不用解释。",question:"第一：一次函数 y=kx+b 中，k 不能等于什么？",expectedAnswers:["0","零"],followUp:"第二：k 大于 0，函数是增函数还是减函数？第三：b 等于 0 时，它就变成了什么函数？"},teacherNote:"终检三连问：k≠0、增减性、正比例函数关系",mistakePattern:"快速检验学生是否真正掌握了三个核心知识点"}}];function n(e){return"demo"===e?t:"linear-function"===e?r:[]}function o(e,t){return n(e).find(e=>t>=e.start_time&&t<e.end_time)||null}e.s(["getFallbackNodeByTime",()=>o,"getFallbackNodes",()=>n])},818645,e=>{"use strict";var t=e.i(747909),r=e.i(174017),n=e.i(996250),o=e.i(759756),i=e.i(561916),a=e.i(174677),s=e.i(869741),c=e.i(316795),l=e.i(487718),u=e.i(995169),d=e.i(47587),p=e.i(666012),f=e.i(570101),y=e.i(626937),m=e.i(10372),h=e.i(193695);e.i(52474);var b=e.i(600220),_=e.i(89171);e.i(889228);var v=e.i(91601);let g=`你是一位专业的数学老师，擅长通过绘图来讲解数学概念。你的任务是生成一个"边画边讲"的脚本，包含讲解文字和对应的绘图指令。

## 输出格式

你必须输出一个 JSON 对象，格式如下：

\`\`\`json
{
  "title": "主题名称",
  "opening": "开场白，简短介绍要讲解的内容",
  "steps": [
    {
      "id": "step-1",
      "narration": "这一步的讲解文字",
      "shapes": [
        {
          "type": "triangle",
          "x": 200,
          "y": 100,
          "width": 150,
          "height": 130,
          "color": "blue"
        }
      ],
      "clearBefore": false
    }
  ],
  "closing": "总结语，回顾要点"
}
\`\`\`

## 可用的形状类型

基础几何形状：
- rectangle: 矩形
- ellipse: 椭圆/圆形
- triangle: 三角形
- diamond: 菱形

多边形：
- pentagon: 五边形
- hexagon: 六边形
- octagon: 八边形

特殊形状：
- star: 星形
- rhombus: 菱形
- oval: 椭圆
- trapezoid: 梯形
- heart: 心形
- cloud: 云朵

箭头：
- arrow-right, arrow-left, arrow-up, arrow-down: 方向箭头
- arrow: 自定义箭头（需要 width/height 指定方向）

线条：
- line: 直线或折线（需要 points 数组）
- freehand: 手绘线条（需要 points 数组）

文字：
- text: 文字标注（需要 text 属性）

## 形状属性

每个形状必须包含：
- type: 形状类型
- x: 左上角 X 坐标（画布宽度约 800）
- y: 左上角 Y 坐标（画布高度约 600）

可选属性：
- width: 宽度（默认 100）
- height: 高度（默认 100）
- color: 颜色（red, blue, green, yellow, orange, violet, black, grey）
- text: 文字内容（仅 text 类型需要）
- points: 点数组（仅 line 和 freehand 类型需要）

## 绘图规范

1. 画布大小约为 800x600，请合理布局
2. 每个步骤的讲解文字应该简洁明了，适合语音播放
3. 形状应该与讲解内容对应，帮助学生理解
4. 使用不同颜色区分不同元素
5. 步骤数量控制在 3-6 步，每步讲解 1-2 句话
6. 开场白和总结语各 1-2 句话

## 示例

用户问："画一个等腰三角形讲解它的性质"

输出：
\`\`\`json
{
  "title": "等腰三角形的性质",
  "opening": "好的，我来为你画图讲解等腰三角形的性质。",
  "steps": [
    {
      "id": "step-1",
      "narration": "首先，我们画一个等腰三角形。等腰三角形有两条边相等。",
      "shapes": [
        {
          "type": "triangle",
          "x": 300,
          "y": 100,
          "width": 200,
          "height": 200,
          "color": "blue"
        }
      ],
      "clearBefore": true
    },
    {
      "id": "step-2",
      "narration": "这两条相等的边叫做腰，用红色标记。",
      "shapes": [
        {
          "type": "line",
          "x": 0,
          "y": 0,
          "color": "red",
          "points": [
            {"x": 400, "y": 100},
            {"x": 300, "y": 300}
          ]
        },
        {
          "type": "line",
          "x": 0,
          "y": 0,
          "color": "red",
          "points": [
            {"x": 400, "y": 100},
            {"x": 500, "y": 300}
          ]
        }
      ]
    },
    {
      "id": "step-3",
      "narration": "等腰三角形的两个底角相等，这是它最重要的性质。",
      "shapes": [
        {
          "type": "text",
          "x": 280,
          "y": 320,
          "text": "底角",
          "color": "green"
        },
        {
          "type": "text",
          "x": 480,
          "y": 320,
          "text": "底角",
          "color": "green"
        }
      ]
    }
  ],
  "closing": "记住：等腰三角形两腰相等，两底角也相等。这就是等边对等角的性质。"
}
\`\`\`

请根据用户的问题生成绘图脚本。只输出 JSON，不要有其他内容。`;var x=e.i(130316);async function w(e){try{var t;let r,n,{userQuery:o,videoContext:i,videoId:a,currentTime:s}=await e.json();if(!o)return _.NextResponse.json({error:"userQuery is required"},{status:400});let c=process.env.OPENAI_API_KEY;if(!c)return _.NextResponse.json({error:"OPENAI_API_KEY not configured"},{status:500});let l=i||"";if(a&&"number"==typeof s)try{let e=await (0,x.getNodeByTime)(a,s);e&&(l+=`
当前知识点：${e.title}
${e.summary||""}`)}catch(e){console.error("Failed to get node context:",e)}let u=new v.default({apiKey:c}),d=await u.chat.completions.create({model:process.env.DRAW_EXPLAIN_MODEL||"gpt-4o",messages:[{role:"system",content:g},{role:"user",content:(t=l,n=`用户问题：${o}`,t&&(n+=`

当前视频上下文：${t}`),n)}],max_tokens:4096,temperature:.7}),p=d.choices?.[0]?.message?.content;if(!p)return _.NextResponse.json({error:"No text response from GPT-4o"},{status:500});try{let e=p,t=e.match(/```json\s*([\s\S]*?)\s*```/);t&&(e=t[1]),r=JSON.parse(e)}catch(e){return console.error("Failed to parse drawing script:",e),console.error("Raw response:",p),_.NextResponse.json({error:"Failed to parse drawing script from GPT-4o response"},{status:500})}if(!r.title||!r.opening||!r.steps||!r.closing)return _.NextResponse.json({error:"Invalid drawing script structure"},{status:500});return _.NextResponse.json({script:r})}catch(e){return console.error("Error generating drawing script:",e),_.NextResponse.json({error:e instanceof Error?e.message:"Internal server error"},{status:500})}}e.s(["POST",()=>w],124222);var k=e.i(124222);let E=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/voice/draw-explain/generate/route",pathname:"/api/voice/draw-explain/generate",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/voice/draw-explain/generate/route.ts",nextConfigOutput:"standalone",userland:k}),{workAsyncStorage:P,workUnitAsyncStorage:A,serverHooks:O}=E;function R(){return(0,n.patchFetch)({workAsyncStorage:P,workUnitAsyncStorage:A})}async function S(e,t,n){E.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/voice/draw-explain/generate/route";_=_.replace(/\/index$/,"")||"/";let v=await E.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!v)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:g,params:x,nextConfig:w,parsedUrl:k,isDraftMode:P,prerenderManifest:A,routerServerContext:O,isOnDemandRevalidate:R,revalidateOnlyGenerated:S,resolvedPathname:j,clientReferenceManifest:N,serverActionsManifest:T}=v,C=(0,s.normalizeAppPath)(_),I=!!(A.dynamicRoutes[C]||A.routes[j]),q=async()=>((null==O?void 0:O.render404)?await O.render404(e,t,k,!1):t.end("This page could not be found"),null);if(I&&!P){let e=!!A.routes[j],t=A.dynamicRoutes[C];if(t&&!1===t.fallback&&!e){if(w.experimental.adapterPath)return await q();throw new h.NoFallbackError}}let U=null;!I||E.isDev||P||(U="/index"===(U=j)?"/":U);let $=!0===E.isDev||!I,D=I&&!$;T&&N&&(0,a.setManifestsSingleton)({page:_,clientReferenceManifest:N,serverActionsManifest:T});let F=e.method||"GET",K=(0,i.getTracer)(),H=K.getActiveScopeSpan(),M={params:x,prerenderManifest:A,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:$,incrementalCache:(0,o.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:w.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,n,o)=>E.onRequestError(e,t,n,o,O)},sharedContext:{buildId:g}},B=new c.NodeNextRequest(e),G=new c.NodeNextResponse(t),L=l.NextRequestAdapter.fromNodeNextRequest(B,(0,l.signalFromNodeResponse)(t));try{let a=async e=>E.handle(L,M).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=K.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${F} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t)}else e.updateName(`${F} ${_}`)}),s=!!(0,o.getRequestMeta)(e,"minimalMode"),c=async o=>{var i,c;let l=async({previousCacheEntry:r})=>{try{if(!s&&R&&S&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let i=await a(o);e.fetchMetrics=M.renderOpts.fetchMetrics;let c=M.renderOpts.pendingWaitUntil;c&&n.waitUntil&&(n.waitUntil(c),c=void 0);let l=M.renderOpts.collectedTags;if(!I)return await (0,p.sendResponse)(B,G,i,M.renderOpts.pendingWaitUntil),null;{let e=await i.blob(),t=(0,f.toNodeOutgoingHttpHeaders)(i.headers);l&&(t[m.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=m.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,n=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=m.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:b.CachedRouteKind.APP_ROUTE,status:i.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==r?void 0:r.isStale)&&await E.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:R})},!1,O),t}},u=await E.handleResponse({req:e,nextConfig:w,cacheKey:U,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:R,revalidateOnlyGenerated:S,responseGenerator:l,waitUntil:n.waitUntil,isMinimalMode:s});if(!I)return null;if((null==u||null==(i=u.value)?void 0:i.kind)!==b.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(c=u.value)?void 0:c.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});s||t.setHeader("x-nextjs-cache",R?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),P&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let h=(0,f.fromNodeOutgoingHttpHeaders)(u.value.headers);return s&&I||h.delete(m.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||h.get("Cache-Control")||h.set("Cache-Control",(0,y.getCacheControlHeader)(u.cacheControl)),await (0,p.sendResponse)(B,G,new Response(u.value.body,{headers:h,status:u.value.status||200})),null};H?await c(H):await K.withPropagatedContext(e.headers,()=>K.trace(u.BaseServerSpan.handleRequest,{spanName:`${F} ${_}`,kind:i.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},c))}catch(t){if(t instanceof h.NoFallbackError||await E.onRequestError(e,t,{routerKind:"App Router",routePath:C,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:R})},!1,O),I)throw t;return await (0,p.sendResponse)(B,G,new Response(null,{status:500})),null}}e.s(["handler",()=>S,"patchFetch",()=>R,"routeModule",()=>E,"serverHooks",()=>O,"workAsyncStorage",()=>P,"workUnitAsyncStorage",()=>A],818645)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__c4f9aafb._.js.map