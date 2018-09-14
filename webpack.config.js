const path = require("path");
const src = path.resolve(__dirname, "src");
const docs = path.resolve(__dirname, "docs");

module.exports = {
  entry: [src + "/main.js"],
  output: {
    path: docs,
    filename: "[name].bundle.js"
  },
  devtool: "inline-source-map",
  devServer: {
    host: "0.0.0.0",
    contentBase: docs,
    disableHostCheck: true
  },  
  resolve: {
    extensions: [".js"]
  }
};
