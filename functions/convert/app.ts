import { convert } from "@cdktf/hcl2cdk";
import {
  readSchema,
  ConstructsMakerProviderTarget,
  LANGUAGES,
  config as cfg,
} from "@cdktf/provider-generator";

function res(
  status: number,
  content: Record<string, any>,
  headers?: Record<string, string | boolean>
) {
  return {
    statusCode: status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    isBase64Encoded: false,
    body: JSON.stringify(content),
  };
}

function unexpectedFail(errorMessage: string, err?: Error) {
  console.error(errorMessage);
  if (err) {
    console.error(err);
  }
  return res(500, {
    error: err ? `${errorMessage}: ${err}` : errorMessage,
  });
}

// Handles requests like POST /?provider='aws%40%3D3.0'&provider='google%40%3D4.0.5'
// Runs convert with post content and all mentioned providers
exports.handler = async function (
  event: Record<string, any>,
  _context: unknown
) {
  console.log("handling incoming event", JSON.stringify(event, null, 2));
  if (!event.requestContext) {
    return unexpectedFail("Expected Event Request Context to be set");
  }

  const {
    requestContext: {
      http: { method },
    },
    queryStringParameters: { provider },
    body,
  } = event;

  // Enable CORS
  if (method === "OPTIONS") {
    return res(
      200,
      {},
      {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      }
    );
  }

  if (method !== "POST") {
    return res(405, {
      error: `Method Not Allowed, got: '${method}' expected: 'POST'`,
    });
  }

  const providers: string[] = provider.replace(/'/g, "").split(",");

  console.log("Decoded providers", providers);

  let base64Code = undefined;
  try {
    const bodyJson = JSON.parse(body);
    base64Code = bodyJson.code;
  } catch (e) {
    return res(400, {
      error: `Could not parse body: '${body}': ${e}`,
    });
  }
  console.log("parsed body, got base64Code", base64Code);
  if (!base64Code) {
    return res(400, { error: "Expected code key to be set in bodies JSON" });
  }

  let hcl = undefined;

  try {
    hcl = Buffer.from(base64Code, "base64").toString("utf8");
  } catch (e) {
    return res(400, {
      error: "Expected code key to be have base64 encoded body",
    });
  }
  console.log("Got hcl", hcl);

  console.log("Reading schema");
  let schema = undefined;
  try {
    const { providerSchema } = await readSchema(
      providers.map((spec) =>
        ConstructsMakerProviderTarget.from(
          new cfg.TerraformProviderConstraint(spec),
          LANGUAGES[0]
        )
      )
    );
    schema = providerSchema;
  } catch (e) {
    return unexpectedFail("Could not fetch provider schema", e as Error);
  }

  console.log("Read schema", schema);

  let code;
  try {
    const ts = await convert(hcl, {
      language: "typescript",
      providerSchema: schema,
    });
    code = ts.all;
  } catch (e) {
    return unexpectedFail("Could not convert", e as Error);
  }

  return res(200, {
    code,
  });
};
