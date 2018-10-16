7-29：更新至webpack-config-dev.js
9-25：更新webpackDevServer.config.js
10-16：更新webpack.config.prod.js

粗读了一遍`create-react-app.js`，主要是用node对检测和创建上的操作，还有安装依赖，
下次会将它粗略分析下，并且将导图画出

`webpack-config-dev.js`是开发模式下的配置，基本上每一行都有注释，解释了代码的功能和相关插件的作用
(等待后续更新)

----------
看完config.prod和config.dev，觉得`CRA`的webpack配置真的是解决了大量的issue才能达到今天的优化地步，基本每一次选用插件或者
修改配置options都有独特的issue。

要真正做到理解`CRA`，还需要去理解这些问题的产生，去看一看他们的讨论，要不然以后遇到同样的问题，还要重新去寻求解决办法。