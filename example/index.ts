import { Server } from 'tirne'

import { staticPlugin } from '../src/index'
import { join } from 'path'

const routes = await staticPlugin({
    alwaysStatic: true
})

const server = new Server(routes)
// Tirne服务器启动方式可能不同，这里使用基本的方式
console.log('Server running with static routes')
console.log('Routes:', routes.length)
