FROM public.ecr.aws/amazonlinux/amazonlinux:2

# Set locale and some other interesting environment variables
ENV LANG="C.UTF-8"                                                                                                      \
    LC_ALL="C.UTF-8"                                                                                                    \
    CHARSET="UTF-8"                                                                                                     \
                                                                                                                        \
    DOTNET_CLI_TELEMETRY_OPTOUT="true"                                                                                  \
    DOTNET_RUNNING_IN_CONTAINER="true"                                                                                  \
    DOTNET_NOLOGO="true"                                                                                                \
    DOTNET_USE_POLLING_FILE_WATCHER="true"                                                                              \
    NUGET_XMLDOC_MODE="skip"                                                                                            \
                                                                                                                        \
    GEM_HOME="/usr/local/bundle"                                                                                        \
    BUNDLE_SILENCE_ROOT_WARNING="1"                                                                                     \
                                                                                                                        \
    M2_VERSION="3.6.3"                                                                                                  \
    M2_HOME="/usr/local/apache-maven"                                                                                   \
    M2="/usr/local/apache-maven/bin"                                                                                    \
    MAVEN_OPTS="-Xms256m -Xmx512m"                                                                                      \
                                                                                                                        \
    GOROOT="/usr/local/go"

# Install deltarpm as it can speed up the upgrade processes, and tar as it's needed for installing Maven
# Also upgrading anything already installed, and adding some common dependencies for included tools
RUN yum -y upgrade                                                                                                      \
  && yum -y install deltarpm tar                                                                                        \
                    make system-rpm-config yum-utils                                                                    \
                    git gzip openssl rsync unzip which zip                                                              \
  && yum clean all && rm -rf /var/cache/yum

# Install .NET Core, mono & PowerShell
# COPY gpg/mono.asc /tmp/mono.asc
# RUN rpm --import "https://packages.microsoft.com/keys/microsoft.asc"                                                    \
#   && rpm -Uvh "https://packages.microsoft.com/config/centos/7/packages-microsoft-prod.rpm"                              \
#   && rpm --import /tmp/mono.asc && rm -f /tmp/mono.asc                                                                  \
#   && curl -sSL "https://download.mono-project.com/repo/centos7-stable.repo"                                             \
#       | tee /etc/yum.repos.d/mono-centos7-stable.repo                                                                   \
#   && yum -y install dotnet-sdk-3.1 mono-devel powershell                                                                \
#   && yum-config-manager --disable packages-microsoft-com-prod                                                           \
#   && yum-config-manager --disable mono-centos7-stable                                                                   \
#   && yum clean all && rm -rf /var/cache/yum

# # Install Python 3
# RUN yum -y install python3 python3-pip                                                                                  \
#   && python3 -m pip install --no-input --upgrade pip                                                                    \
#   && python3 -m pip install --no-input --upgrade awscli black setuptools twine wheel                                    \
#   && rm -rf $(pip cache dir)                                                                                            \
#   && yum clean all && rm -rf /var/cache/yum

# # Install JDK8 (Corretto)
# RUN amazon-linux-extras enable corretto8                                                                                \
#   && yum -y install java-1.8.0-amazon-corretto-devel                                                                    \
#   && yum clean all && rm -rf /var/cache/yum

# # Install Maven
# RUN curl -sL https://www.apache.org/dist/maven/maven-3/${M2_VERSION}/binaries/apache-maven-${M2_VERSION}-bin.tar.gz     \
#          -o /tmp/apache-maven.tar.gz                                                                                    \
#   && curl -sL https://www.apache.org/dist/maven/maven-3/${M2_VERSION}/binaries/apache-maven-${M2_VERSION}-bin.tar.gz.asc\
#           -o /tmp/apache-maven.tar.gz.asc                                                                               \
#   && mkdir -p /tmp/gpg-maven && chmod go-rwx /tmp/gpg-maven                                                             \
#   && curl -sL https://www.apache.org/dist/maven/KEYS | gpg --homedir /tmp/gpg-maven --import                            \
#   && gpg --homedir /tmp/gpg-maven --verify /tmp/apache-maven.tar.gz.asc /tmp/apache-maven.tar.gz                        \
#   && mkdir -p /usr/local && (cd /usr/local && tar xzf /tmp/apache-maven.tar.gz)                                         \
#   && mv /usr/local/apache-maven-${M2_VERSION} /usr/local/apache-maven                                                   \
#   && for BIN in $(find /usr/local/apache-maven/bin -type f -executable);                                                \
#      do                                                                                                                 \
#        ln -s $BIN /usr/local/bin/$(basename $BIN);                                                                      \
#      done                                                                                                               \
#   && rm -rf /tmp/apache-maven.tar.gz /tmp/apache-maven.tar.gz.asc /tmp/gpg-maven
# COPY m2-settings.xml /root/.m2/settings.xml

