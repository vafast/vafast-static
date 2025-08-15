import { Server } from 'tirne'
import { staticPlugin } from '../src'
import { readFile } from 'fs/promises'

import { describe, expect, it } from 'bun:test'
import { join, sep } from 'path'

const req = (path: string) => new Request(`http://localhost${path}`)

// Simple test helper to simulate request handling
const handleRequest = async (routes: any[], request: Request) => {
    const url = new URL(request.url)
    const path = url.pathname

    // Find matching route
    const route = routes.find((r) => {
        if (r.path === '*') return true

        // Handle wildcard routes
        if (r.path.includes('*')) {
            const pattern = r.path.replace('*', '.*')
            return new RegExp(`^${pattern}$`).test(path)
        }

        // Exact match
        return r.path === path
    })

    if (!route) {
        return new Response('Not Found', { status: 404 })
    }

    try {
        return await route.handler({
            url: request.url,
            headers: request.headers,
            method: request.method
        })
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFoundError') {
            return new Response('Not Found', { status: 404 })
        }
        throw error
    }
}

const takodachi = await readFile('public/takodachi.png')

describe('Static Plugin', () => {
    it('should get root path', async () => {
        const routes = await staticPlugin()

        const res = await handleRequest(routes, req('/public/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('should get nested path', async () => {
        const routes = await staticPlugin()

        const res = await handleRequest(
            routes,
            req('/public/nested/takodachi.png')
        )
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('should get different path', async () => {
        const routes = await staticPlugin({
            assets: 'public-aliased'
        })

        const res = await handleRequest(routes, req('/public/tako.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('should handle prefix', async () => {
        const routes = await staticPlugin({
            prefix: '/static'
        })

        const res = await handleRequest(routes, req('/static/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('should handle empty prefix', async () => {
        const routes = await staticPlugin({
            prefix: ''
        })

        const res = await handleRequest(routes, req('/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('should supports multiple public', async () => {
        const routes1 = await staticPlugin({
            prefix: '/public-aliased',
            assets: 'public-aliased'
        })
        const routes2 = await staticPlugin({
            prefix: '/public'
        })
        const allRoutes = [...routes1, ...routes2]

        const res = await handleRequest(allRoutes, req('/public/takodachi.png'))

        expect(res.status).toBe(200)
    })

    it('ignore string pattern', async () => {
        const routes = await staticPlugin({
            ignorePatterns: [`public${sep}takodachi.png`]
        })

        const res = await handleRequest(routes, req('/public/takodachi.png'))
        expect(res.status).toBe(404)
    })

    it('ignore regex pattern', async () => {
        const routes = await staticPlugin({
            ignorePatterns: [/takodachi.png$/]
        })

        const file = await handleRequest(routes, req('/public/takodachi.png'))

        expect(file.status).toBe(404)
    })

    it('always static', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true
        })

        const res = await handleRequest(routes, req('/public/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('always static with assets on an absolute path', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            assets: join(process.cwd(), 'public')
        })

        const res = await handleRequest(routes, req('/public/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('exclude extension', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true
        })

        const res = await handleRequest(routes, req('/public/takodachi'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
    })

    it('return custom headers', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true,
            headers: {
                ['x-powered-by']: 'Takodachi'
            }
        })

        const res = await handleRequest(routes, req('/public/takodachi'))

        expect(res.headers.get('x-powered-by')).toBe('Takodachi')
        expect(res.status).toBe(200)
    })

    it('return etag header', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true
        })

        const res = await handleRequest(routes, req('/public/takodachi'))

        expect(res.headers.get('Etag')).toBe('ZGe9eXgawZBlMox8sZg82Q==')
        expect(res.status).toBe(200)
    })

    it('return no etag header when noCache', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true,
            noCache: true
        })

        const res = await handleRequest(routes, req('/public/takodachi'))

        expect(res.headers.get('Etag')).toBe(null)
        expect(res.status).toBe(200)
    })

    it('return Cache-Control header when maxAge is set', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true,
            maxAge: 3600
        })

        const res = await handleRequest(routes, req('/public/takodachi'))

        expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')
        expect(res.status).toBe(200)
    })

    it('return Cache-Control header when maxAge is not set', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true
        })

        const res = await handleRequest(routes, req('/public/takodachi'))

        expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400')
        expect(res.status).toBe(200)
    })

    it('skip Cache-Control header when maxAge is null', async () => {
        const routes = await staticPlugin({
            maxAge: null
        })

        const res = await handleRequest(routes, req('/public/takodachi.png'))

        expect(res.headers.get('Cache-Control')).toBe('public')
        expect(res.status).toBe(200)
    })

    it('set cache directive', async () => {
        const routes = await staticPlugin({
            directive: 'private'
        })

        const res = await handleRequest(routes, req('/public/takodachi.png'))

        expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400')
        expect(res.status).toBe(200)
    })

    it('return not modified response (etag)', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true
        })

        const request = req('/public/takodachi')
        request.headers.append('If-None-Match', 'ZGe9eXgawZBlMox8sZg82Q==')

        const res = await handleRequest(routes, request)

        expect(res.body).toBe(null)
        expect(res.status).toBe(304)
    })

    it('return not modified response (time)', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true
        })

        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)

        const request = req('/public/takodachi')
        request.headers.append('If-Modified-Since', tomorrow.toString())

        const res = await handleRequest(routes, request)

        expect(res.body).toBe(null)
        expect(res.status).toBe(304)
    })

    it('return ok response when noCache', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            noExtension: true,
            noCache: true
        })

        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)

        const request = req('/public/takodachi')
        request.headers.append('If-None-Match', 'ZGe9eXgawZBlMox8sZg82Q==')
        request.headers.append('If-Modified-Since', tomorrow.toString())

        const res = await handleRequest(routes, request)

        expect(res.status).toBe(200)
    })

    it('should 404 when navigate to folder', async () => {
        const routes = await staticPlugin()

        const notFoundPaths = [
            '/public',
            '/public/',
            '/public/nested',
            '/public/nested/'
        ]

        for (const path of notFoundPaths) {
            const res = await handleRequest(routes, req(path))

            expect(res.status).toBe(404)
        }
    })

    it('serve index.html to default /', async () => {
        const routes = await staticPlugin()

        let res = await handleRequest(routes, req('/public'))
        expect(res.status).toBe(404)

        res = await handleRequest(routes, req('/public/html'))
        expect(res.status).toBe(200)
    })

    it('does not serve index.html to default / when not indexHTML', async () => {
        const routes = await staticPlugin({
            indexHTML: false
        })

        let res = await handleRequest(routes, req('/public'))
        expect(res.status).toBe(404)

        res = await handleRequest(routes, req('/public/html'))
        expect(res.status).toBe(404)
    })

    it('serves index.html to default / when alwaysStatic', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true
        })

        let res = await handleRequest(routes, req('/public'))
        expect(res.status).toBe(404)

        res = await handleRequest(routes, req('/public/html'))
        expect(res.status).toBe(200)
    })

    it('does not serve index.html to default / when alwaysStatic and not indexHTML', async () => {
        const routes = await staticPlugin({
            alwaysStatic: true,
            indexHTML: false
        })

        let res = await handleRequest(routes, req('/public'))
        expect(res.status).toBe(404)

        res = await handleRequest(routes, req('/public/html'))
        expect(res.status).toBe(404)
    })
})
