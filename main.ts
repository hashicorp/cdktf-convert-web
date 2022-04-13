import { Construct } from "constructs";
import { App, TerraformOutput, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Provider } from "cdktf-local-build";
import { DockerFunction } from "@cdktf-plus/aws";
import path = require("path");
import { Apigatewayv2Api } from "@cdktf/provider-aws/lib/apigatewayv2";
import { ExternalProvider } from "@cdktf/provider-external";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambdafunction";

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
  public endpoint: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const handler = new DockerFunction(this, "handler", {
      path: path.resolve(__dirname, "functions/convert"),
    });

    const apiEndpoint = new Apigatewayv2Api(this, "api", {
      name: `${this.prefix}-convert-api`,
      protocolType: "HTTP",
      target: handler.fn.arn,
      corsConfiguration: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowHeaders: ["content-type"],
      },
    });
    new LambdaPermission(this, "markhub-upload-auth-permission", {
      statementId: "AllowApiGatewayHTTP",
      action: "lambda:InvokeFunction",
      functionName: handler.fn.arn,
      principal: "apigateway.amazonaws.com",
      sourceArn: `${apiEndpoint.executionArn}/*/*`,
    });
    this.endpoint = apiEndpoint.apiEndpoint;
  }
}

class ConvertPage extends TerraformStack {
  prefix: string;
  constructor(scope: Construct, name: string) {
    super(scope, name);
    this.prefix = name;

    new AwsProvider(this, "aws", {
      region,
    });
    new Provider(this, "local");
    new ExternalProvider(this, "external");

    const lambda = new ConvertLambda(this, "convert");

    new TerraformOutput(this, "convert-backend-url", {
      value: lambda.endpoint,
    });
  }
}

const app = new App();
new ConvertPage(app, "development");
app.synth();
