FROM node:lts

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN groupadd -g 1001 nodejs && \
	useradd -u 1001 -g nodejs -s /bin/bash -m nodejs

RUN chown -R nodejs:nodejs /app

RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
