### Install TanStack DB and Query Collection

Source: https://tanstack.com/db/latest/docs/quick-start

Installs the necessary packages for TanStack DB and its integration with TanStack Query. These packages enable client-first data management and reactive querying.

```bash
npm install @tanstack/react-db @tanstack/query-db-collection
```

--------------------------------

### Query Data with Live Queries and Transformations

Source: https://tanstack.com/db/latest/docs/quick-start

Demonstrates how to use `useLiveQuery` to fetch and display data reactively. This example shows basic filtering and sorting of 'todos' and also transforms the data to create a summary view with specific fields.

```tsx
function TodoList() {
  // Basic filtering and sorting
  const { data: incompleteTodos } = useLiveQuery((q) =>
    q.from({ todo: todoCollection })
     .where(({ todo }) => eq(todo.completed, false))
     .orderBy(({ todo }) => todo.createdAt, 'desc')
  )

  // Transform the data
  const { data: todoSummary } = useLiveQuery((q) =>
    q.from({ todo: todoCollection })
     .select(({ todo }) => ({
       id: todo.id,
       summary: `${todo.text} (${todo.completed ? 'done' : 'pending'})`,
       priority: todo.priority || 'normal'
     }))
  )

  return <div>{/* Render todos */}</div>
}
```

--------------------------------

### Install Core TanStack DB for Vanilla JS

Source: https://tanstack.com/db/latest/docs/installation

Installs the core TanStack DB package for use without a specific framework.

```sh
npm install @tanstack/db
```

--------------------------------

### Create a Data Collection with TanStack Query Integration

Source: https://tanstack.com/db/latest/docs/quick-start

Defines a data collection using `createCollection` and `queryCollectionOptions`. This setup integrates with TanStack Query to fetch initial data and defines handlers for insert, update, and delete operations to synchronize with the API.

```tsx
import { createCollection, eq, useLiveQuery } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

// Define a collection that loads data using TanStack Query
const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos')
      return response.json()
    },
    getKey: (item) => item.id,
    // Handle all CRUD operations
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]
      await fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify(newNewTodo),
      })
    },
    onUpdate: async ({ transaction }) => {
      const { original, modified } = transaction.mutations[0]
      await fetch(`/api/todos/${original.id}`, {
        method: 'PUT',
        body: JSON.stringify(modified),
      })
    },
    onDelete: async ({ transaction }) => {
      const { original } = transaction.mutations[0]
      await fetch(`/api/todos/${original.id}`, { method: 'DELETE' })
    },
  })
)
```

--------------------------------

### Install TanStack DB Solid Adapter

Source: https://tanstack.com/db/latest/docs/framework/solid/overview

Installs the @tanstack/solid-db package using npm. This is the first step to integrating TanStack DB with Solid.js.

```sh
npm install @tanstack/solid-db
```

--------------------------------

### Basic TrailBase Collection Setup

Source: https://tanstack.com/db/latest/docs/collections/trailbase-collection

Demonstrates the basic setup for creating a TrailBase collection. It initializes the TrailBase client and uses `createCollection` with `trailBaseCollectionOptions` to define a 'todos' collection.

```typescript
import { createCollection } from '@tanstack/react-db'
import { trailBaseCollectionOptions } from '@tanstack/trailbase-db-collection'
import { initClient } from 'trailbase'

const trailBaseClient = initClient(`https://your-trailbase-instance.com`)

const todosCollection = createCollection(
  trailBaseCollectionOptions({
    id: 'todos',
    recordApi: trailBaseClient.records('todos'),
    getKey: (item) => item.id,
  })
)
```

--------------------------------

### Install TanStack DB React Adapter

Source: https://tanstack.com/db/latest/docs/framework/react/overview

Installs the TanStack DB React Adapter using npm. This is the first step to using the adapter in a React project.

```sh
npm install @tanstack/react-db
```

--------------------------------

### Create a LocalStorage Collection

Source: https://tanstack.com/db/latest/docs/collections/local-storage-collection

Demonstrates the basic setup for creating a LocalStorage collection using `createCollection` and `localStorageCollectionOptions`. It requires an ID, a storage key, and a function to get the item's key.

```typescript
import { createCollection } from '@tanstack/react-db'
import { localStorageCollectionOptions } from '@tanstack/react-db'

const userPreferencesCollection = createCollection(
  localStorageCollectionOptions({
    id: 'user-preferences',
    storageKey: 'app-user-prefs',
    getKey: (item) => item.id,
  })
)
```

--------------------------------

### useLiveSuspenseQuery Hook Example

Source: https://tanstack.com/db/latest/docs/framework/react/overview

Shows how to use `useLiveSuspenseQuery` for seamless integration with React Suspense. It includes an example of a component that suspends while data is loading and how it re-suspends when dependencies change.

```tsx
function TodoList({ filter }: { filter: string }) {
  const { data } = useLiveSuspenseQuery(
    (q) => q.from({ todos: todosCollection })
           .where(({ todos }) => eq(todos.filter, filter)),
    [filter] // Re-suspends when filter changes
  )

  return (
    <ul>
      {data.map(todo => <li key={todo.id}>{todo.text}</li>)}
    </ul>
  )
}

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TodoList filter="active" />
    </Suspense>
  )
}
```

--------------------------------

### Basic useLiveQuery Hook Example

Source: https://tanstack.com/db/latest/docs/framework/react/overview

Demonstrates the basic usage of the `useLiveQuery` hook to fetch and display a list of incomplete todos. It shows how to define a query and handle loading states.

```tsx
import { useLiveQuery } from '@tanstack/react-db'

