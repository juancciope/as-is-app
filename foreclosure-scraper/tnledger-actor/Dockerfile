FROM apify/actor-node-playwright:18

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD npm start