/*
 * @Author: 王东旭
 * @Date: 2022-05-09 15:48:02
 * @LastEditTime: 2022-05-14 22:35:26
 * @LastEditors: 王东旭
 * @Description:
 * @FilePath: \function-realization-of-vue3\src\renderer\7.1渲染器与响应系统结合.js
 * @
 */

/*******
 * @description: 创建渲染器
 * @param {object} options 配置项
 * @return {object} 渲染器的一系列方法
 */
function createRenderer(options) {
  const {
    createElement,
    insert,
    setElementText,
    patchProps,
    setText,
    createText,
    createComment,
    unmount,
  } = options;
  /*******
   * @description: 匹配虚拟节点类型，选择对应的渲染器
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
    } else if (typeof type === "symbol") {
      if (type === Texts) {
        if (!n1) {
          const el = (n2.el = createText(n2.children));
          insert(el, container);
        } else {
          // 如果旧节点存在
          const el = (n2.el = n1.el);
          if (n2.children !== n1.children) {
            setText(el, n2.children);
          }
        }
      } else if (type === Comments) {
        if (!n1) {
          const el = (n2.el = createComment(n2.children));
          insert(el, container);
        } else {
          // 如果旧节点存在
          const el = (n2.el = n1.el);
          if (n2.children !== n1.children) {
            setText(el, n2.children);
          }
        }
      } else if (type === Fragment) {
        if (!n1) {
          n2.children.forEach((child) => {
            patch(null, child, container);
          });
        } else {
          patchChildren(n1, n2, container);
        }
      }
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
    container._vnode = vnode;
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
   * @description: dom节点更新
   * @param {vnode} n1 旧的vnode
   * @param {vnode} n2 新的vnode
   * @return {*} null
   */
  function patchElement(n1, n2) {
    const el = (n2.el = n1.el);
    const oldProps = n1.props;
    const newProps = n2.props;
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key]);
      }
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null);
      }
    }
    patchChildren(n1, n2, el);
  }
  /*******
   * @description: 将vnode的子节点更新
   * @param {vnode} n1 旧的vnode
   * @param {vnode} n2 新的vnode
   * @param {node} container 容器
   * @return {*}
   */
  function patchChildren(n1, n2, container) {
    if (typeof n2.children === "string") {
      if (Array.isArray(n1.children)) {
        n1.children.forEach((child) => unmount(child));
      }
      setElementText(container, n2.children);
    } else if (Array.isArray(n2.children)) {
      if (Array.isArray(n1.children)) {
        // 如果n1的子节点是数组，则需要更新
        n1.children.forEach((child) => unmount(child));
        n2.children.forEach((child) => {
          patch(null, child, container);
        });
      } else {
        setElementText(container, "");
        n2.children.forEach((child) => {
          patch(null, child, container);
        });
      }
    } else {
      // 新节点不存在，只需卸载旧节点即可
      if (Array.isArray(n1.children)) {
        n1.children.forEach((child) => unmount(child));
      } else if (typeof n1.children === "string") {
        setElementText(container, "");
      }
    }
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
  return { render, shouldSetAsProps };
}

const { render, shouldSetAsProps } = createRenderer({
  /*******
   * @description: 创建节点
   * @param {string} tag 节点标签
   * @return {Node}  节点
   */
  createElement(tag) {
    return document.createElement(tag);
  },
  /*******
   * @description: 设置元素节点的值
   * @param {Node} el 节点
   * @param {any} text 值
   */
  setElementText(el, text) {
    el.textContent = text;
  },
  /*******
   * @description: 讲节点插入到父节点中
   * @param {Node} el 节点
   * @param {Node} parent 父节点
   */
  insert(el, parent) {
    parent.appendChild(el);
  },
  /*******
   * @description: 设置文本节点的值
   * @param {*} el 节点
   * @param {*} text 值
   */
  setText(el, text) {
    el.nodeValue = text;
  },
  /*******
   * @description: 创建文本节点
   * @param {string} text  文本节点的值
   * @return {Node} 文本节点
   */
  createText(text) {
    return document.createTextNode(text);
  },
  /*******
   * @description: 创建注释节点
   * @param {string} text 注释节点的值
   * @return {Node} 注释节点
   */
  createComment(text) {
    return document.createComment(text);
  },
  /*******
   * @description: 匹配节点属性，做对应处理
   * @param {Node} el 挂着点
   * @param {string} key 属性
   * @param {any} prevValue 旧节点属性值
   * @param {any} nextValue 新节点属性值
   * @return {*} null
   */
  patchProps(el, key, prevValue, nextValue) {
    // !绑定事件
    if (/^on/.test(key)) {
      // !创建伪造的事件处理函数，并绑定到el上
      // !绑定和解绑事件只需改变invoker的值
      const invokers = el._vei || (el._vei = {});
      let invoker = invokers[key];
      const name = key.slice(2).toLowerCase();
      if (nextValue) {
        if (!invoker) {
          invoker = el._vei[key] = (e) => {
            // ?防止冒泡导致后绑定的事件提前触发
            // !如果事件发生事件早于事件处理函数绑定时间，则不会触发事件处理函数
            if (e.timeStamp < invoker.attached) return;
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => fn(e));
            } else {
              invoker.value(e);
            }
          };
          invoker.value = nextValue;
          // !储存事件处理函数被绑定的函数
          invoker.attached = performance.now();
          el.addEventListener(name, invoker);
        } else {
          invoker.value = nextValue;
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker);
        delete invokers[key];
      }
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
  /*******
   * @description: 卸载节点
   * @param {*} vnode 虚拟节点
   * @return {null}
   */
  unmount(vnode) {
    if (vnode.type === Fragment) {
      vnode.children.forEach((child) => unmount(child));
      return;
    }
    const parent = vnode.el.parentNode;
    parent && parent.removeChild(vnode.el);
  },
});
const Texts = Symbol("文本节点标识");
const Comments = Symbol("注释节点标识");
const Fragment = Symbol("文档碎片");
const bol = ref(false);
// const count = ref(1);

// effect(() => {
//   const vnode = {

//   };
//   render(vnode, document.querySelector("#app"));
// });

const newVnode = {
  type: Texts,
  children: "文本内容",
};
const oldVnode = {
  type: Comments,
  children: "注释内容",
};
const frag = {
  type: "ul",
  children: [
    {
      type: Fragment,
      children: [
        {
          type: "li",
          children: "1",
        },
        {
          type: "li",
          children: "2",
        },
        {
          type: "li",
          children: "3",
        },
      ],
    },
  ],
};
let node = document.querySelector("#app");
render(oldVnode, node);
render(newVnode, node);
render(frag, node);
