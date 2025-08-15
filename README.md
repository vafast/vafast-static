# @huyooo/elysia-static
Plugin for [elysia](https://github.com/saltyaom/elysia) for serving static folder.

## Installation
```bash
bun add @huyooo/elysia-static
```

## Example
```typescript
import { Elysia } from '@huyooo/elysia'
import { staticPlugin } from '@huyooo/elysia-static'

const app = new Elysia()
    .use(staticPlugin())
    .listen(8080)
```

## Config
Below is an available config for a static plugin.

### assets
@default "public"

Asset path to expose as a public path

### prefix
@default '/public'

Path prefix to create a virtual mount path for the static directory

### staticLimit
@defualt 1024

If total files exceed this number, the file will be handled via wildcard instead of the static route to reduce memory usage

### alwaysStatic
@default boolean

If set to true, the file will always use a static path instead
