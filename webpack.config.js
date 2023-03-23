const path = require("path")
const Run1Plugin = require("./plugins/run1-plugin")
const Run2Plugin = require("./plugins/run2-plugin")
const DonePlugin = require("./plugins/done-plugin")
module.exports = {
  mode: "development",
  devtool: false,
  context: process.cwd(),
  entry: {
    entry1: "./src/entry1.js",
    entry2: "./src/entry2.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".js", ".jsx", ".tx", ".tsx"],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [path.resolve(__dirname, "loaders/loader2.js"), path.resolve(__dirname, "loaders/loader1.js")],
      },
    ],
  },
  plugins: [new DonePlugin(), new Run2Plugin(), new Run1Plugin()],
}
