FROM node:22-alpine

COPY . /app

WORKDIR /app

EXPOSE 3000

RUN rm -rf node_modules
RUN npm cache clean --force
RUN npm install

CMD ["npm", "run", "start"]