function TodoList() {
  const { data, isLoading } = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
     .where(({ todos }) => eq(todos.completed, false))
     .select(({ todos }) => ({ id: todos.id, text: todos.text }))
  )

  if (isLoading) return <div>Loading...</div>

  return (
    <ul>
      {data.map(todo => <li key={todo.id}>{todo.text}</li>)}
    </ul>
  )
}
```

--------------------------------

### Install TanStack DB Query Collection

Source: https://tanstack.com/db/latest/docs/installation

Installs the collection package for integrating TanStack DB with TanStack Query for data loading, suitable for REST APIs.

```sh
npm install @tanstack/query-db-collection
```

--------------------------------

### Complete LocalStorage Collection Example with Zod Schema (TypeScript)

Source: https://tanstack.com/db/latest/docs/collections/local-storage-collection

A comprehensive example demonstrating the creation and usage of a LocalStorage collection with schema validation using Zod. It includes defining a schema, creating the collection, and using `useLiveQuery` within a React component to display and update user preferences.

```typescript
import { createCollection, eq } from '@tanstack/react-db'
import { localStorageCollectionOptions } from '@tanstack/react-db'
import { useLiveQuery } from '@tanstack/react-db'
import { z } from 'zod'

// Define schema
const userPrefsSchema = z.object({
  id: z.string(),
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.string(),
  notifications: z.boolean(),
})

type UserPrefs = z.infer<typeof userPrefsSchema>

// Create collection
export const userPreferencesCollection = createCollection(
  localStorageCollectionOptions({
    id: 'user-preferences',
    storageKey: 'app-user-prefs',
    getKey: (item) => item.id,
    schema: userPrefsSchema,
  })
)

// Use in component
function SettingsPanel() {
  const { data: prefs } = useLiveQuery((q) =>
    q.from({ pref: userPreferencesCollection })
      .where(({ pref }) => eq(pref.id, 'current-user'))
  )

  const currentPrefs = prefs[0]

  const updateTheme = (theme: 'light' | 'dark' | 'auto') => {
    if (currentPrefs) {
      userPreferencesCollection.update(currentPrefs.id, (draft) => {
        draft.theme = theme
      })
    } else {
      userPreferencesCollection.insert({
        id: 'current-user',
        theme,
        language: 'en',
        notifications: true,
      })
    }
  }

  return (
    <div>
      <h2>Theme: {currentPrefs?.theme}</h2>
      <button onClick={() => updateTheme('dark')}>Dark Mode</button>
      <button onClick={() => updateTheme('light')}>Light Mode</button>
    </div>
  )
}
```

--------------------------------

### Live Query with Dependencies (TypeScript)

Source: https://tanstack.com/db/latest/docs/framework/solid/reference/functions/useLiveQuery

This example shows how to use useLiveQuery with dependencies that trigger re-execution of the query. It fetches todos based on a minimum priority level, which can be dynamically updated.

```typescript
function useLiveQuery<TContext>(queryFn): Accessor<{ [K in string | number | symbol]: (TContext["result"] extends object ? any[any] : TContext["hasJoins"] extends true ? TContext["schema"] : TContext["schema"][TContext["fromSourceName"]])[K] }[]> & object;

// With dependencies that trigger re-execution
const todosQuery = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => gt(todos.priority, minPriority()))
)
```

--------------------------------

### Example Component: Displaying and Toggling Todos

Source: https://tanstack.com/db/latest/docs/quick-start

A React component that utilizes TanStack DB to display a list of todos and allows users to toggle their completion status. It uses `useLiveQuery` for reactive data fetching and optimistic updates for immediate UI feedback.

```tsx
import { createCollection, eq, useLiveQuery } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

// Define a collection that loads data using TanStack Query
const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos')
      return response.json()
    },
    getKey: (item) => item.id,
    onUpdate: async ({ transaction }) => {
      const { original, modified } = transaction.mutations[0]
      await fetch(`/api/todos/${original.id}`, {
        method: 'PUT',
        body: JSON.stringify(modified),
      })
    },
  })
)

