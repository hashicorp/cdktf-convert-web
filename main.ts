import { Construct } from "constructs";
import { App, TerraformOutput, TerraformStack, Fn, RemoteBackend } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Provider } from "cdktf-local-build";
import { DockerFunction } from "@cdktf-plus/aws";
import path = require("path");
import { Apigatewayv2Api } from "@cdktf/provider-aws/lib/apigatewayv2";
import { ExternalProvider } from "@cdktf/provider-external";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambdafunction";
import {
  S3Bucket,
  S3BucketPolicy,
  S3BucketWebsiteConfiguration,
  S3Object,
} from "@cdktf/provider-aws/lib/s3";
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront";
import { sync as glob } from "glob";
import { lookup as mime } from "mime-types";

const S3_ORIGIN_ID = "s3Origin";
const LAMBDA_ORIGIN_ID = "lambda";

class PrefixConstruct extends Construct {
  protected prefix: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const stack = TerraformStack.of(this);

    this.prefix = (stack as any).prefix;
  }
}

const region = "eu-central-1";

class ConvertLambda extends PrefixConstruct {
  public api: Apigatewayv2Api;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const handler = new DockerFunction(this, `${this.prefix}-convert`, {
      path: path.resolve(__dirname, "functions/convert"),
      timeout: 900, // 15 minutes timeout
      memorySize: 1024, // 1024MB memory
    });

    this.api = new Apigatewayv2Api(this, "api", {
      name: `${this.prefix}-convert-api`,
      protocolType: "HTTP",
      target: handler.fn.arn,
      corsConfiguration: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowHeaders: ["content-type"],
      },
    });
    new LambdaPermission(this, "lambda-execution-permission", {
      statementId: "AllowApiGatewayHTTP",
      action: "lambda:InvokeFunction",
      functionName: handler.fn.arn,
      principal: "apigateway.amazonaws.com",
      sourceArn: `${this.api.executionArn}/*/*`,
    });
  }
}

class ConverFrontend extends PrefixConstruct {
  public endpoint: string;
  constructor(scope: Construct, id: string, api: ConvertLambda) {
    super(scope, id);

    const absoluteContentPath = path.resolve(__dirname, "frontend", "build");

    const bucket = new S3Bucket(this, "bucket", {
      bucketPrefix: `${this.prefix}-convert-frontend`,
      tags: {
        "hc-internet-facing": "true", // this is only needed for HashiCorp internal security auditing
      },
    });

    const files = glob("**/*.{json,js,html,png,ico,txt,map,css}", {
      cwd: absoluteContentPath,
    });

    files.forEach((f) => {
      // Construct the local path to the file
      const filePath = path.join(absoluteContentPath, f);

      // Creates all the files in the bucket
      new S3Object(this, `${id}/${f}`, {
        bucket: bucket.id,
        key: f,
        source: filePath,
        // mime is an open source node.js tool to get mime types per extension
        contentType: mime(path.extname(f)) || "text/html",
        etag: `filemd5("${filePath}")`,
      });
    });

    // Enable website delivery
    const bucketWebsite = new S3BucketWebsiteConfiguration(
      this,
      "website-configuration",
      {
        bucket: bucket.bucket,

        indexDocument: {
          suffix: "index.html",
        },

        errorDocument: {
          key: "index.html", // we could put a static error page here
        },
      }
    );

    new S3BucketPolicy(this, "s3_policy", {
      bucket: bucket.id,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Id: "PolicyForWebsiteEndpointsPublicContent",
        Statement: [
          {
            Sid: "PublicRead",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`${bucket.arn}/*`, `${bucket.arn}`],
          },
        ],
      }),
    });

    const loggingBucket = new S3Bucket(this, "logging bycket", {
      bucketPrefix: `${this.prefix}-convert-cdn-logs`,
    });

    const cf = new CloudfrontDistribution(this, "cf", {
      comment: `${this.prefix} convert frontend`,
      enabled: true,
      loggingConfig: {
        bucket: loggingBucket.bucketDomainName,
      },

      defaultCacheBehavior: {
        allowedMethods: [
          "DELETE",
          "GET",
          "HEAD",
          "OPTIONS",
          "PATCH",
          "POST",
          "PUT",
        ],
        cachedMethods: ["HEAD", "GET", "OPTIONS"],
        targetOriginId: S3_ORIGIN_ID,
        viewerProtocolPolicy: "redirect-to-https",
        forwardedValues: { queryString: false, cookies: { forward: "none" } },
      },
      origin: [
        {
          originId: S3_ORIGIN_ID,
          domainName: bucketWebsite.websiteEndpoint,
          customOriginConfig: {
            originProtocolPolicy: "https-only",
            httpPort: 80,
            httpsPort: 443,
            originSslProtocols: ["TLSv1.2", "TLSv1.1", "TLSv1"],
          },
        },
        {
          originId: LAMBDA_ORIGIN_ID,
          domainName: Fn.replace(api.api.apiEndpoint, "https://", ""),
          customOriginConfig: {
            originProtocolPolicy: "https-only",
            httpPort: 80,
            httpsPort: 443,
            originSslProtocols: ["TLSv1.2", "TLSv1.1", "TLSv1"],
          },
        },
      ],

      orderedCacheBehavior: [
        {
          pathPattern: "/convert/*",
          allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
          ],
          cachedMethods: ["HEAD", "GET", "OPTIONS"],
          forwardedValues: { queryString: true, cookies: { forward: "none" } },
          targetOriginId: LAMBDA_ORIGIN_ID,
          viewerProtocolPolicy: "redirect-to-https",
        },
        {
          pathPattern: "/*",
          allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
          ],
          cachedMethods: ["HEAD", "GET", "OPTIONS"],
          forwardedValues: { queryString: true, cookies: { forward: "none" } },
          targetOriginId: S3_ORIGIN_ID,
          viewerProtocolPolicy: "redirect-to-https",
        },
      ],
      defaultRootObject: "index.html",
      restrictions: { geoRestriction: { restrictionType: "none" } },
      viewerCertificate: { cloudfrontDefaultCertificate: true },
    });

    this.endpoint = `https://${cf.domainName}`;
  }
}

export class ConvertPage extends TerraformStack {
  prefix: string;
  constructor(scope: Construct, name: string, prefix = name) {
    super(scope, name);
    this.prefix = prefix;

    new AwsProvider(this, "aws", {
      region,
    });
    new Provider(this, "local");
    new ExternalProvider(this, "external");

    const lambda = new ConvertLambda(this, "convert");
    const frontend = new ConverFrontend(this, "frontend", lambda);

    new TerraformOutput(this, "convert-backend-url", {
      value: lambda.api.apiEndpoint,
    });
    new TerraformOutput(this, "convert-frontend-url", {
      value: frontend.endpoint,
    });
  }
}

export function getDevelopmentPrefix() {
  const userName = process.env.USER_NAME || require("os").userInfo().username;
  return `dev-${userName}`;
}

const app = new App();
new ConvertPage(app, "development", getDevelopmentPrefix());
const prod = new ConvertPage(app, "production");
new RemoteBackend(prod, {
  organization: "cdktf-team",
  workspaces: [
    {
      name: "cdktf-convert-web-prod",
    },
  ],
});

app.synth();
