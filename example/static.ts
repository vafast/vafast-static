import { Server } from 'tirne'
import staticPlugin from '../src'

const routes = await staticPlugin({
    alwaysStatic: true,
    noExtension: true
})

const server = new Server(routes)
console.log('Static server with no extension enabled')
console.log('Routes:', routes.length)