# Install Go
RUN curl -sL https://golang.org/dl/go1.16.linux-amd64.tar.gz -o /tmp/go.tar.gz                                          \
  && mkdir -p /usr/local && (cd /usr/local && tar -xzf /tmp/go.tar.gz)
ENV PATH="$GOROOT/bin:$PATH"

# Install GCC
RUN yum -y install gcc

# Install Docker
RUN amazon-linux-extras install docker                                                                                  \
  && yum clean all && rm -rf /var/cache/yum
VOLUME /var/lib/docker

# Install Node 14+
RUN curl -sL https://rpm.nodesource.com/setup_14.x | bash -                                                             \
  && yum -y install nodejs                                                                                              \
  && yum clean all && rm -rf /var/cache/yum                                                                             \
  && npm set unsafe-perm true

# Install Yarn
RUN curl -sSL https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo                                     \
  && yum -y install yarn                                                                                                \
  && yum clean all && rm -rf /var/cache/yum

# Install some configuration
COPY ssh_config /root/.ssh/config
RUN chmod 600 /root/.ssh/config

RUN yum install -y unzip jq

# Install Terraform
ENV DEFAULT_TERRAFORM_VERSION=0.14.7
RUN AVAILABLE_TERRAFORM_VERSIONS="0.13.6 ${DEFAULT_TERRAFORM_VERSION} 0.15.0-beta1" && \
    for VERSION in ${AVAILABLE_TERRAFORM_VERSIONS}; do curl -LOk https://releases.hashicorp.com/terraform/${VERSION}/terraform_${VERSION}_linux_amd64.zip && \
    mkdir -p /usr/local/bin/tf/versions/${VERSION} && \
    unzip terraform_${VERSION}_linux_amd64.zip -d /usr/local/bin/tf/versions/${VERSION} && \
    ln -s /usr/local/bin/tf/versions/${VERSION}/terraform /usr/local/bin/terraform${VERSION};rm terraform_${VERSION}_linux_amd64.zip;done && \
    ln -s /usr/local/bin/tf/versions/${DEFAULT_TERRAFORM_VERSION}/terraform /usr/local/bin/terraform

RUN yum install -y g++ \
    make \
    cmake3 \
    unzip \
    libcurl4-openssl-dev \
    autoconf \
    automake \
    libtool

RUN yum -y groupinstall 'Development Tools'
RUN yum clean all && rm -rf /var/cache/yum

RUN npm install -g aws-lambda-ric
RUN npm install -g cdktf-cli@latest

WORKDIR /var/task

COPY . /var/task/

# Install NPM dependencies for function
RUN npm install

RUN mv jest.config.js.lambda jest.config.js

ADD aws-lambda-rie /usr/local/bin/aws-lambda-rie
ADD entrypoint.sh /lambda_entrypoint.sh

RUN npm config set cache /tmp/.npm --global

ENV TF_PLUGIN_CACHE_DIR="/tmp/.terraform.d/plugin-cache"           \
    # MAVEN_OPTS is set in jsii/superchain with -Xmx512m. This isn't enough memory for provider generation.
    MAVEN_OPTS="-Xms256m -Xmx3G"


ENTRYPOINT [ "/lambda_entrypoint.sh" ]

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "runner.handler" ]

# https://github.com/aws/aws-lambda-runtime-interface-emulator
# https://github.com/aws/aws-lambda-nodejs-runtime-interface-client
# https://docs.aws.amazon.com/lambda/latest/dg/images-test.html
# https://github.com/aws/aws-lambda-base-images/tree/nodejs12.x
# https://aws.amazon.com/blogs/compute/optimizing-lambda-functions-packaged-as-container-images/
# https://mikhail.io/serverless/coldstarts/aws/
# https://xan.manning.io/2016/09/08/mounting-efs-outside-of-aws.html