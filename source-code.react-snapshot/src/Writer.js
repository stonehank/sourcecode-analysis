/* Simple wrapper around fs so I can concentrate on what's going on */
import fs from 'fs'
import path from 'path'
import { sync as mkDirPSync } from 'mkdirp'

export default class Writer {
  constructor(baseDir, outputDir) {
    this.baseDir = baseDir
    // 如果用户自定义output 则创建
    // 默认 outputDIr===baseDir==='xxx/build'
    if (outputDir !== baseDir) {
      mkDirPSync(outputDir)
    }
    this.outputDir = outputDir
  }

  move(from, to) {
    /* Only do this if we still have an index.html
    (i.e. this is the first run post build) */
    // 解析为绝对路径
    const fromPath = path.resolve(this.baseDir, from);
    // 如果存在
    if (fs.existsSync(fromPath)) {
      /* This _must_ be in the BUILD directory, not the OUTPUT directory, since
       * that's how our Server is configured. */
      // 重命名
      fs.renameSync(fromPath, path.resolve(this.baseDir, to))
    }
  }

  write(filename, content) {
    // 合并路径
    const newPath = path.join(this.outputDir, filename)
    // 获取目录路径
    const dirName = path.dirname(newPath)
    // 创建目录
    mkDirPSync(dirName)
    // 写入内容
    fs.writeFileSync(newPath, content)
  }
}
