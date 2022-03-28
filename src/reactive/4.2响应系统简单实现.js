/*
 * @Author: 王东旭
 * @Date: 2022-03-28 10:41:10
 * @LastEditTime: 2022-03-28 10:58:22
 * @LastEditors: 王东旭
 * @Description: vue设计与实现第四章实现简单的响应系统
 * @FilePath: \function-realization-of-vue3\src\reactive\4.2响应系统简单实现.js
 * @
 */

// 储存副作用函数的桶
const bucket = new Set();

const data = {
    text: "hello world",
};

const obj = new Proxy(data, {
    get(target, key) {
        // 直接指定副作用函数，没有普适性
        bucket.add(effect);
        return target[key];
    },
    set(target, key, newValue) {
        target[key] = newValue;
        bucket.forEach(fn => fn())
        return true
    }
});

function effect() {
    console.log(obj.text)
}
effect()

setTimeout(() => {
    obj.text = 'hello vue3'
}, 1000)