function Todos() {
  // Live query that updates automatically when data changes
  const { data: todos } = useLiveQuery((q) =>
    q.from({ todo: todoCollection })
     .where(({ todo }) => eq(todo.completed, false))
     .orderBy(({ todo }) => todo.createdAt, 'desc')
  )

  const toggleTodo = (todo) => {
    // Instantly applies optimistic state, then syncs to server
    todoCollection.update(todo.id, (draft) => {
      draft.completed = !draft.completed
    })
  }

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id} onClick={() => toggleTodo(todo)}>
          {todo.text}
        </li>
      ))}
    </ul>
  )
}
```

--------------------------------

### useLiveInfiniteQuery Hook Example

Source: https://tanstack.com/db/latest/docs/framework/react/overview

Demonstrates the usage of `useLiveInfiniteQuery` for handling paginated data with live updates. It includes configuration options like `pageSize` and `getNextPageParam`, along with a dependency array for reactive filtering.

```tsx
const { data, pages, fetchNextPage, hasNextPage } = useLiveInfiniteQuery(
  (q) => q
    .from({ posts: postsCollection })
    .where(({ posts }) => eq(posts.category, category))
    .orderBy(({ posts }) => posts.createdAt, 'desc'),
  {
    pageSize: 20,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length : undefined
  },
  [category] // Re-run when category changes
)
```

--------------------------------

### Install TanStack DB RxDB Collection

Source: https://tanstack.com/db/latest/docs/installation

Installs the collection package for offline-first applications using RxDB. Provides reactive collections backed by RxDB's features.

```sh
npm install @tanstack/rxdb-db-collection
```

--------------------------------

### Install TanStack DB Electric Collection

Source: https://tanstack.com/db/latest/docs/installation

Installs the collection package for real-time data synchronization with ElectricSQL. Ideal for local-first applications.

```sh
npm install @tanstack/electric-db-collection
```

--------------------------------

### Install TanStack DB Svelte Adapter

Source: https://tanstack.com/db/latest/docs/framework/svelte/overview

Installs the TanStack DB Svelte adapter using npm. This is the first step to integrating TanStack DB with your Svelte project.

```sh
npm install @tanstack/svelte-db
```

--------------------------------

### Install TanStack DB Vue Adapter

Source: https://tanstack.com/db/latest/docs/framework/vue/overview

Installs the @tanstack/vue-db package using npm. This is the first step to using the TanStack DB Vue adapter in your project.

```sh
npm install @tanstack/vue-db
```

--------------------------------

### Install TanStack DB TrailBase Collection

Source: https://tanstack.com/db/latest/docs/installation

Installs the collection package for syncing records with TrailBase backends, including built-in subscription support.

```sh
npm install @tanstack/trailbase-db-collection
```

--------------------------------

### useLiveQuery Best Practices in Svelte

Source: https://tanstack.com/db/latest/docs/framework/svelte/overview

Illustrates best practices for using `useLiveQuery` in Svelte, emphasizing the inclusion of all external values in the dependency array for correct query updates. It also shows examples for static queries.

```svelte
<script>
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { eq, and } from '@tanstack/db'

  let userId = $state(1)
  let status = $state('active')

  // Good - all external values in deps
  const query = useLiveQuery(
    (q) => q.from({ todos: todosCollection })
           .where(({ todos }) => and(
             eq(todos.userId, userId),
             eq(todos.status, status)
           )),
    [() => userId, () => status]
  )

  // Bad - missing dependencies
  const badQuery = useLiveQuery(
    (q) => q.from({ todos: todosCollection })
           .where(({ todos }) => eq(todos.userId, userId)),
    [] // Missing userId!
  )
</script>

<div>{query.data.length} todos</div>
```

```svelte
<script>
  import { useLiveQuery } from '@tanstack/svelte-db'

  // No external dependencies - query never changes
  const query = useLiveQuery(
    (q) => q.from({ todos: todosCollection }),
    []
  )
</script>

<div>{query.data.length} todos</div>
```

```svelte
<script>
  import { useLiveQuery } from '@tanstack/svelte-db'

  // Same as above - no deps needed
  const query = useLiveQuery(
    (q) => q.from({ todos: todosCollection })
  )
</script>

<div>{query.data.length} todos</div>
```

--------------------------------

### Install @tanstack/query-db-collection

Source: https://tanstack.com/db/latest/docs/collections/query-collection

Installs the necessary packages for integrating TanStack DB with TanStack Query. This includes the query-db-collection, query-core, and db packages.

```bash
npm install @tanstack/query-db-collection @tanstack/query-core @tanstack/db
```

--------------------------------

### Basic useLiveQuery with Object Syntax (TypeScript)

Source: https://tanstack.com/db/latest/docs/framework/vue/reference/functions/useLiveQuery

Demonstrates the basic usage of `useLiveQuery` using an object syntax for defining the query. This example includes filtering and selecting specific fields from the collection.

```typescript
// Basic query with object syntax
const { data, isLoading } = useLiveQuery((q) =>
  q.from({ todos: todosCollection })
   .where(({ todos }) => eq(todos.completed, false))
   .select(({ todos }) => ({ id: todos.id, text: todos.text }))
)
```

--------------------------------

### Install PowerSync Collection and Dependencies

Source: https://tanstack.com/db/latest/docs/collections/powersync-collection

Installs the necessary packages for integrating PowerSync with TanStack DB, including the PowerSync Web SDK and WA-SQLite for web environments.

```bash
npm install @tanstack/powersync-db-collection @powersync/web @journeyapps/wa-sqlite
```

--------------------------------

### JavaScript: Electric Proxy Implementation with TanStack Starter

Source: https://tanstack.com/db/latest/docs/collections/electric-collection

An example of an Electric SQL proxy server implementation using TanStack Starter. This server route handles incoming requests, forwards them to the Electric backend, and manages parameters like `table` and optional `where` clauses. It also correctly passes through Electric protocol query parameters and modifies response headers.

```javascript
import { createServerFileRoute } from "@tanstack/react-start/server"
import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client"

// Electric URL
const baseUrl = 'http://.../v1/shape'

const serve = async ({ request }: { request: Request }) => {
  // ...check user authorization  
  const url = new URL(request.url)
  const originUrl = new URL(baseUrl)

  // passthrough parameters from electric client
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  // set shape parameters 
  // full spec: https://github.com/electric-sql/electric/blob/main/website/electric-api.yaml
  originUrl.searchParams.set("table", "todos")
  // Where clause to filter rows in the table (optional).
  // originUrl.searchParams.set("where", "completed = true")
  
  // Select the columns to sync (optional)
  // originUrl.searchParams.set("columns", "id,text,completed")

  const response = await fetch(originUrl)
  const headers = new Headers(response.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const ServerRoute = createServerFileRoute("/api/todos").methods({
  GET: serve,
})
```

--------------------------------

### useLiveQuery Dependency Array Best Practices

Source: https://tanstack.com/db/latest/docs/framework/react/overview

Provides examples of correct and incorrect usage of dependency arrays with `useLiveQuery`. It emphasizes including all external values used in the query and using an empty array for static queries.

```tsx
// Good - all external values in deps
const { data } = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => and(
           eq(todos.userId, userId),
           eq(todos.status, status)
         )),
  [userId, status]
)

