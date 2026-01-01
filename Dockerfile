FROM node:22-alpine

COPY . /app

WORKDIR /app

EXPOSE 80

RUN rm -rf node_modules
RUN npm cache clean --force
RUN npm install

CMD ["npm", "run", "start"]
