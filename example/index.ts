import { Server, createRouteHandler } from 'vafast'

import { staticPlugin } from '../src/index'
import { join } from 'path'

const staticRoutes = await staticPlugin({
    alwaysStatic: true
})

// 添加一些自定义路由
const customRoutes = [
    {
        method: 'GET',
        path: '/',
        handler: createRouteHandler(() => {
            return { message: 'Static file server is running', routes: staticRoutes.length }
        })
    },
    {
        method: 'GET',
        path: '/health',
        handler: createRouteHandler(() => {
            return { status: 'OK', timestamp: new Date().toISOString() }
        })
    }
]

// 合并静态文件路由和自定义路由
const allRoutes = [...customRoutes, ...staticRoutes]

const server = new Server(allRoutes)

// 导出 fetch 函数
export default {
    fetch: (req: Request) => server.fetch(req)
}

console.log('Server running with static routes')
console.log('Static routes:', staticRoutes.length)
console.log('Total routes:', allRoutes.length)