// Bad - missing dependencies
const { data } = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => eq(todos.userId, userId)),
  [] // Missing userId!
)

// No external dependencies - query never changes
const { data } = useLiveQuery(
  (q) => q.from({ todos: todosCollection }),
  []
)

// Same as above - no deps needed
const { data } = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
)
```

--------------------------------

### Implement Optimistic Mutations for Data Updates

Source: https://tanstack.com/db/latest/docs/quick-start

Shows how to perform optimistic mutations (insert, update, delete) on a collection. Changes are applied instantly to the UI and then synchronized with the server, with automatic rollback on failure.

```tsx
function TodoActions({ todo }) {
  const addTodo = () => {
    todoCollection.insert({
      id: crypto.randomUUID(),
      text: 'New todo',
      completed: false,
      createdAt: new Date(),
    })
  }

  const toggleComplete = () => {
    todoCollection.update(todo.id, (draft) => {
      draft.completed = !draft.completed
    })
  }

  const updateText = (newText) => {
    todoCollection.update(todo.id, (draft) => {
      draft.text = newText
    })
  }

  const deleteTodo = () => {
    todoCollection.delete(todo.id)
  }

  return (
    <div>
      <button onClick={addTodo}>Add Todo</button>
      <button onClick={toggleComplete}>Toggle</button>
      <button onClick={() => updateText('Updated!')}>Edit</button>
      <button onClick={deleteTodo}>Delete</button>
    </div>
  )
}
```

--------------------------------

### Install TanStack DB Angular Adapter

Source: https://tanstack.com/db/latest/docs/framework/angular/overview

Installs the TanStack DB Angular Adapter package using npm. This is the first step to using the adapter in an Angular project.

```sh
npm install @tanstack/angular-db
```

--------------------------------

### Create a Basic Query Collection in TypeScript

Source: https://tanstack.com/db/latest/docs/collections/query-collection

Demonstrates the basic setup for creating a query collection using TypeScript. It initializes a QueryClient and defines a collection that fetches data from an API endpoint.

```typescript
import { QueryClient } from "@tanstack/query-core"
import { createCollection } from "@tanstack/db"
import { queryCollectionOptions } from "@tanstack/query-db-collection"

const queryClient = new QueryClient()

const todosCollection = createCollection(
  queryCollectionOptions({
    queryKey: ["todos"],
    queryFn: async () => {
      const response = await fetch("/api/todos")
      return response.json()
    },
    queryClient,
    getKey: (item) => item.id,
  })
)
```

--------------------------------

### useLiveQuery Hook Documentation

Source: https://tanstack.com/db/latest/docs/framework/react/reference/functions/useLiveQuery

This section details the useLiveQuery hook, its parameters, return values, and provides usage examples for various scenarios including basic queries, single result fetching, dependency tracking, joins, and state management.

```APIDOC
## useLiveQuery Hook

### Description
Creates a live query using a query function. This hook provides reactive data, loading states, and error handling for real-time data synchronization.

### Method
`useLiveQuery<TContext>(queryFn, deps?): object`

### Parameters

#### queryFn

- **Type**: `(q) => LiveQueryCollectionConfig<TContext, ...> | null | undefined`
- **Description**: A function that defines the data to fetch. It receives a query builder `q` and should return a query configuration or null/undefined to disable the query.

#### deps? (Optional)

- **Type**: `unknown[]`
- **Description**: An array of dependencies. The query will re-execute if any of these dependencies change.

### Returns

An object containing reactive data and state information:

- **collection**: The collection object used for the query, or undefined.
- **data**: The fetched data, typed according to the query result, or undefined if not yet available or an error occurred.
- **isCleanedUp**: Boolean indicating if the query has been cleaned up.
- **isEnabled**: Boolean indicating if the query is currently enabled.
- **isError**: Boolean indicating if an error occurred during data fetching.
- **isIdle**: Boolean indicating if the query is in an idle state (not yet started or disabled).
- **isLoading**: Boolean indicating if the query is currently fetching data.
- **isReady**: Boolean indicating if the query has successfully fetched data.
- **state**: A Map containing the query results, often used for caching or specific state management, or undefined.
- **status**: A string indicating the current status of the query (e.g., 'loading', 'success', 'error').

### Examples

```ts
// Basic query with object syntax
const { data, isLoading } = useLiveQuery((q) =>
  q.from({ todos: todosCollection })
   .where(({ todos }) => eq(todos.completed, false))
   .select(({ todos }) => ({ id: todos.id, text: todos.text }))
)
```

```ts
// Single result query
const { data } = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => eq(todos.id, 1))
         .findOne()
)
```

```ts
// With dependencies that trigger re-execution
const { data, state } = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => gt(todos.priority, minPriority)),
  [minPriority] // Re-run when minPriority changes
)
```

```ts
// Join pattern
const { data } = useLiveQuery((q) =>
  q.from({ issues: issueCollection })
   .join({ persons: personCollection }, ({ issues, persons }) =>
     eq(issues.userId, persons.id)
   )
   .select(({ issues, persons }) => ({
     id: issues.id,
     title: issues.title,
     userName: persons.name
   }))
)
```

