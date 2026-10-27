FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
