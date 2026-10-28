// 시험용: DynamoDB Local 에 template.yaml 과 같은 표를 새로 만들어 저장소를 돌려줍니다
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { createDynamoStore } from '../index.mjs';

let n = 0;
export async function makeDynamoStore() {
  const client = new DynamoDBClient({ endpoint: process.env.DDB_ENDPOINT, region: 'ap-northeast-2', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
  const TableName = `t${Date.now()}_${n++}`;
  const attrs = ['pk', 'sk', ...[1, 2, 3, 4].flatMap((i) => [`gsi${i}pk`, `gsi${i}sk`])];
  await client.send(new CreateTableCommand({
    TableName, BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: attrs.map((a) => ({ AttributeName: a, AttributeType: 'S' })),
    KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }],
    GlobalSecondaryIndexes: [1, 2, 3, 4].map((i) => ({
      IndexName: `gsi${i}`, Projection: { ProjectionType: 'ALL' },
      KeySchema: [{ AttributeName: `gsi${i}pk`, KeyType: 'HASH' }, { AttributeName: `gsi${i}sk`, KeyType: 'RANGE' }],
    })),
  }));
  return createDynamoStore(TableName, client);
}
