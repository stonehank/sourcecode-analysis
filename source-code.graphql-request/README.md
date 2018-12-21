`graphql-request`一个极小的`graphql`请求方法

如果不太了解`graphql`，看一下这个库，或许能知道它的请求就可以这么简单...

就是熟悉的`fetch`，这里使用了`cross-fetch`(兼容的fetch)


1. `Content-Type`设置为`application/json`
2. `method`设置为`POST`
3. 合并自定义`headers`
4. 传入`query`(`graphql`的查询模板)，`variables`(查询模板中的变量，可选)

剩下的只需要等待数据返回。


