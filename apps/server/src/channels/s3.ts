import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'

export class S3ClientExtended {
  private client: S3Client
  private bucket: string

  constructor(config: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    const clientConfig: S3ClientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint
      clientConfig.forcePathStyle = true
    }

    this.client = new S3Client(clientConfig)
    this.bucket = config.bucket
  }

  async testConnection(): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({ Bucket: this.bucket })
      await this.client.send(command)
      return true
    } catch {
      return false
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    const keys: string[] = []
    let continuationToken: string | undefined

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })

      const response = await this.client.send(command)

      if (response.Contents) {
        for (const content of response.Contents) {
          if (content.Key) {
            keys.push(content.Key)
          }
        }
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return keys
  }

  async uploadFile(key: string, content: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    })

    await this.client.send(command)
  }

  async downloadFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    const response = await this.client.send(command)

    if (!response.Body) {
      throw new Error('Empty response body')
    }

    // Convert to Buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as any) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    await this.client.send(command)
  }
}
