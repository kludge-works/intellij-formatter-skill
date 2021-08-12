FROM ubuntu@sha256:86ac87f73641c920fb42cc9612d4fb57b5626b56ea2a19b894d0673fd5b4f2e9 AS downloader
ARG intellijVersion=2021.1.1
WORKDIR /downloads/

RUN apt-get update && \
    apt-get install wget ca-certificates \
    -y --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    wget --progress=dot:giga "https://download-cdn.jetbrains.com/idea/ideaIC-${intellijVersion}.tar.gz" && \
    tar xvf "ideaIC-${intellijVersion}.tar.gz" && \
    rm "ideaIC-${intellijVersion}.tar.gz"  && \
    mv idea-* intellij



FROM node:lts@sha256:af9879e7473d347048c5d5919aa9775f27c33d92e4d58058ffdc08247f4bd902 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \
    npm run compile && \
    rm -rf node_modules .git


FROM atomist/skill:node14@sha256:1f5574256296251d381a78d1987b83723534b419409d54a1a12b5595e23fb47f

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
