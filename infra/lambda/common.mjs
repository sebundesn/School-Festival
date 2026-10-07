import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

// 価格はサーバー側が正。src/lib/menu.ts と揃えること。
export const MENU = {
  tare: { name: "タレ", price: 150 },
  shio: { name: "塩", price: 150 },
};
