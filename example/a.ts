import { Server } from 'tirne'
import { staticPlugin } from '../src'

const a = async () => {
    return []
}

const routes1 = await a()
const routes2 = await staticPlugin({
    ignorePatterns: [/takodachi.png$/]
})
const routes3 = await staticPlugin({
    assets: 'public-aliased',
    ignorePatterns: [/takodachi.png$/]
})

const allRoutes = [...routes1, ...routes2, ...routes3]
const server = new Server(allRoutes)
console.log('Server with multiple static plugins')
console.log('Total routes:', allRoutes.length)
