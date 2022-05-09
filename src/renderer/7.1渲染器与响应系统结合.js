/*
 * @Author: 王东旭
 * @Date: 2022-05-09 15:48:02
 * @LastEditTime: 2022-05-09 19:48:29
 * @LastEditors: 王东旭
 * @Description:
 * @FilePath: \function-realization-of-vue3\src\renderer\7.1渲染器与响应系统结合.js
 * @
 */

function renderer(domString, el) {
  const container = document.querySelector(el);
  console.log(container);
  container.innerHTML = domString;
}
/*******
 * @description: 创建渲染器
 * @param {object} options 配置项
 * @return {object} 渲染器的一系列方法
 */
function createRenderer(options) {
  const { createElement, insert, setElementText } = options;
  /*******
   * @description: 执行dom的挂载、卸载和替换
   * @param {vnode} n1 旧的vnode
   * @param {vnode} n2 新的vnode
   * @param {node} container 容器
   * @return {null} null
   */
  function patch(n1, n2, container) {
    //   !如果n1不存在，则意味着挂载
    if (!n1) {
      mountElement(n2, container);
    } else {
    }
  }
  /*******
   * @description: 将vnode渲染成node
   * @param {*} vnode 虚拟节点
   * @param {*} container 要挂载的容器
   * @return {*}
   */
  function render(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container);
    } else {
      if (container_vnode) {
        container.innerHTML = "";
      }
    }
    container_vnode = vnode;
  }
  /*******
   * @description: 将处理后的vnode渲染成node，并挂载到容器
   * @param {*} vnode
   * @param {*} container
   * @return {*}
   */
  function mountElement(vnode, container) {
    const el = createElement(vnode.type);
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    }
    insert(el, container);
  }
  return { render };
}

const count = ref(1);
const { render } = createRenderer({
  createElement(tag) {
    return document.createElement(tag);
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  insert(el, parent) {
    parent.appendChild(el);
  },
});

effect(() => {
  const vnode = {
    type: "div",
    children: `${count.value}`,
  };
  render(vnode, document.querySelector("#app"));
});

count.value++;
