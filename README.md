# @vafast/static

Plugin for [Vafast](https://github.com/vafastjs/vafast) for serving static files.

## Installation

```bash
bun add @vafast/static
# or
npm install @vafast/static
```

## Example

```typescript
import { Server, createHandler } from 'vafast'
import { staticPlugin } from '@vafast/static'
import { join } from 'path'

// Generate static routes
const staticRoutes = await staticPlugin({
  assets: './public',
  prefix: '/static',
  alwaysStatic: true
})

// Add custom routes
const customRoutes = [
  {
    method: 'GET',
    path: '/',
    handler: createHandler(() => {
      return { message: 'Static file server is running' }
    })
  }
]

// Merge static routes and custom routes
const allRoutes = [...customRoutes, ...staticRoutes]

const server = new Server(allRoutes)

export default {
  fetch: (req: Request) => server.fetch(req)
}
```

## Configuration

### assets

@default `"public"`

Asset path to expose as a public path

### prefix

@default `'/public'`

Path prefix to create a virtual mount path for the static directory

### staticLimit

@default `1024`

If total files exceed this number, the file will be handled via wildcard instead of the static route to reduce memory usage

### alwaysStatic

@default `false`

If set to true, the file will always use a static path instead

### noExtension

@default `false`

If set to true, files can be accessed without extension

## License

MIT
