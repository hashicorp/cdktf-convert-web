FROM docker.mirror.hashicorp.services/hashicorp/jsii-terraform

RUN yum install -y cmake3 automake libtool

# We could mount sth in, but until then only tmp can be written to it seems
ENV TF_PLUGIN_CACHE_DIR="/tmp" 

RUN mkdir -p /lambda
WORKDIR /lambda
COPY tsconfig.json /lambda/

COPY ./package.json /lambda/
RUN yarn install

COPY ./app.ts /lambda/
RUN yarn build

ENTRYPOINT ["/usr/bin/npx", "aws-lambda-ric"]
CMD ["app.handler"]

# ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/local/bin/aws-lambda-rie
# RUN chmod 755 /usr/local/bin/aws-lambda-rie
# ADD entrypoint.sh /lambda_entrypoint.sh
# ENTRYPOINT [ "/lambda_entrypoint.sh" ]
# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
# CMD [ "runner.handler" ]


# https://github.com/aws/aws-lambda-runtime-interface-emulator
# https://github.com/aws/aws-lambda-nodejs-runtime-interface-client
# https://docs.aws.amazon.com/lambda/latest/dg/images-test.html
# https://github.com/aws/aws-lambda-base-images/tree/nodejs12.x
# https://aws.amazon.com/blogs/compute/optimizing-lambda-functions-packaged-as-container-images/
# https://mikhail.io/serverless/coldstarts/aws/
# https://xan.manning.io/2016/09/08/mounting-efs-outside-of-aws.html