export type AwsSchemaConfig = {
  connections?: {
    tableName?: string
    waitForConnectionTimeout?: number
  }
  subscriptions?: {
    tableName?: string
  }
}

