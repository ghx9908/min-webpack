const path = require("path")
const fs = require("fs")
const parser = require("@babel/parser")
const types = require("@babel/types")
const traverse = require("@babel/traverse").default
const generator = require("@babel/generator").default
const baseDir = normalizePath(process.cwd())
function normalizePath(path) {
  return path.replace(/\\/g, "/")
}
class Compilation {
  constructor(options, compiler) {
    this.options = options // 配置参数
    this.options.context = this.options.context || normalizePath(process.cwd())
    this.compiler = compiler
    this.modules = [] //这里放置本次编译涉及的所有的模块
    this.chunks = [] //本次编译所组装出的代码块
    this.assets = {} // 存放输出的文件 key是文件名,值是文件内容
    this.files = [] //代表本次打包出来的文件
    this.fileDependencies = new Set() //本次编译依赖的文件或者说模块
  }
  build(callback) {
    //5.根据配置中的entry找出入口文件
    let entry = {}
    //格式化入口文件
    if (typeof this.options.entry === "string") {
      entry.main = this.options.entry
    } else {
      entry = this.options.entry
    }
    // 对入口进行遍历
    for (let entryName in entry) {
      //获取入口文件的绝对路径
      let entryFilePath = path.posix.join(baseDir, entry[entryName])
      //把此入口文件添加到文件依赖列表中
      this.fileDependencies.add(entryFilePath)
      //6.从入口文件出发,调用所有配置的Loader对模块进行编译
      let entryModule = this.buildModule(entryName, entryFilePath)
      // this.modules.push(entryModule)
      // 8.根据入口和模块之间的依赖关系，组装成一个个包含多个模块的 Chunk
      let chunk = {
        name: entryName, //入口名称
        entryModule, //入口的模块 ./src/entry.js
        modules: this.modules.filter((module) => module.names.includes(entryName)), //此入口对应的模块
      }
      this.chunks.push(chunk)
    }

    // 9.再把每个 Chunk 转换成一个单独的文件加入到输出列表
    this.chunks.forEach((chunk) => {
      const filename = this.options.output.filename.replace("[name]", chunk.name)
      this.files.push(filename)
      //组装chunk
      this.assets[filename] = getSource(chunk)
    })
    callback(
      null,
      {
        modules: this.modules,
        chunks: this.chunks,
        assets: this.assets,
        files: this.files,
      },
      this.fileDependencies
    )
  }
  /**
   * 编译模块
   * @param {*} name 模块所属的代码块(chunk)的名称，也就是entry的name entry1 entry2
   * @param {*} modulePath 模块的绝对路径
   */
  buildModule(entryName, modulePath) {
    //1.读取文件的内容
    let rawSourceCode = fs.readFileSync(modulePath, "utf8")
    //获取loader的配置规则
    let { rules } = this.options.module
    //根据规则找到所有的匹配的loader 适用于此模块的所有loader
    let loaders = []
    rules.forEach((rule) => {
      //用模块路径匹配正则表达式
      if (modulePath.match(rule.test)) {
        loaders.push(...rule.use)
      }
    })
    //调用所有配置的Loader对模块进行转换

    let transformedSourceCode = loaders.reduceRight((sourceCode, loaderPath) => {
      const loaderFn = require(loaderPath)
      return loaderFn(sourceCode)
    }, rawSourceCode)

    //7.再找出该模块依赖的模块，再递归本步骤直到所有入口依赖的文件都经过了本步骤的处理
    //获取当前模块，也就是 ./src/entry1.js的模块ID
    let moduleId = "./" + path.posix.relative(baseDir, modulePath)
    //创建一个模块ID就是相对于根目录的相对路径 dependencies就是此模块依赖的模块
    //name是模块所属的代码块的名称,如果一个模块属于多个代码块，那么name就是一个数组
    let module = { id: moduleId, dependencies: new Set(), names: [entryName] }
    this.modules.push(module)
    let ast = parser.parse(transformedSourceCode, { sourceType: "module" })
    //Visitor是babel插件中的概念，此处没有
    traverse(ast, {
      CallExpression: ({ node }) => {
        //如果调用的方法名是require的话，说明就要依赖一个其它模块
        if (node.callee.name === "require") {
          // .代表当前的模块所有的目录，不是工作目录
          let depModuleName = node.arguments[0].value //"./title"
          let depModulePath
          //获取当前的模块所在的目录
          if (depModuleName.startsWith(".")) {
            //暂时先不考虑node_modules里的模块，先只考虑相对路径
            const currentDir = path.posix.dirname(modulePath)
            //要找当前模块所有在的目录下面的相对路径
            depModulePath = path.posix.join(currentDir, depModuleName)
            //此绝对路径可能没有后续，需要尝试添加后缀
            // 获取配置的扩展名后缀
            const extensions = this.options.resolve.extensions
            //尝试添加后缀 返回最终的路径
            depModulePath = tryExtensions(depModulePath, extensions)
          } else {
            //如果不是以.开头的话，就是第三方模块
            depModulePath = require.resolve(depModuleName)
          }
          //把依赖的模块路径添加到文件依赖列表
          this.fileDependencies.add(depModulePath)
          //获取此依赖的模块的ID, 也就是相对于根目录的相对路径
          let depModuleId = "./" + path.posix.relative(baseDir, depModulePath)
          //修改语法树，把依赖的模块名换成模块ID
          node.arguments[0] = types.stringLiteral(depModuleId)
          //把依赖的模块ID和依赖的模块路径放置到当前模块的依赖数组中
          module.dependencies.add({ depModuleId, depModulePath })
        }
      },
    })
    //转换源代码,把转换后的源码放在_source属性,用于后面写入文件
    let { code } = generator(ast)
    module._source = code
    ;[...module.dependencies].forEach(({ depModuleId, depModulePath }) => {
      //判断此依赖的模块是否已经打包过了或者说编译 过了
      let existModule = this.modules.find((module) => module.id === depModuleId)
      if (existModule) {
        existModule.names.push(entryName)
      } else {
        let depModule = this.buildModule(entryName, depModulePath)
        this.modules.push(depModule)
      }
    })
    return module
  }
}
/**
 *
 * @param {*} modulePath
 * @param {*} extensions
 * @returns
 */
function tryExtensions(modulePath, extensions) {
  if (fs.existsSync(modulePath)) {
    return modulePath
  }
  for (let i = 0; i < extensions.length; i++) {
    let filePath = modulePath + extensions[i]
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }
  throw new Error(`找不到${modulePath}`)
}
function getSource(chunk) {
  return `
  (() => {
    var modules = {
      ${chunk.modules
        .filter((module) => module.id !== chunk.entryModule.id)
        .map(
          (module) => `
          "${module.id}": module => {
            ${module._source}
          }
        `
        )
        .join(",")}
    };
    var cache = {};
    function require(moduleId) {
      var cachedModule = cache[moduleId];
      if (cachedModule !== undefined) {
        return cachedModule.exports;
      }
      var module = cache[moduleId] = {
        exports: {}
      };
      modules[moduleId](module, module.exports, require);
      return module.exports;
    }
    var exports = {};
    (() => {
      ${chunk.entryModule._source}
    })();
  })();
  `
}
module.exports = Compilation