```ts
// Handle loading and error states
const { data, isLoading, isError, status } = useLiveQuery((q) =>
  q.from({ todos: todoCollection })
)

if (isLoading) return <div>Loading...</div>
if (isError) return <div>Error: {status}</div>

return (
  <ul>
    {data.map(todo => <li key={todo.id}>{todo.text}</li>)}
  </ul>
)
```
```

--------------------------------

### TanStack DB Type Conversion Examples (TypeScript)

Source: https://tanstack.com/db/latest/docs/guides/collection-options-creator

Provides practical examples of type conversion functions used in TanStack DB collections. These examples demonstrate converting Firebase Timestamps to JavaScript Date objects, PostGIS geometry (WKB) to GeoJSON, and safely parsing JSON strings into JavaScript objects with error handling.

```typescript
// Firebase Timestamp to Date
parse: {
  createdAt: (timestamp) => timestamp?.toDate?.() || new Date(timestamp),
  updatedAt: (timestamp) => timestamp?.toDate?.() || new Date(timestamp),
}

// PostGIS geometry to GeoJSON
parse: {
  location: (wkb: string) => parseWKBToGeoJSON(wkb)
}

// JSON string to object with error handling
parse: {
  metadata: (str: string) => {
    try {
      return JSON.parse(str)
    } catch {
      return {}
    }
  }
}
```

--------------------------------

### PowerSync Collection Example (TypeScript)

Source: https://tanstack.com/db/latest/docs/reference/powersync-db-collection/functions/powerSyncCollectionOptions

An example demonstrating how to use powerSyncCollectionOptions to create a PowerSync collection. It includes defining the SQLite schema, Zod schemas for input/output validation, and a deserialization schema to handle type conversions from SQLite.

```typescript
import { z } from "zod"

// The PowerSync SQLite schema
const APP_SCHEMA = new Schema({
  documents: new Table({
    name: column.text,
    // Booleans are represented as integers in SQLite
    is_active: column.integer
  }),
})

// Advanced Zod validations.
// We accept boolean values as input for operations and expose Booleans in query results
const schema = z.object({
  id: z.string(),
  isActive: z.boolean(), // TInput and TOutput are boolean
})

// The deserializationSchema converts the SQLite synced INTEGER (0/1) values to booleans.
const deserializationSchema = z.object({
  id: z.string(),
  isActive: z.number().nullable().transform((val) => val == null ? true : val > 0),
})

const collection = createCollection(
  powerSyncCollectionOptions({
    database: db,
    table: APP_SCHEMA.props.documents,
    schema,
    deserializationSchema,
  })
)
```

--------------------------------

### Example: Create PowerSync Collection (TypeScript)

Source: https://tanstack.com/db/latest/docs/reference/powersync-db-collection/type-aliases/PowerSyncCollectionConfig

Demonstrates how to create a PowerSync collection using the PowerSyncCollectionConfig. This example sets up a schema, initializes a PowerSyncDatabase, and then creates a collection based on the defined schema.

```typescript
const APP_SCHEMA = new Schema({
  documents: new Table({
    name: column.text,
  }),
})

const db = new PowerSyncDatabase({
  database: {
    dbFilename: "test.sqlite",
  },
  schema: APP_SCHEMA,
})

const collection = createCollection(
  powerSyncCollectionOptions({
    database: db,
    table: APP_SCHEMA.props.documents
  })
)
```

--------------------------------

### Live Query with Reactive Dependencies

Source: https://tanstack.com/db/latest/docs/framework/svelte/reference/functions/useLiveQuery

Illustrates how to create a live query that re-executes when its reactive dependencies change. This example uses a Svelte state variable `minPriority` and includes a dependency array `[() => minPriority]` to trigger updates.

```typescript
// With reactive dependencies
let minPriority = $state(5)
const todosQuery = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => gt(todos.priority, minPriority)),
  [() => minPriority] // Re-run when minPriority changes
)
```

--------------------------------

### Live Query with Query Builder and Options

Source: https://tanstack.com/db/latest/docs/framework/react/reference/functions/useLiveQuery

Shows how to use a pre-built query object with useLiveQuery. This example creates a query builder for persons older than 30 and selects their ID and name. It returns 'data' and 'isReady'.

```typescript
const queryBuilder = new Query()
  .from({ persons: collection })
  .where(({ persons }) => gt(persons.age, 30))
  .select(({ persons }) => ({ id: persons.id, name: persons.name }))

const { data, isReady } = useLiveQuery({ query: queryBuilder })
```

--------------------------------

### Install TanStack DB Electric Collection and React DB

Source: https://tanstack.com/db/latest/docs/collections/electric-collection

Installs the necessary packages for integrating TanStack DB with ElectricSQL and React. This includes the core collection package and the React integration package.

```bash
npm install @tanstack/electric-db-collection @tanstack/react-db
```

--------------------------------

### Static Query Usage in Solid.js

Source: https://tanstack.com/db/latest/docs/framework/solid/overview

Shows a static query example using `useLiveQuery` in Solid.js, where no signals or reactive values are accessed within the query function. This query will not change after its initial execution. Dependencies include '@tanstack/solid-db'.

```tsx
import { useLiveQuery } from '@tanstack/solid-db'

