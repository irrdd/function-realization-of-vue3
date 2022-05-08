/*
 * @Author: 王东旭
 * @Date: 2022-05-03 15:33:42
 * @LastEditTime: 2022-05-08 11:48:23
 * @LastEditors: 王东旭
 * @Description: 
 * @FilePath: \function-realization-of-vue3\src\reactive\5.7代理数组.js
 * @ 
 */
/*
 * @Author: 王东旭
 * @Date: 2022-04-17 22:56:54
 * @LastEditTime: 2022-04-18 21:46:26
 * @LastEditors: 王东旭
 * @Description:
 * @FilePath: \function-realization-of-vue3\src\reactive\5.7代理数组.js
 * @
 */
// ?直接用Set作为桶的数据结构，则没有副作用函数与被操作的目标字段之间建立明确的联系，导致不相干的字段改变也会触发副作用函数
// const bucket = new Set()

//! 重新设计桶的数据结构
// 采用WeakMap,当数据没有被引用时，就会被垃圾回收机制回收
/**
 * bucket的数据结构
 * WeakMap:{
 *  target1: Map:{
 *         key1: Set:{
 *              function1,
 *              function2
 *                  },
 *         key2: Set:{
 *              function1,
 *              function2
 *                  },
 *               },
 *  target2: Map:{
 *         key1: Set:{
 *              function1,
 *              function2
 *                  },
 *         key2: Set:{
 *              function1,
 *              function2
 *                  },
 *               },
 *
 *
 * }
 */
const bucket = new WeakMap();
// 全局变量，注册副作用函数
let activeEffect;
// effect 栈
const effectStack = [];
// 储存数组原型上方法
// !储存重写数组的方法
const arrayInstrumentations = resetArrayMethod();
// !解决push方法在两个独立副作用函数中使用栈溢出的问题
// ? 一个标记变量，代表是否进行追踪
let shouldTrack = true;
/*******
 * @description: 重写数组上的方法
 * @return {*}
 */
function resetArrayMethod() {
  const arrayInstrumentations = {};
  let originMethod;
  ["includes", "indexOf", "lastIndexOf"].forEach((method) => {
    originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function (...args) {
      // ! this是代理对象，现在代理对象上查找
      let res = originMethod.apply(this, args);
      // 找不到就通过this.raw到原始数组上查找
      if (!res) {
        res = originMethod.apply(this.raw, args);
      }
      return res;
    };
  });
  ["push", "pop", "shift", "unshift", "splice"].forEach((method) => {
    originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function (...args) {
      shouldTrack = false;
      let res = originMethod.apply(this, args);
      shouldTrack = true;
      return res;
    };
  });
  return arrayInstrumentations;
}
/*******
 * @description: 在get拦截函数内调用此函数追踪变化
 * @param {*} target 被代理的对象
 * @param {*} key 被代理的对象的属性
 * @return {*}
 */
function track(target, key) {
  // ! 如果没有副作用函数的化，则不需要追踪
  if (!activeEffect || !shouldTrack) return;
  let depsMap = bucket.get(target);

  if (!depsMap) bucket.set(target, (depsMap = new Map()));
  let deps = depsMap.get(key);

  if (!deps) depsMap.set(key, (deps = new Set()));
  deps.add(activeEffect);
  // ? 将当前的activeEffect添加到当前的deps中,用于清除
  activeEffect.deps.push(deps);
}
/*******
 * @description: 在set中拦截函数内调用此函数触发变化
 * @param {Object} target 被代理的对象
 * @param {string} key 被代理的对象的属性
 * @param {unknown} newValue 触发响应的新值
 * @return {void} null
 */
