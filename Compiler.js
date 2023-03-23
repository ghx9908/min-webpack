const { SyncHook } = require("tapable")
const Compilation = require("./Compilation")
const fs = require("fs")
const path = require("path")
// Compiler 模块是 webpack 的主要引擎
class Compiler {
  constructor(options) {
    this.options = options
    this.hooks = {
      run: new SyncHook(), //在开始编译之前调用
      done: new SyncHook(), //在编译完成时执行
    }
  }
  run(callback) {
    this.hooks.run.call() //在编译开始前触发run钩子执行
    //在编译的过程中会收集所有的依赖的模块或者说文件
    //stats指的是统计信息 modules chunks  files=bundle assets指的是文件名和文件内容的映射关系
    const onCompiled = (err, stats, fileDependencies) => {
      // 10.在确定好输出内容后，根据配置确定输出的路径和文件名，把文件内容写入到文件系统
      for (let filename in stats.assets) {
        let filePath = path.join(this.options.output.path, filename)
        fs.writeFileSync(filePath, stats.assets[filename], "utf8")
      }
      callback(err, { toJson: () => stats })
      for (let fileDependency of fileDependencies) {
        //监听依赖的文件变化，如果依赖的文件变化后会开始一次新的编译
        fs.watch(fileDependency, () => this.compile(onCompiled))
      }
    }
    this.hooks.done.call() //在编译完成时触发done钩子执行
    //调用compile方法进行编译  开始一次新的编译
    this.compile(onCompiled)
  }
  //开启一次新的编译
  compile(callback) {
    //每次编译 都会创建一个新的Compilation实例
    let compilation = new Compilation(this.options, this)
    compilation.build(callback)
  }
}
module.exports = Compiler
