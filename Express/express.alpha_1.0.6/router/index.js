const url = require('url');
const Route = require('./route');
const Layer = require('./layer');
const methods = require('methods');

// 路由匹配
class Router {
  constructor() {
    this.stack = [];
  }
  route(path) {
    let route = new Route();
    let layer = new Layer(path, route.dispatch.bind(route));
    layer.route = route;
    this.stack.push(layer);
    return route;
  }
  use(path, handler) {
    let layer = new Layer(path, handler);
    this.stack.push(layer);
  }
  handler(req, res, done) { // 请求到来是，来时匹配路由请求
    let { pathname } = url.parse(req.url);
    let idx = 0;
    let removed = ''

    let dispatch = (error) => { //express 和 koa 一样要通过 next迭代
      if(idx === this.stack.length) return  done(req, res);

      if(removed) { //  把刚刚清空的中间路径加回来
        req.url = removed +  req.url;
        removed = '';
      }

      let layer = this.stack[idx++];
      if(error) { // 用户传入错误
        if(!layer.route) { //且是中间件
          layer.error_handler(error, req, res, dispatch);
        } else {
          dispatch(error); // 不是中间件直接忽略
        }
      } else {
        if(layer.match(pathname)) {
          if(!layer.route && layer.handler.length !== 4) { // 是中间件 use

            // 这里把中间路径删掉 /user/add => /add
            if(layer.path !== '/') {
              removed = layer.path;
              req.url = req.url.slice(removed.length)
            }

            layer.handle_request(req, res, dispatch);
          } else {
            if(layer.route.methods[req.method.toLowerCase()]) {
              req.params = layer.params;
              layer.handle_request(req, res, dispatch)
            } else {
              dispatch()
            }
          }
        } else {
          dispatch()
        }
      }
    };
    dispatch()
  }
}

methods.map((method) => {
  Router.prototype[method] = function(path, handlers) {
    let route = this.route(path); // 创建 route 实例
    route[method](handlers);
  }
  // 用户调用get时，可能会有多个 handler,
  // 每次调用get 会产生一个层（layer(path, route.dispath)），每个层又包含多个小层级（route）
  // 而route才是真正的处理方法, route.dispath 对匹配到的路由进行处理
})

module.exports = Router;