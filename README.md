# docker-dev

---

A lightweight CLI utility that extends [docker-compose](https://docs.docker.com/compose/) with functionality that is particularly useful in a development environment.

## Installation

    npm i -g docker-dev

## Introduction

Over time, [Docker](https://www.docker.com/) has taken its place as a critical component of my development toolkit. It's powerful and allows for a tremendous degree of flexibility, but I find that it lacks some important "out of the box" features that are particularly important within the context of a development environment. This lightweight utility works in conjunction with [docker-compose](https://docs.docker.com/compose/) to fill in those missing gaps, which are detailed below.

## Development Workflow

### Describing the Image

When creating a new Docker service, my first steps include the creation of a new Git repository in which to store the project, along with a [Dockerfile](https://docs.docker.com/engine/reference/builder/) that describes the image / environment in which it will run.

The following `Dockerfile` demonstrates the creation of a simple [Node](https://nodejs.org/)-based service that connects to a [PostgreSQL](https://www.postgresql.org/) database.

```
FROM mhart/alpine-node:6.9.2
RUN apk update &&
    apk upgrade &&
    apk add \
    bash \
    tzdata \
    git \
    openssh \
    postgresql-client \
    postgresql-contrib \
    postgresql-dev
RUN cp /usr/share/zoneinfo/America/New_York /etc/localtime
RUN rm -rf /var/cache/apk/*
RUN npm i -g nodemon yarn grunt-cli
ENV TERM=xterm-256color
COPY package.json yarn.lock /opt/app/
WORKDIR /opt/app
RUN yarn
COPY . /opt/app
ENTRYPOINT node ./bin/index.js
EXPOSE 80
```

### Describing the Development Environment

With my application's code and accompanying `Dockerfile` committed, I now turn to the creation of a development environment in which I can manage this service and the others with which it interacts. This involves the creation of a `docker-compose.yml` file that allows me to define and manage these services as a group, an example of which is shown below.

```
###
### Within my development environment, this file is located at:
###
### ~/workspace/docker-compose.yml
###
version: '3'
services:
  # The app we created in the previous step
  app:
    build:
      context: ./app
    image: docker.private-registry.com/app:develop
    volumes:
      - ~/workspace/app:/opt/app
    depends_on:
      - db
  # A PostgreSQL service with which our application can interact
  db:
    image: postgres:9.2.21
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=app
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - /var/lib/postgresql/data/pgdata:/var/lib/postgresql/data/pgdata
```

_Note: A description of the various options that are available via Docker's `docker-compose` utility can be found [here](https://docs.docker.com/compose/compose-file/)._

So far, we've done nothing that goes beyond the traditional Docker development process. Let's extend that process now with the creation of a new `docker-dev.yml` file that we'll save in the same location as the `docker-compose.yml` file that we just looked at.

```
###
### Within my development environment, this file is located at:
###
### ~/workspace/docker-dev.yml
###
services:
  # Corresponds to the 'app' service that we defined in docker-compose.yml
  app:
    repository:
      # The URL of the Git repository that houses this project
      url: git@github.com:tkambler/app.git
      # The default branch to be checked out when the development environment is brought online
      branch: develop
    # Files / folders within this project's image that will be copied to the host before it is brought online
    export:
      - /opt/app/node_modules:node_modules
    # Commands to be run immediately after the service is started.
    service-scripts:
      post-up:
        - ["knex", "migrate:latest"]
        - ["knex", "seed:run"]
```

```
###
### Within my development environment, this file is located at:
###
### ~/workspace/docker-dev.yml
###
repositories:
  - url: https://github.com/tkambler/docker-example1.git
    # The default branch to be checked out when the development environment is brought online
    branch: master
    # The location to which the repository should be cloned
    dest: ./app
services:
  # Corresponds to the 'app' service that we defined in docker-compose.yml
  app:
    export:
      - /opt/app/node_modules:./app/node_modules
    service-scripts:
      # Commands to be run immediately after the service is started.
      post-up:
        - ["knex", "migrate:latest"]
        - ["knex", "seed:run"]
```

Within our `docker-dev.yml` file, we define services that correspond with those found in `docker-compose.yml`. The service options that are available to us within `docker-dev.yml` are outlined below.

*export*

Each entry within this list maps a file or folder that is located within our project's image to a location on our host's local filesystem. **After** our service's image has been built, but **before** its corresponding container is started, these files will be copied **from** the image **to** the host. This is important, in that it allows us to build this service's dependencies within the appropriate runtime environment.

In this example, our image's `/opt/app/node_modules` folder is mapped to `~/workspace/app/node_modules` on our host.

## Commands

### up

Bring up services:

    $ docker-dev up

### down

Bring services down with:

    $ docker-dev down
