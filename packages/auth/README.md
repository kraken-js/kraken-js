# @auth

## Definition

```graphql
directive @auth(rules: [AuthRule], silent: Boolean = true) on OBJECT | FIELD_DEFINITION

input AuthRule {
  # source of value
  args: String
  source: String
  authorizer: String
  # rules
  match: [String]
  truthy: Boolean
}
```

## Usage Samples

Some usage samples

### Authorizer must have property roles matching any

````graphql
type SecureObject @auth(rules: [{ authorizer: "roles",  match: ["secure.read"] }]) { secureField: String }
````

### Authorizer must be the owner of the object

````graphql
type SecureObject @auth(rules: [{ authorizer: "sub",  source: "owner" }]) { secureField: String }
````

### Authorizer groups allowed in the source object

````graphql
type SecureObject @auth(rules: [{ authorizer: "groups",  source: "editors" }]) { secureField: String, editors: [String] }
````

### Source object marked as public

````graphql
type SecureObject @auth(rules: [{ source: "isPublic", truthy: true }]) { secureField: String, isPublic: Boolean }
````

### User is creating an object setting as the owner (match with args)

#### Single value

```graphql
type SecureObject { owner: String }
input CreateSecureObject { owner: String }

type Mutation { createSecureObject(input: CreateSecureObject): SecureObject @auth(rules: [
  { authorizer: "sub", args: "input.owner" }
])}
```

#### Multiple values

```graphql
type SecureObject { owners: [String] }
input CreateSecureObject { owners: [String] }

type Mutation { createSecureObject(input: CreateSecureObject): SecureObject @auth(rules: [
  { authorizer: "sub", args: "input.owners" }
])}
```

## Multiple rules

When configuring multiple rules if any of them evaluates as true the operation will authorize

```graphql
type SecureObject @auth(rules: [
  { authorizer: "roles",  match: ["secure.read"] },
  { source: "isPublic",  truthy: true },
  { authorizer: "sub",  source: "owner" },
  { authorizer: "sub",  source: "readers" },
  { authorizer: "groups",  source: "readers" }
]) { secureField: String }
```
