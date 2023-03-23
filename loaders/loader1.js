/**
 * loader的本质就是一个函数，一个用于转换或者说翻译的函数
 * 把那些webpack不认识的模块 less sass baxx转换为webpack能认识的模块js json
 *
 */
function loader1(input) {
  return input
}
module.exports = loader1
