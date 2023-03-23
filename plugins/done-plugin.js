class DonePlugin {
  apply(compiler) {
    compiler.hooks.done.tap("DonePlugin", () => {
      console.log("done:结束编译")
    })
  }
}
module.exports = DonePlugin

/* let compiler = {
  hooks: {
    run:new Hook(),
    done:new Hook()
  }
} */
