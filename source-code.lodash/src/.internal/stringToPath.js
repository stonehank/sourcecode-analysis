/*
* 关于此处正则，更详细解释查看
* https://github.com/stonehank/blogs/blob/master/07-18-一个长正则的深入理解.md
* */

import memoizeCapped from './memoizeCapped.js'

const charCodeOfDot = '.'.charCodeAt(0)
const reEscapeChar = /\\(\\)?/g
const rePropName = RegExp(
  // Match anything that isn't a dot or bracket.
  // 匹配任意 非.和非[]的
  '[^.[\\]]+' + '|' +
  // Or match property names within brackets.
  // 匹配 [
  '\\[(?:' +
  // Match a non-string expression.
  // 匹配(非" 或者 ')和后面任意数量值，即非字符串
  '([^"\'].*)' + '|' +
  // Or match strings (supports escaping characters).
  // ?: 不捕获括号
  // ?! 正向否定预查，即匹配除了 \\2，然后获取这个匹配值前面的内容
  // \\2 反向引用第二个捕获的括号
  // \\\\ 实际就是 \的转义
  // \\\\. 就是\的转义+任意字符
  // *? 就是匹配任意个，非贪婪
  // | 符号前面就是匹配非转义 (非\)，后面就是匹配转义(\任意字符)，最后*?)\\2 就是在匹配任意数量直到 \\2出现
  '(["\'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2' +
  ')\\]'+ '|' +
  // Or match "" as the space between consecutive dots or empty brackets.
  '(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))'
  , 'g')

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
// 缓存化
const stringToPath = memoizeCapped((string) => {
  const result = []
  if (string.charCodeAt(0) === charCodeOfDot) {
    result.push('')
  }
  // match是匹配的值 expression匹配中括号内非字符串 quote匹配中括号的引号 subString是中括号具体字符串的值(无引号)
  string.replace(rePropName, (match, expression, quote, subString) => {

    let key = match
    if (quote) {
      // 将 \\ 转换成 \
      key = subString.replace(reEscapeChar, '$1')
    }
    else if (expression) {
      key = expression.trim()
    }
    result.push(key)
  })
  return result
})

export default stringToPath
