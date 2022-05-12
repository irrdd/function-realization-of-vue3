/*
 * @Author: 王东旭
 * @Date: 2022-05-09 15:48:02
 * @LastEditTime: 2022-05-12 17:07:42
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
  const { createElement, insert, setElementText, patchProps } = options;
  /*******
   * @description: 执行dom的挂载、卸载和替换
   * @param {vnode} n1 旧的vnode
   * @param {vnode} n2 新的vnode
   * @param {node} container 容器
   * @return {null} null
   */
  function patch(n1, n2, container) {
    //! 如果新旧节点类型不一致，则直接卸载旧节点
    if (n1 && n1.type !== n2.type) {
      unmount(n1);
      n1 = null;
    }
    const { type } = n2;
    if (typeof type === "string") {
      //   !如果n1不存在，则意味着挂载
      if (!n1) {
        mountElement(n2, container);
      } else {
        patchElement(n1, n2);
      }
    } else if (typeof type === "object") {
      // 如果type的类型是对象，则描述的是组件
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
      if (container._vnode) {
        unmount(container._vnode);
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
    vnode.el = el;
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach((child) => {
        patch(null, child, el);
      });
    }
    if (vnode.props) {
      for (const key in vnode.props) {
        const value = vnode.props[key];
        patchProps(el, key, null, value);
      }
    }
    insert(el, container);
  }
  /*******
   * @description: 检测是否使用setAttribute
   * @param {*} el 创建的标签
   * @param {*} key 属性名
   * @param {*} value 属性值
   * @return {boolean} true/false
   */
  function shouldSetAsProps(el, key, value) {
    if (key === "form" && el.tagName === "INPUT") {
      return false;
    }
    return key in el;
  }
  /*******
   * @description: 卸载节点
   * @param {*} vnode 虚拟节点
   * @return {null}
   */
  function unmount(vnode) {
    const parent = vnode.el.parentNode;
    parent && parent.removeChild(vnode.el);
  }

  return { render, shouldSetAsProps };
}

const count = ref(1);
const { render, shouldSetAsProps } = createRenderer({
  createElement(tag) {
    return document.createElement(tag);
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  insert(el, parent) {
    parent.appendChild(el);
  },
  patchProps(el, key, prevValue, nextValue) {
    // !绑定事件
    if (/^on/.test(key)) {
      const name = key.slice(2).toLowerCase();
      prevValue && el.removeEventListener(name, prevValue);
      el.addEventListener(name, nextValue);
    }
    // ?如果key在dom属性中存在，
    else if (key === "class") {
      el.className = nextValue;
    } else if (shouldSetAsProps(el, key, nextValue)) {
      const type = typeof el[key];
      //! 检查是否是boolean,且值为空，修正值为true
      if (type === "boolean" && value === "") {
        el[key] = true;
      } else {
        el[key] = value;
      }
    } else {
      el.setAttribute(key, nextValue);
    }
  },
});

effect(() => {
  const vnode = {
    type: "div",
    children: `${count.value}`,
    props: {
      name: `${count.value}`,
      class: "aaa",
    },
  };
  render(vnode, document.querySelector("#app"));
});

count.value++;
// count.value=null;
render(null, document.querySelector("#app"));