function AllTodos() {
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
  )

  return <div>{query.data.length} todos</div>
}
```

--------------------------------

### Install TrailBase DB Collection Package

Source: https://tanstack.com/db/latest/docs/collections/trailbase-collection

Installs the necessary packages for integrating TanStack DB with TrailBase. This includes the collection package, React DB, and TrailBase itself.

```bash
npm install @tanstack/trailbase-db-collection @tanstack/react-db trailbase
```

--------------------------------

### Initialize and Use Live Query Collection in React

Source: https://tanstack.com/db/latest/docs/framework/react/reference/functions/useLiveQuery

This example demonstrates how to create a live query collection using a query builder and then consume it within a React component using the useLiveQuery hook. It shows how to access the fetched data and the collection object for mutations.

```typescript
// Using pre-created live query collection
const myLiveQuery = createLiveQueryCollection((q) =>
  q.from({ todos: todosCollection }).where(({ todos }) => eq(todos.active, true))
)
const { data, collection } = useLiveQuery(myLiveQuery)
```

--------------------------------

### Handle Live Query States in Template (Svelte)

Source: https://tanstack.com/db/latest/docs/framework/svelte/reference/functions/useLiveQuery

Provides an example of how to handle loading, error, and data states from a live query within a Svelte template. This ensures a consistent user experience.

```html
// In template:
// {#if queryResult.isLoading}
//   <div>Loading...</div>
// {:else if queryResult.isError}
//   <div>Error loading data</div>
// {:else}
//   {#each queryResult.data as item (item.id)}
//     <Item {...item} />
//   {/each}
// {/if}
```

--------------------------------

### Install RxDB Collection Packages

Source: https://tanstack.com/db/latest/docs/collections/rxdb-collection

Installs the necessary packages for integrating RxDB with TanStack DB, including the RxDB collection package, RxDB itself, and the React DB integration.

```bash
npm install @tanstack/rxdb-db-collection rxdb @tanstack/react-db
```

--------------------------------

### useLiveQuery with Reactive Dependencies (Config Object)

Source: https://tanstack.com/db/latest/docs/framework/svelte/reference/functions/useLiveQuery

Shows how to use `useLiveQuery` with a configuration object and a reactive dependency. This example filters todos based on a reactive state variable `filter` and re-runs the query when `filter` changes.

```typescript
// With reactive dependencies
let filter = $state('active')
const todosQuery = useLiveQuery({
  query: (q) => q.from({ todos: todosCollection })
                 .where(({ todos }) => eq(todos.status, filter))
}, [() => filter])
```

--------------------------------

### Schema Validation Example with Zod

Source: https://tanstack.com/db/latest/docs/guides/error-handling

Provides an example of how schema validation works with Zod, showing how data is transformed from its input type (string) to its output type (Date) upon successful insertion and validation.

```typescript
const schema = z.object({
  id: z.string(),
  created_at: z.string().transform(val => new Date(val))
  // TInput: string, TOutput: Date
})

// Validation happens here ✓
collection.insert({
  id: "1",
  created_at: "2024-01-01"  // TInput: string
})
// If successful, stores: { created_at: Date }  // TOutput: Date
```

--------------------------------

### Create Reusable Select Transformations

Source: https://tanstack.com/db/latest/docs/guides/live-queries

Shows how to define reusable select projections for query results. This example defines `basicUserInfo` for common fields and `userWithStats` which composes `basicUserInfo` and adds computed fields like `isAdult` and `isActive`.

```typescript
import type { Ref } from '@tanstack/db'
import { gt, eq } from '@tanstack/db'

// Assuming User type and usersCollection are defined
// type User = { age: number; active: boolean; ... }

const basicUserInfo = ({ user }: { user: Ref<User> }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
})

const userWithStats = ({ user }: { user: Ref<User> }) => ({
  ...basicUserInfo({ user }),
  isAdult: gt(user.age, 18),
  isActive: eq(user.active, true),
})

// Example usage in a query
/*
const users = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(userWithStats)
)
*/
```

--------------------------------

### Router Loader Pattern with Pre-created Collection (TypeScript)

Source: https://tanstack.com/db/latest/docs/framework/react/reference/functions/useLiveInfiniteQuery

This example illustrates integrating useLiveInfiniteQuery with a router loader pattern. First, a live query collection is pre-created and preloaded in the loader. Then, in the component, the pre-created collection is passed to useLiveInfiniteQuery. This approach allows for data prefetching and efficient hydration of the component.

```typescript
// In loader:
const postsQuery = createLiveQueryCollection({
  query: (q) => q
    .from({ posts: postsCollection })
    .orderBy(({ posts }) => posts.createdAt, 'desc')
    .limit(20)
})
await postsQuery.preload()
return { postsQuery }

// In component:
const { postsQuery } = useLoaderData()
const { data, fetchNextPage, hasNextPage } = useLiveInfiniteQuery(
  postsQuery,
  {
    pageSize: 20,
    getNextPageParam: (lastPage) => lastPage.length === 20 ? lastPage.length : undefined
  }
)
```

--------------------------------

### Electric Collection: onInsert Handler Example (TypeScript)

Source: https://tanstack.com/db/latest/docs/reference/electric-db-collection/interfaces/ElectricCollectionConfig

Provides examples of implementing an onInsert handler for an Electric collection. This handler is invoked before an insert operation. It shows how to create new records via an API, return a txid, handle multiple inserts, and use awaitMatch for custom validation of the inserted data.

```typescript
onInsert: async ({ transaction }) => {
  const newItem = transaction.mutations[0].modified
  const result = await api.todos.create({
    data: newItem
  })
  return { txid: result.txid }
}
```

```typescript
onInsert: async ({ transaction }) => {
  const newItem = transaction.mutations[0].modified
  const result = await api.todos.create({
    data: newItem
  })
  return { txid: result.txid, timeout: 10000 } // Wait up to 10 seconds
}
```

```typescript
onInsert: async ({ transaction }) => {
  const items = transaction.mutations.map(m => m.modified)
  const results = await Promise.all(
    items.map(item => api.todos.create({ data: item }))
  )
  return { txid: results.map(r => r.txid) }
}
```

```typescript
onInsert: async ({ transaction, collection }) => {
  const newItem = transaction.mutations[0].modified
  await api.todos.create({ data: newItem })
  await collection.utils.awaitMatch(
    (message) => isChangeMessage(message) &&
                 message.headers.operation === 'insert' &&
                 message.value.name === newItem.name
  )
}
```

--------------------------------

### useLiveQuery with Dependency Array Example

Source: https://tanstack.com/db/latest/docs/framework/react/overview

Illustrates how to use `useLiveQuery` with a dependency array to re-run the query when external reactive values like props or state change. This ensures the data stays synchronized with the application's state.

```tsx
function FilteredTodos({ minPriority }: { minPriority: number }) {
  const { data } = useLiveQuery(
    (q) => q.from({ todos: todosCollection })
           .where(({ todos }) => gt(todos.priority, minPriority)),
    [minPriority] // Re-run when minPriority changes
  )

  return <div>{data.length} high-priority todos</div>
}
```

--------------------------------

### Perform Live Queries with Joins Across Collections in React (TypeScript)

Source: https://tanstack.com/db/latest/docs

Illustrates how to use the `useLiveQuery` hook to perform queries that involve joining multiple collections. This example demonstrates joining 'todos' and 'lists' collections to fetch related data in a React component.

```typescript
import { useLiveQuery } from '@tanstack/react-db'
import { eq } from '@tanstack/db'

