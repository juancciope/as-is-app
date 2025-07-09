FROM apify/actor-node:18

COPY package*.json ./
RUN npm install

COPY . ./

CMD npm start