function trigger(target, key, type, newValue) {
  const depsMap = bucket.get(target);
  //! 如果没有可执行的map，则不需要触发
  if (!depsMap) return;
  // 取出与key相关的副作用函数
  const effects = depsMap.get(key);
  const effectsToRun = new Set();
  // 将与key相关联的副作用函数添加到effectsToRun中
  effects &&
    effects.forEach((effectFn) => {
      //! 如果effectFn和和当前的activeEffect是同一个，则不需要重复执行
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  // 只有当操作类型是ADD时，才能与ITERATE_KEY关联的触发副作用函数
  if (type === "ADD" || type === "DELETE") {
    //! 取出与ITERATE_KEY相关联的副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
    // 将与ITERATE_KEY相关联的副作用函数添加到effectsToRun中
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        //! 如果effectFn和和当前的activeEffect是同一个，则不需要重复执行
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  // ! 如果数组的操作类型是‘ADD’，则应当取出与length相关联的副作用函数
  if (type === "ADD" && Array.isArray(target)) {
    const lengthEffect = depsMap.get("length");
    lengthEffect &&
      lengthEffect.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  // ?如果操作目标是数组，并修改了数组的length值
  if (Array.isArray(target) && key === "length") {
    // ? newValue 是length的新值
    // ! 对于索引大于或者等于新length值的元素，应当触发其副作用函数
    depsMap.forEach((effects, key) => {
      if (key >= newValue) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }

  // ? 如果存在调度器，则调用该调度器，并将副作用函数作为参数传递
  // todo 调度器的思想很重要，需要深入研究，可以将副作用函数的控制权交给用户
  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}
// ?for...in 便利的key
const ITERATE_KEY = Symbol("KEY");
/*******
 * @description: 实现代理
 * @param {Object} target 被代理的数据
 * @param {Boolean} isShallow 是否为浅响应，默认为false，即非浅响应
 * @return {Proxy} Proxy 代理数据
 */
function createReactive(target, isShallow = false, isReadonly = false) {
  return new Proxy(target, {
    get(target, key, receiver) {
      // console.log(receiver);
      // ! 代理对象可以通过raw属性访问原始数据
      if (key === "raw") {
        return target;
      }
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      // 判断是否只读
      // !禁止副作用函数与Symbol.iterator相关联n
      if (!isReadonly && typeof key !== "symbol") {
        track(target, key);
      }
      const res = Reflect.get(target, key, receiver);
      if (isShallow) {
        return res;
      }
      // ! 如果是对象，则递归代理
      if (typeof res === "object" && res !== null) {
        // ? 调用reactive方法，将结果包装成Proxy返回
        // ! 如果数据是只读，则调用readonly对值进行包装
        return isReadonly ? readonly(res) : reactive(res);
      }
      return res;
    },
    set(target, key, newValue, receiver) {
      // ! 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`${key} is readonly`);
        return true;
      }
      const oldValue = Reflect.get(target, key, receiver);
      // ! 判断操作是新加属性还是修改属性
      const type = Array.isArray(target)
        ? // ?如果代理对象是数组，则检测被设置的索引值是否小于数组长度
          Number(key) < target.length
          ? "SET"
          : "ADD"
        : Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      const res = Reflect.set(target, key, newValue, receiver);
      // ! 如果receiver是target的代理对象，则执行
      // ? 解决对象访问原型引起不必要的更新，只有在访问代理对象才触发，访问原型不触发
      if (target === receiver.raw) {
        if (
          oldValue !== newValue &&
          (oldValue === oldValue || newValue === newValue)
        ) {
          trigger(target, key, type, newValue);
        }
      }
      return res;
    },
    // ! 拦截关键字'in'
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // ! 拦截for ... in
    ownKeys(target) {
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    // !拦截delete
    deleteProperty(target, key) {
      // ! 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`${key} is readonly`);
        return true;
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (res && hadKey) {
        trigger(target, key, "DELETE");
      }
      return res;
    },
  });
}

const reactiveMap = new Map();
/*******
 * @description: 深响应实现
 * @param {Object} target 代理对象
 * @return {Function} createReactive
 */
function reactive(target) {
  const existionProxy = reactiveMap.get(target);
  if (existionProxy) {
    return existionProxy;
  }
  const proxy = createReactive(target);
  reactiveMap.set(target, proxy);
  return proxy;
}
/*******
 * @description: 浅响应实现
 * @param {Object} target 代理对象
 * @return {Function} createReactive
 */
function shallowReactive(target) {
  return createReactive(target, true);
}
/*******
 * @description: 深只读实现
 * @param {Object} target 代理对象
 * @return {Function} createReactive
 */
function readonly(target) {
  return createReactive(target, false, true);
}
/*******
 * @description: 浅只读实现
 * @param {Object} target 代理对象
 * @return {Function} createReactive
 */
function shallowReadonly(target) {
  return createReactive(target, true, true);
}
/**
 * @description: 执行副作用函数前先清除收集的副作用函数
 * @param {Function} effectFn  包装副作用函数的函数
 * @return null
 */
function cleanup(effectFn) {
  for (let index = 0; index < effectFn.deps.length; index++) {
    const deps = effectFn.deps[index];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

/**
 * @description: 注册副作用函数
 * @param {Function} fn 副作用函数
 * @param {Object} options 用于允许用户指定调度器
 * @return null
 */
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    // 将当前的effectFn放入effectStack栈中，防止执行fn时将activeEffect改变
    effectStack.push(effectFn);
    // 将fn执行的结果保存在res中
    const res = fn();
    // 执行后将effectFn从effectStack栈中移除
    effectStack.pop();
    // 将activeEffect指向下一个要执行的副作用函数
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  };
  // ! 将options挂载到对应的副作用函数上
  effectFn.options = options;
  // 加入依赖容器
  effectFn.deps = [];
  //  只有在非lazy的情况下才会调用
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}

// todo 数组的索引与length
// const arr = reactive([1, 2, 3, 4, 5, 6]);
// effect(() => {
//   console.log(arr.length, arr[0], arr[1], arr[2], arr[3], arr[4], arr[5]);
// });
// arr[1] = "bar";
// arr.length = 3;
// todo 数组for in
// const arr = reactive([1]);
// effect(() => {
//   console.log("执行 for in");
//   for (const key in arr) {
//     console.log(key);
//   }
// });
// arr[1] = 2;
// arr.length = 0;
// todo 数组 includes
// const obj = {};
// const arr = reactive([obj]);
// console.log(arr.indexOf(obj));
// todo 隐式修改数组长度
const arr = reactive([]);
effect(() => {
  console.log("执行数组长度");
  arr.push(1);
});

effect(() => {
  console.log("执行数组长度2");
  arr.push(1);
});
