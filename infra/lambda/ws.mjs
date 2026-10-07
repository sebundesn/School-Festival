import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "./common.mjs";

const { CONNECTIONS_TABLE, STAFF_TOKEN } = process.env;

export const handler = async (event) => {
  const { connectionId, routeKey } = event.requestContext;
  if (routeKey === "$connect") {
    const q = event.queryStringParameters ?? {};
    if (q.token !== STAFF_TOKEN) return { statusCode: 401 };
    await db.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: { connectionId, role: q.role ?? "", ttl: Math.floor(Date.now() / 1000) + 6 * 3600 },
    }));
  } else if (routeKey === "$disconnect") {
    await db.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
  }
  return { statusCode: 200 };
};
