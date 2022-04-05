/*
 * @Author: 王东旭
 * @Date: 2022-03-28 10:58:41
 * @LastEditTime: 2022-04-05 19:07:34
 * @LastEditors: 王东旭
 * @Description: 比较完善的响应系统，vue设计与实现第四章4.3
 * @FilePath: \function-realization-of-vue3\src\reactive\4.3比较完善的响应系统.js
 * @
 */

// *直接用Set作为桶的数据结构，则没有副作用函数与被操作的目标字段之间建立明确的联系，导致不相干的字段改变也会触发副作用函数
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

// const data = {
//     text: "hello world",
//     age: 18,
//     ok: true
// };
// const data = {
//     foo:true,
//     bar:true
// }
const data = {
  foo: 1,
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
    fn();
    // 执行后将effectFn从effectStack栈中移除
    effectStack.pop();
    // 将activeEffect指向下一个要执行的副作用函数
    activeEffect = effectStack[effectStack.length - 1];
  };
  // ! 将options挂载到对应的副作用函数上
  effectFn.options = options;
  // 加入依赖容器
  effectFn.deps = [];
  effectFn();
}

// todo 嵌套effect
// 必须先执行effect，才能将副作用函数写到桶中
// effect(() => {
//    console.log('effect1执行');
//    effect(() => {
//        console.log('effect2执行');
//         console.log(obj.bar);
//    })
//    console.log(obj.foo);
// });

// todo 副作用函数的调度器
// effect(() => {
//   console.log(obj.foo)
// },
// {
//   scheduler:(fn)=>{
//     setTimeout(fn)
//   }
// }
// );
// obj.foo++
// obj.foo++
// console.log('结束了');

// todo 利用调度器实现隐藏过渡状态
// 定义任务队列,使用Set去重
const jobQueue = new Set();
//! 利用promise的特性，把要执行的任务放到微任务队列中，当所有副作用函数在同步任务结束后执行，以便略过中间态，直接执行最终状态
const p = Promise.resolve();
// 表示是否执行队列中的任务
let isFlushing = false;
//! 执行队列中的任务，并且在一个函数执行周期内只执行一次
function flushJob() {
  if (isFlushing) return;

  isFlushing = true;
  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    isFlushing = false;
  });
}

effect(
  () => {
    console.log(obj.foo);
  },
  {
    scheduler: (fn) => {
      jobQueue.add(fn);
      flushJob();
    },
  }
);
obj.foo++;
obj.foo++;