const Todos = () => {
  const { data: todos } = useLiveQuery((q) =>
    q
      .from({ todos: todoCollection })
      .join(
        { lists: listCollection },
        ({ todos, lists }) => eq(lists.id, todos.listId),
        'inner'
      )
      .where(({ lists }) => eq(lists.active, true))
      .select(({ todos, lists }) => ({
        id: todos.id,
        title: todos.title,
        listName: lists.name
      }))
  )

  return <List items={ todos } />
}
```

--------------------------------

### Handle Loading and Error States with useLiveQuery (TypeScript)

Source: https://tanstack.com/db/latest/docs/framework/solid/reference/functions/useLiveQuery

This example demonstrates how to handle loading and error states returned by useLiveQuery using SolidJS's Switch and Match components. It displays different UI states based on the query's status.

```typescript
function useLiveQuery<TContext>(queryFn): Accessor<{ [K in string | number | symbol]: (TContext["result"] extends object ? any[any] : TContext["hasJoins"] extends true ? TContext["schema"] : TContext["schema"][TContext["fromSourceName"]])[K] }[]> & object;

// Handle loading and error states
const todosQuery = useLiveQuery((q) =>
  q.from({ todos: todoCollection })
)

return (
  <Switch>
    <Match when={todosQuery.isLoading}>
      <div>Loading...</div>
    </Match>
    <Match when={todosQuery.isError}>
      <div>Error: {todosQuery.status}</div>
    </Match>
    <Match when={todosQuery.isReady}>
      <For each={todosQuery()}>
        {(todo) => <li key={todo.id}>{todo.text}</li>}
      </For>
    </Match>
  </Switch>
)
```

--------------------------------

### Example Usage of CustomSQLiteSerializer (TypeScript)

Source: https://tanstack.com/db/latest/docs/reference/powersync-db-collection/type-aliases/CustomSQLiteSerializer

Demonstrates how to use the CustomSQLiteSerializer type to define custom serialization functions for specific properties. This example shows transformations for date, status, and meta properties.

```typescript
const serializer: CustomSQLiteSerializer<MyRowType, MySQLiteType> = {
  createdAt: (date) => date.toISOString(),
  status: (status) => status ? 1 : 0,
  meta: (meta) => JSON.stringify(meta),
};

```

--------------------------------

### Single Result Live Query - TanStack DB

Source: https://tanstack.com/db/latest/docs/framework/react/reference/functions/useLiveQuery

This example shows how to use `useLiveQuery` to fetch a single result. The `.findOne()` method is called on the query builder to retrieve a single record, and the `data` is directly accessed.

```typescript
// Single result query
const { data } = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => eq(todos.id, 1))
         .findOne()
)
```

--------------------------------

### Create Basic Electric Collection

Source: https://tanstack.com/db/latest/docs/collections/electric-collection

Demonstrates the basic setup for creating an Electric collection using `createCollection` and `electricCollectionOptions`. It configures the shape stream URL and a key extractor function.

```typescript
import { createCollection } from '@tanstack/react-db'
import { electricCollectionOptions } from '@tanstack/electric-db-collection'

const todosCollection = createCollection(
  electricCollectionOptions({
    shapeOptions: {
      url: '/api/todos',
    },
    getKey: (item) => item.id,
  })
)
```

--------------------------------

### useLiveQuery with Join Pattern (TypeScript)

Source: https://tanstack.com/db/latest/docs/framework/vue/reference/functions/useLiveQuery

Illustrates how to perform joins between collections using `useLiveQuery`. This example joins `issues` and `persons` collections to retrieve issue details along with the associated user's name.

```typescript
// Join pattern
const { data } = useLiveQuery((q) =>
  q.from({ issues: issueCollection })
   .join({ persons: personCollection }, ({ issues, persons }) =>
     eq(issues.userId, persons.id)
   )
   .select(({ issues, persons }) => ({
     id: issues.id,
     title: issues.title,
     userName: persons.name
   }))
)
```

--------------------------------

### Live Query with Dependencies - TanStack DB

Source: https://tanstack.com/db/latest/docs/framework/react/reference/functions/useLiveQuery

This example illustrates using `useLiveQuery` with a dependency array. The query re-executes whenever the `minPriority` variable changes, ensuring the data is always up-to-date based on the current priority level. Both `data` and `state` are returned.

```typescript
// With dependencies that trigger re-execution
const { data, state } = useLiveQuery(
  (q) => q.from({ todos: todosCollection })
         .where(({ todos }) => gt(todos.priority, minPriority)),
  [minPriority] // Re-run when minPriority changes
)
```

--------------------------------

### Mutation Lifecycle Example (TypeScript)

Source: https://tanstack.com/db/latest/docs/guides/mutations

Demonstrates the mutation lifecycle steps: optimistic state application, handler invocation, backend persistence, sync back, and optimistic state dropping. Shows how optimistic state is immediately applied and how errors trigger automatic rollback.

```tsx
// Step 1: Optimistic state applied immediately
todoCollection.update(todo.id, (draft) => {
  draft.completed = true
})
// UI updates instantly with optimistic state

