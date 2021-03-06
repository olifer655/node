const http = require('http');
const url = require('url');
const fs = require('fs').promises;
const { createReadStream, createWriteStream, readFileSync } = require('fs');
const path = require('path');

const mime = require('mime');
const chalk = require('chalk'); // 改变打印出的文字颜色
const nunjucks = require('nunjucks');

let templateStr = readFileSync(path.resolve(__dirname, './template.html'));

class Server {
  constructor(config) {
    this.port = config.port;
    this.config = config;
    this.templateStr = templateStr;
  }
  async handleRequest(req, res) {
    let { pathname } = url.parse(req.url);
    let absPath = path.join(__dirname, 'public', pathname);

    try {
      let statObj =  await fs.stat(absPath);

      if(statObj.isFile()) { // 是文件
        this.sendFile(absPath, req, res, statObj);
      } else if(statObj.isDirectory()) { // 是文件夹
        // 需要列出所有文件夹的内容
        let child = await fs.readdir(absPath);
        let templeteStr = nunjucks.render(
          path.resolve(__dirname, './template.html'), 
          { items: child }
        );
        
        res.setHeader('Content-Type', 'text/html;charset=UTF-8');
        res.end(templeteStr);
      } 
    } catch(e) {
      this.sendError(e, res);
    }
  }
  hasCache(currentPath, req, res) {
    // 加一次缓存
    res.setHeader('Cache-Control', 'max-age=10');
    res.setHeader('Expires', new Date(Date.now() + 10 * 1000).toGMTString())

    // 对比缓存
    let ctime = stats.ctime.toGMTString() // 修改时间
    let ifModifiedSince = req.headers['If-Modified-Since']
    res.setHeader('Last-Modified', ctime)

    let content = readFileSync(currentPath, 'utf8')
    let etag = crypto.createHash('md5').update(content).digest('base64');
    let ifNoneMatch = req.headers['if-none-match'];
    
    res.setHeader('ETag', etag);

    if(ifModifiedSince === ctime) {
      return true
    }
    if(ifNoneMatch === etag) {
      return true
    }
    return false
  }
  sendFile(currentPath, req, res, stats) {
    // 加入缓存
    if(this.hasCache(currentPath, req, res)) {
      res.statusCode = 304;
      return res.end()
    }

    res.setHeader('Content-Type', `${mime.getType(currentPath)};charset=UTF-8`);
    createReadStream(currentPath).pipe(res);
  }
  start() {
    let server =  http.createServer(this.handleRequest.bind(this));
    server.listen(this.config);
    console.log('server start in ' + chalk.green(this.port));
  }
  sendError(error, res) {
    res.statusCode = '404';
    res.end('Not Found');
  }
}

module.exports = Server




