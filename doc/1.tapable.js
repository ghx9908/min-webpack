// const { SyncHook } = require("tapable")

class SyncHook {
  taps = []
  tap(name, fn) {
    //类似于node中 events.on //订阅
    this.taps.push(fn)
  }
  call() {
    //类似于node中 events.emit //触发
    this.taps.forEach((tap) => tap())
  }
}

let hook = new SyncHook()
//普通订阅
hook.tap("some name", () => {
  console.log("some name")
})
//一般我会编写插件,在插件的apply方法里去订阅钩子
// 插件的格式
class SomePlugin {
  apply() {
    hook.tap("插件的名称", () => {
      console.log("插件的名称")
    })
  }
}
//插件订阅
const somePlugin = new SomePlugin()
somePlugin.apply()

// 触发事件
hook.call()
