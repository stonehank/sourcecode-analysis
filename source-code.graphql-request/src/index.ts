import { ClientError, GraphQLError, Headers as HttpHeaders, Options, Variables } from './types'
export { ClientError } from './types'
import 'cross-fetch/polyfill'

export class GraphQLClient {
  private url: string
  private options: Options

  constructor(url: string, options?: Options) {
    // 处理连接的url
    this.url = url
    // 主要处理headers
    this.options = options || {}
  }
  // 传出更多细节
  async rawRequest<T extends any>(
    query: string,
    variables?: Variables,
  ): Promise<{ data?: T, extensions?: any, headers: Headers, status: number, errors?: GraphQLError[] }> {
    // 处理options
    const { headers, ...others } = this.options
    // query指 GraphQL 查询模板
    // variables 指 query 中的变量
    const body = JSON.stringify({
      query,
      variables: variables ? variables : undefined,
    })

    // fetch 获取
    const response = await fetch(this.url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body,
      ...others,
    })

    // 处理response，判断使用json()还是text()
    const result = await getResult(response)
    // response.ok 判断状态值是200-299之间
    // 无错误，存在数据
    if (response.ok && !result.errors && result.data) {
      // 响应头和状态值
      const { headers, status } = response
      // 返回
      return { ...result, headers, status }
    } else {
      const errorResult =
        typeof result === 'string' ? { error: result } : result
      throw new ClientError(
        { ...errorResult, status: response.status, headers: response.headers },
        { query, variables },
      )
    }
  }

  // 只传出数据
  async request<T extends any>(
    query: string,
    variables?: Variables,
  ): Promise<T> {
    // 处理options
    const { headers, ...others } = this.options
    // query指 GraphQL 查询模板
    // variables 指 query 中的变量
    const body = JSON.stringify({
      query,
      variables: variables ? variables : undefined,
    })

    // fetch 获取
    const response = await fetch(this.url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body,
      ...others,
    })

    // 处理response，判断使用json()还是text()
    const result = await getResult(response)
    // response.ok 判断状态值是200-299之间
    // 无错误，存在数据
    if (response.ok && !result.errors && result.data) {
      // 直接返回数据
      return result.data
    } else {
      const errorResult =
        typeof result === 'string' ? { error: result } : result
      throw new ClientError(
        { ...errorResult, status: response.status },
        { query, variables },
      )
    }
  }

  // setHeaders 两种写法
  setHeaders(headers: HttpHeaders): GraphQLClient {
    this.options.headers = headers

    return this
  }

  setHeader(key: string, value: string): GraphQLClient {
    const { headers } = this.options

    if (headers) {
      headers[key] = value
    } else {
      this.options.headers = { [key]: value }
    }
    return this
  }
}

export async function rawRequest<T extends any>(
  url: string,
  query: string,
  variables?: Variables,
): Promise<{ data?: T, extensions?: any, headers: Headers, status: number, errors?: GraphQLError[] }> {
  // 创建一个新的处理，可以传入header等
  const client = new GraphQLClient(url)
  // 发起请求
  return client.rawRequest<T>(query, variables)
}
// 只获取数据
export async function request<T extends any>(
  url: string,
  query: string,
  variables?: Variables,
): Promise<T> {
  const client = new GraphQLClient(url)

  return client.request<T>(query, variables)
}

export default request

async function getResult(response: Response): Promise<any> {
  // 获取响应头的 Content-Type
  const contentType = response.headers.get('Content-Type')
  // 如果响应数据是 application/json，使用json()
  if (contentType && contentType.startsWith('application/json')) {
    return response.json()
  } else {
    // 其他使用 text()
    return response.text()
  }
}
