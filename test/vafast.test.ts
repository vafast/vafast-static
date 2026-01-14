import { Server, defineRoute, defineRoutes, json } from 'vafast'
import { staticPlugin } from '../src/index'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'

describe('Vafast Static Plugin', () => {
    let tempDir: string
    let testFilePath: string
    let testHtmlPath: string

    beforeAll(async () => {
        // 创建临时目录和测试文件
        tempDir = join(tmpdir(), 'vafast-static-test-' + Date.now())
        await mkdir(tempDir, { recursive: true })

        // 创建测试文件
        testFilePath = join(tempDir, 'test.txt')
        await writeFile(testFilePath, 'Hello, Static File!')

        // 创建测试 HTML 文件
        testHtmlPath = join(tempDir, 'index.html')
        await writeFile(testHtmlPath, '<html><body>Test HTML</body></html>')
    })

    afterAll(async () => {
        // 清理临时文件
        await rm(tempDir, { recursive: true, force: true })
    })

    it('should create static routes', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true
        })

        expect(routes).toBeDefined()
        expect(Array.isArray(routes)).toBe(true)
        expect(routes.length).toBeGreaterThan(0)
    })

    it('should serve static files with correct paths', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true
        })

        const app = new Server(routes)

        // 测试访问静态文件
        const res = await app.fetch(
            new Request('http://localhost/static/test.txt')
        )
        expect(res.status).toBe(200)
        const data = await res.text()
        expect(data).toBe('Hello, Static File!')
    })

    it('should handle index.html correctly', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true,
            indexHTML: true
        })

        const app = new Server(routes)

        // 测试访问目录根路径（应该返回 index.html）
        const res = await app.fetch(new Request('http://localhost/static/'))
        expect(res.status).toBe(200)
        const data = await res.text()
        expect(data).toContain('Test HTML')
    })

    it('should respect custom headers', async () => {
        const customHeaders = {
            'X-Custom-Header': 'custom-value',
            'X-Another-Header': 'another-value'
        }

        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true,
            headers: customHeaders
        })

        const app = new Server(routes)

        const res = await app.fetch(
            new Request('http://localhost/static/test.txt')
        )
        expect(res.status).toBe(200)

        // 检查自定义头部
        expect(res.headers.get('X-Custom-Header')).toBe('custom-value')
        expect(res.headers.get('X-Another-Header')).toBe('another-value')
    })

    it('should handle caching correctly', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true,
            noCache: false,
            maxAge: 3600
        })

        const app = new Server(routes)

        const res = await app.fetch(
            new Request('http://localhost/static/test.txt')
        )
        expect(res.status).toBe(200)

        // 检查缓存头部
        expect(res.headers.get('Cache-Control')).toContain('max-age=3600')
        expect(res.headers.get('Etag')).toBeDefined()
    })

    it('should handle no-cache setting', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true,
            noCache: true
        })

        const app = new Server(routes)

        const res = await app.fetch(
            new Request('http://localhost/static/test.txt')
        )
        expect(res.status).toBe(200)

        // 检查没有缓存头部
        expect(res.headers.get('Cache-Control')).toBeNull()
        expect(res.headers.get('Etag')).toBeNull()
    })

    it('should handle custom prefix', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/files',
            alwaysStatic: true
        })

        const app = new Server(routes)

        // 测试使用自定义前缀访问文件
        const res = await app.fetch(
            new Request('http://localhost/files/test.txt')
        )
        expect(res.status).toBe(200)
        const data = await res.text()
        expect(data).toBe('Hello, Static File!')
    })

    it('should handle root prefix', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/',
            alwaysStatic: true
        })

        const app = new Server(routes)

        // 测试使用根前缀访问文件
        const res = await app.fetch(new Request('http://localhost/test.txt'))
        expect(res.status).toBe(200)
        const data = await res.text()
        expect(data).toBe('Hello, Static File!')
    })

    it('should handle 304 Not Modified responses', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true,
            noCache: false
        })

        const app = new Server(routes)

        // 第一次请求
        const res1 = await app.fetch(
            new Request('http://localhost/static/test.txt')
        )
        expect(res1.status).toBe(200)
        const etag = res1.headers.get('Etag')
        expect(etag).toBeDefined()

        // 第二次请求，带 If-None-Match 头部
        const res2 = await app.fetch(
            new Request('http://localhost/static/test.txt', {
                headers: {
                    'If-None-Match': etag!
                }
            })
        )

        // 应该返回 304 Not Modified
        expect(res2.status).toBe(304)
    })

    it('should work with custom routes', async () => {
        const staticRoutes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true
        })

        // 添加自定义路由
        const customRoutes = defineRoutes([
            defineRoute({
                method: 'GET',
                path: '/',
                handler: () => json({ message: 'Static server is running' })
            })
        ])

        const allRoutes = [...customRoutes, ...staticRoutes]
        const app = new Server(allRoutes)

        // 测试自定义路由
        const customRes = await app.fetch(new Request('http://localhost/'))
        expect(customRes.status).toBe(200)
        const customData = await customRes.json()
        expect(customData.message).toBe('Static server is running')

        // 测试静态文件路由
        const staticRes = await app.fetch(
            new Request('http://localhost/static/test.txt')
        )
        expect(staticRes.status).toBe(200)
        const staticData = await staticRes.text()
        expect(staticData).toBe('Hello, Static File!')
    })

    it('should handle file not found correctly', async () => {
        const routes = await staticPlugin({
            assets: tempDir,
            prefix: '/static',
            alwaysStatic: true
        })

        const app = new Server(routes)

        // 测试访问不存在的文件
        try {
            await app.fetch(
                new Request('http://localhost/static/nonexistent.txt')
            )
            // 如果到这里，说明错误没有被正确处理
            expect(true).toBe(false)
        } catch (error) {
            expect(error).toBeDefined()
        }
    })
})
