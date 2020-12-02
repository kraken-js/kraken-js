export type RedisSchemaConfig = {
  redisUrl: string
  connections?: {
    waitForConnectionTimeout?: number
  }
}
