import type { Route } from 'vafast'
import { empty, parseHeaders } from 'vafast'

import { readdir, stat, readFile } from 'fs/promises'
import { resolve, resolve as resolveFn, join, sep } from 'path'
import Cache from 'node-cache'

import { generateETag, isCached } from './cache'
import type { Stats } from 'fs'

// Custom NotFoundError for Tirne
class NotFoundError extends Error {
    constructor() {
        super('Not Found')
        this.name = 'NotFoundError'
    }
}

const URL_PATH_SEP = '/'
const fileExists = (path: string) =>
    stat(path).then(
        () => true,
        () => false
    )

const statCache = new Cache({
    useClones: false,
    checkperiod: 5 * 60,
    stdTTL: 3 * 60 * 60,
    maxKeys: 250
})

const fileCache = new Cache({
    useClones: false,
    checkperiod: 5 * 60,
    stdTTL: 3 * 60 * 60,
    maxKeys: 250
})

const htmlCache = new Cache({
    useClones: false,
    checkperiod: 5 * 60,
    stdTTL: 3 * 60 * 60,
    maxKeys: 250
})

const listFiles = async (dir: string): Promise<string[]> => {
    const files = await readdir(dir)

    const all = await Promise.all(
        files.map(async (name) => {
            const file = dir + sep + name
            const stats = await stat(file)

            return stats && stats.isDirectory()
                ? await listFiles(file)
                : [resolve(dir, file)]
        })
    )

    return all.flat()
}

