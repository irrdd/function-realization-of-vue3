/*
 * @Author: 王东旭
 * @Date: 2022-04-06 11:40:50
 * @LastEditTime: 2022-04-06 21:31:56
 * @LastEditors: 王东旭
 * @Description: watch实现原理
 * @FilePath: \function-realization-of-vue3\src\reactive\4.9watch实现原理.js
 * @
 */
// ?直接用Set作为桶的数据结构，则没有副作用函数与被操作的目标字段之间建立明确的联系，导致不相干的字段改变也会触发副作用函数
// const bucket = new Set()

//! 重新设计桶的数据结构
// 采用WeakMap,当数据没有被引用时，就会被垃圾回收机制回收
const bucket = new WeakMap();
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
// 全局变量，注册副作用函数
let activeEffect;
// effect 栈
const effectStack = [];

const data = {
  foo: 1,
  bar: 2,
};
/*******
 * @description: 在get拦截函数内调用此函数追踪变化
 * @param {*} target 被代理的对象
 * @param {*} key 被代理的对象的属性
 * @return {*}
 */
function track(target, key) {
  // ! 如果没有副作用函数的化，则不需要追踪
  if (!activeEffect) return;
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
 * @return {*} null
 */
function trigger(target, key) {
  const depsMap = bucket.get(target);
  //! 如果没有可执行的map，则不需要触发
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      //! 如果effectFn和和当前的activeEffect是同一个，则不需要重复执行
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
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
// ? 实现代理
const obj = new Proxy(data, {
  get(target, key) {
    track(target, key);
    return target[key];
  },
  set(target, key, newValue) {
    target[key] = newValue;
    trigger(target, key);
  },
});
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
/*******
 * @description: 计算属性
 * @param {Function} getter 副作用函数
 * @return {Object} obj
 */
function computed(getter) {
  let value;
  let dirty = true;

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (!dirty) {
        dirty = true;
        // ! 当计算属性依赖的响应式数据变化时，手动调用trigger触发响应
        trigger(obj, "value");
      }
    },
  });

  const obj = {
    //! 只有读取值才会调用effectFn进行计算
    get value() {
      // ?只有“脏”数据才计算值，否则使用缓存value
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      //! 当读取value时，手动调用track进行跟踪
      track(obj, "value");
      return value;
    },
  };
  return obj;
}

// todo 实现watch
/*******
 * @description:
 * @param {*}
 * @return {*}
 */
function traverse(value, seen = new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const key in value) {
    traverse(value[key], seen);
  }
  return value;
}

/*******
 * @description: watch
 * @param {Object | Function} source 被观察的对象或者getter函数
 * @param {Function} cb 观察对象值变化后触发的回调函数
 * @return {viod} viod
 */
function watch(source, cb, options = {}) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  // 定义新值和旧值
  let oldValue, newValue;
  // 用来储存用户注册的过期回调
  let cleanup
  function onInvalidate(fn){
    cleanup = fn
  }
  const job = () => {
    // ?数据改变后执行调度器获取新值
    newValue = effectFn();
    // 在调用回调前，先调用过期回调
    cleanup && cleanup()
    cb(newValue, oldValue,onInvalidate);
    // 更新旧值
    oldValue = JSON.parse(JSON.stringify(newValue));
  };
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: ()=>{
      if (options.flush === 'post') {
        const p = Promise.resolve();
        p.then(job);
      }else{
        job()
      }
    },
  });
  // ?手动调用，拿到旧值
  if (options.immediate) {
    job();
  } else {
    oldValue = effectFn();
  }
}

watch(
  obj,
  (newValue, oldValue,onInvalidate) => {
    console.log(newValue, oldValue);
    console.log("数据变化");
    onInvalidate(()=>{
      expired = true
    })
  },
  {
    immediate: false,
    flush: 'post',
  }
);

obj.bar++;
obj.foo++;
console.log('更改数据');