FROM node:16

WORKDIR /app
COPY . .
RUN npm install

ENV JWT_SECRET=secret123
ENV DB_PASSWORD=postgres

EXPOSE 3000
CMD npm start