export const staticPlugin = async <Prefix extends string = '/prefix'>(
    {
        assets = 'public',
        prefix = '/public' as Prefix,
        staticLimit = 1024,
        alwaysStatic = process.env.NODE_ENV === 'production',
        ignorePatterns = ['.DS_Store', '.git', '.env'],
        noExtension = false,
        enableDecodeURI = false,
        resolve = resolveFn,
        headers = {},
        noCache = false,
        maxAge = 86400,
        directive = 'public',
        indexHTML = true
    }: {
        /**
         * @default "public"
         *
         * Asset path to expose as public path
         */
        assets?: string
        /**
         * @default '/public'
         *
         * Path prefix to create virtual mount path for the static directory
         */
        prefix?: Prefix
        /**
         * @default 1024
         *
         * If total files exceed this number,
         * file will be handled via wildcard instead of static route
         * to reduce memory usage
         */
        staticLimit?: number
        /**
         * @default false unless `NODE_ENV` is 'production'
         *
         * Should file always be served statically
         */
        alwaysStatic?: boolean
        /**
         * @default [] `Array<string | RegExp>`
         *
         * Array of file to ignore publication.
         * If one of the patters is matched,
         * file will not be exposed.
         */
        ignorePatterns?: Array<string | RegExp>
        /**
         * Indicate if file extension is required
         *
         * Only works if `alwaysStatic` is set to true
         */
        noExtension?: boolean
        /**
         *
         * When url needs to be decoded
         *
         * Only works if `alwaysStatic` is set to false
         */
        enableDecodeURI?: boolean
        /**
         * Nodejs resolve function
         */
        resolve?: (...pathSegments: string[]) => string
        /**
         * Set headers
         */
        headers?: Record<string, string> | undefined
        /**
         * @default false
         *
         * If set to true, browser caching will be disabled
         */
        noCache?: boolean
        /**
         * @default public
         *
         * directive for Cache-Control header
         *
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#directives
         */
        directive?:
            | 'public'
            | 'private'
            | 'must-revalidate'
            | 'no-cache'
            | 'no-store'
            | 'no-transform'
            | 'proxy-revalidate'
            | 'immutable'
        /**
         * @default 86400
         *
         * Specifies the maximum amount of time in seconds, a resource will be considered fresh.
         * This freshness lifetime is calculated relative to the time of the request.
         * This setting helps control browser caching behavior.
         * A `maxAge` of 0 will prevent caching, requiring requests to validate with the server before use.
         */
        maxAge?: number | null
        /**
         *
         */
        /**
         * @default true
         *
         * Enable serving of index.html as default / route
         */
        indexHTML?: boolean
    } = {
        assets: 'public',
        prefix: '/public' as Prefix,
        staticLimit: 1024,
        alwaysStatic: process.env.NODE_ENV === 'production',
        ignorePatterns: [],
        noExtension: false,
        enableDecodeURI: false,
        resolve: resolveFn,
        headers: {},
        noCache: false,
        indexHTML: true
    }
) => {
    const files = await listFiles(resolveFn(assets))
    const isFSSepUnsafe = sep !== URL_PATH_SEP

    if (prefix === URL_PATH_SEP) prefix = '' as Prefix

    const shouldIgnore = (file: string) => {
        if (!ignorePatterns.length) return false

        return ignorePatterns.find((pattern) => {
            if (typeof pattern === 'string') return pattern.includes(file)
            else return pattern.test(file)
        })
    }

    const routes: Route[] = []

    const assetsDir = assets[0] === sep ? assets : resolve() + sep + assets

    if (
        alwaysStatic ||
        (process.env.ENV === 'production' && files.length <= staticLimit)
    )
        for (const absolutePath of files) {
            if (!absolutePath || shouldIgnore(absolutePath)) continue
            let relativePath = absolutePath.replace(assetsDir, '')

            if (noExtension) {
                const temp = relativePath.split('.')
                temp.splice(-1)

                relativePath = temp.join('.')
            }

            const etag = await generateETag(absolutePath)

            const pathName = isFSSepUnsafe
                ? prefix + relativePath.split(sep).join(URL_PATH_SEP)
                : join(prefix, relativePath)

            routes.push({
                method: 'GET',
                path: pathName,
                handler: noCache
                    ? async () => {
                          const fileBuffer = await readFile(absolutePath)
                          return new Response(new Uint8Array(fileBuffer), { headers })
                      }
                    : async (req: Request) => {
                          // 使用 vafast 内置解析器
                          const headersRecord = parseHeaders(req) as Record<string, string | undefined>
                          
                          if (await isCached(headersRecord, etag, absolutePath)) {
                              return empty(304, headers)
                          }

                          const responseHeaders = { ...headers }
                          responseHeaders['Etag'] = etag
                          responseHeaders['Cache-Control'] = directive
                          if (maxAge !== null)
                              responseHeaders['Cache-Control'] += `, max-age=${maxAge}`

                          const fileBuffer = await readFile(absolutePath)
                          return new Response(new Uint8Array(fileBuffer), {
                              headers: responseHeaders
                          })
                      }
            })

            if (indexHTML && pathName.endsWith('/index.html'))
                routes.push({
                    method: 'GET',
                    path: pathName.replace('/index.html', ''),
                    handler: noCache
                        ? async () => {
                              const fileBuffer = await readFile(absolutePath)
                              return new Response(new Uint8Array(fileBuffer), { headers })
                          }
                        : async (req: Request) => {
                              // 使用 vafast 内置解析器
                              const headersRecord = parseHeaders(req) as Record<string, string | undefined>
                              
                              if (await isCached(headersRecord, etag, pathName)) {
                                  return empty(304, headers)
                              }

                              const responseHeaders = { ...headers }
                              responseHeaders['Etag'] = etag
                              responseHeaders['Cache-Control'] = directive
                              if (maxAge !== null)
                                  responseHeaders['Cache-Control'] += `, max-age=${maxAge}`

                              const fileBuffer = await readFile(absolutePath)
                              return new Response(new Uint8Array(fileBuffer), {
                                  headers: responseHeaders
                              })
                          }
                })
        }
    else {
        // Check if wildcard route already exists
        const wildcardExists = routes.some(
            route => route.path === `${prefix}/*` && route.method === 'GET'
        )
        
        if (!wildcardExists) {
            routes.push({
                method: 'GET',
                path: `${prefix}/*`,
                handler: async (req: Request) => {
                    // Extract path from URL for wildcard routes
                    const urlPath = new URL(req.url).pathname
                    const wildcardPath = urlPath.replace(prefix, '')
                    
                    let path = enableDecodeURI
                        ? decodeURI(`${assets}${wildcardPath}`)
                        : `${assets}${wildcardPath}`
                    
                    // Handle varying filepath separators
                    if (isFSSepUnsafe) {
                        path = path.replace(URL_PATH_SEP, sep)
                    }

                    // Note that path must match the system separator
                    if (shouldIgnore(path)) throw new NotFoundError()

                    try {
                        let status = statCache.get<Stats>(path)
                        if (!status) {
                            status = await stat(path)
                            statCache.set(path, status)
                        }

                        if (!indexHTML && status.isDirectory())
                            throw new NotFoundError()

                        let filePath = fileCache.get<string>(path)

                        if (!filePath) {
                            if (status.isDirectory()) {
                                let hasCache = false

                                if (
                                    indexHTML &&
                                    (hasCache =
                                        htmlCache.get<boolean>(
                                            `${path}${sep}index.html`
                                        ) ??
                                        (await fileExists(
                                            `${path}${sep}index.html`
                                        )))
                                ) {
                                    if (hasCache === undefined)
                                        htmlCache.set(
                                            `${path}${sep}index.html`,
                                            true
                                        )

                                    filePath = `${path}${sep}index.html`
                                    fileCache.set(path, filePath)
                                } else {
                                    if (indexHTML && hasCache === undefined)
                                        htmlCache.set(
                                            `${path}${sep}index.html`,
                                            false
                                        )

                                    throw new NotFoundError()
                                }
                            }

                            filePath ??= path
                            fileCache.set(path, filePath)
                        }

                        if (noCache) {
                            const fileBuffer = await readFile(filePath)
                            return new Response(new Uint8Array(fileBuffer), {
                                headers
                            })
                        }

                        const etag = await generateETag(filePath)
                        // 使用 vafast 内置解析器
                        const headersRecord = parseHeaders(req) as Record<string, string | undefined>
                        
                        if (await isCached(headersRecord, etag, path))
                            return empty(304, headers)

                        const responseHeaders = { ...headers }
                        responseHeaders['Etag'] = etag
                        responseHeaders['Cache-Control'] = directive
                        if (maxAge !== null)
                            responseHeaders['Cache-Control'] += `, max-age=${maxAge}`

                        const fileBuffer = await readFile(filePath)
                        return new Response(new Uint8Array(fileBuffer), {
                            headers: responseHeaders
                        })
                    } catch (error) {
                        throw new NotFoundError()
                    }
                }
            })
        }
    }

    return routes
}

export default staticPlugin
