// const querystring = require("querystring");
// const { convert } = require("@cdktf/hcl2cdk");

function res(status, content) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
    },
    isBase64Encoded: false,
    body: JSON.stringify(content),
  };
}

// Handles requests like POST /?provider='aws%40%3D3.0'&provider='google%40%3D4.0.5'
// Runs convert with post content and all mentioned providers
exports.handler = async function (event, context) {
  const {
    requestContext: { httpMethod, path },
  } = event;

  if (httpMethod !== "POST") {
    return res(405, { error: "Method Not Allowed" });
  }

  return res(200, { error: `Stub response, got path ${path}` });
};
