import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { db } from "./common.mjs";

const { CONNECTIONS_TABLE, WS_ENDPOINT } = process.env;
const ws = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });

export const handler = async (event) => {
  const conns = (await db.send(new ScanCommand({ TableName: CONNECTIONS_TABLE }))).Items ?? [];
  for (const rec of event.Records) {
    if (!rec.dynamodb?.NewImage) continue;
    const data = JSON.stringify({ type: "order", order: unmarshall(rec.dynamodb.NewImage) });
    await Promise.all(conns.map(async ({ connectionId }) => {
      try {
        await ws.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }));
      } catch (e) {
        if (e.name === "GoneException")
          await db.send(new DeleteCommand({ TableName: CONNECTIONS_TABLE, Key: { connectionId } }));
      }
    }));
  }
};