// Step 2-3: onUpdate handler persists to backend
// Step 4: Handler waits for sync back
// Step 5: Optimistic state replaced by server state
```

--------------------------------

### Install UUID Generation for React Native

Source: https://tanstack.com/db/latest/docs

When using TanStack DB with React Native, a UUID generation library is required as React Native does not include `crypto.randomUUID()` by default. This command installs the `react-native-random-uuid` package, which provides the necessary polyfill for TanStack DB's internal use.

```sh
npm install react-native-random-uuid

```

--------------------------------

### Handling All States Uniformly in Template

Source: https://tanstack.com/db/latest/docs/framework/svelte/reference/functions/useLiveQuery

An example illustrating how to uniformly handle various states of a `useLiveQuery` result within a Svelte template. It checks for `isLoading`, `isError`, `isReady`, and displays the data count when the query is fully ready.

```html
// In template:
// {#if itemsQuery.isLoading}
//   <div>Loading...</div>
// {:else if itemsQuery.isError}
//   <div>Something went wrong</div>
// {:else if !itemsQuery.isReady}
//   <div>Preparing...</div>
// {:else}
//   <div>{itemsQuery.data.length} items loaded</div>
// {/if}
```

--------------------------------

### Basic Live Query with useLiveQuery in Solid.js

Source: https://tanstack.com/db/latest/docs/framework/solid/overview

Demonstrates the basic usage of the `useLiveQuery` hook from '@tanstack/solid-db' in a Solid.js component. It fetches and displays a list of incomplete todos, automatically updating when data changes. Dependencies include '@tanstack/solid-db' and '@tanstack/db'.

```tsx
import { useLiveQuery } from '@tanstack/solid-db'
import { eq } from '@tanstack/db'
import { Show, For } from 'solid-js'

function TodoList() {
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
     .where(({ todos }) => eq(todos.completed, false))
     .select(({ todos }) => ({ id: todos.id, text: todos.text }))
  )

  return (
    <Show when={!query.isLoading()} fallback={<div>Loading...</div>}>
      <ul>
        <For each={query.data}>
          {(todo) => <li>{todo.text}</li>}
        </For>
      </ul>
    </Show>
  )
}
```

--------------------------------

### Handling Loading and Error States in Template with useLiveQuery (TypeScript)

Source: https://tanstack.com/db/latest/docs/framework/vue/reference/functions/useLiveQuery

Provides a template example for handling loading and error states returned by `useLiveQuery`. It demonstrates conditional rendering based on `isLoading`, `isError`, and `status` properties.

```typescript
// Handle loading and error states in template
const { data, isLoading, isError, status } = useLiveQuery((q) =>
  q.from({ todos: todoCollection })
)

// In template:
// <div v-if="isLoading">Loading...</div>
// <div v-else-if="isError">Error: {{ status }}</div>
// <ul v-else>
//   <li v-for="todo in data" :key="todo.id">{{ todo.text }}</li>
// </ul>
```

--------------------------------

### Custom Storage Backend for LocalStorage Collections

Source: https://tanstack.com/db/latest/docs/collections/local-storage-collection

Provides an example of implementing a custom storage backend for LocalStorage collections. This allows for advanced features like encryption or integration with other storage solutions.

```typescript
// Example: Custom storage wrapper with encryption
const encryptedStorage = {
  getItem(key: string) {
    const encrypted = localStorage.getItem(key)
    return encrypted ? decrypt(encrypted) : null
  },
  setItem(key: string, value: string) {
    localStorage.setItem(key, encrypt(value))
  },
  removeItem(key: string) {
    localStorage.removeItem(key)
  },
}

const secureCollection = createCollection(
  localStorageCollectionOptions({
    id: 'secure-data',
    storageKey: 'encrypted-key',
    storage: encryptedStorage,
    getKey: (item) => item.id,
  })
)
```

--------------------------------

### Use Reusable Filters with Different Table Aliases

Source: https://tanstack.com/db/latest/docs/guides/live-queries

Shows how a reusable filter function can be applied to queries using different table aliases. The example demonstrates adapting the filter's input to match the alias used in the query.

```typescript
import type { Ref } from '@tanstack/db'
import { eq } from '@tanstack/db'

// Assuming Item type and itemsCollection are defined
// type Item = { active: boolean; ... }

const activeFilter = ({ item }: { item: Ref<Item> }) =>
  eq(item.active, true)

// Example usage with different aliases
/*
const query1 = new Query()
  .from({ item: itemsCollection })
  .where(activeFilter)

const query2 = new Query()
  .from({ i: itemsCollection })
  .where(({ i }) => activeFilter({ item: i }))  // Map the alias
*/
```
