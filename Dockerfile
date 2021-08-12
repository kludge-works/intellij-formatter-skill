FROM ubuntu@sha256:86ac87f73641c920fb42cc9612d4fb57b5626b56ea2a19b894d0673fd5b4f2e9 AS downloader
ARG intellijVersion=2021.2
WORKDIR /downloads/

RUN apt-get update -y && apt-get upgrade -y && \
    apt-get install wget=1.20.3-1ubuntu1 ca-certificates=20210119~20.04.1 \
    -y --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    wget --progress=dot:giga "https://download-cdn.jetbrains.com/idea/ideaIC-${intellijVersion}.tar.gz" && \
    tar xf "ideaIC-${intellijVersion}.tar.gz" && \
    rm "ideaIC-${intellijVersion}.tar.gz"  && \
    mv idea-* intellij

FROM node:lts@sha256:fa05e1eec0a6723c76a32b30ad05bf3bf8933b2519b826a51258c5feba61529c AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \
    npm run compile && \
    rm -rf node_modules .git

FROM atomist/skill:node14@sha256:aa51958caa3d96c3936e8baea59b5513a45a3a33d25b6dad13eebf90ae323fc5

WORKDIR "/skill"

RUN npm i -g depcheck

COPY package.json package-lock.json ./

RUN npm ci --no-optional \
    && rm -rf /root/.npm

COPY --from=build /usr/src/ .
COPY --from=downloader /downloads/intellij /opt/intellij

WORKDIR "/atm/home"

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]

LABEL intellij.version="$intellijVersion"